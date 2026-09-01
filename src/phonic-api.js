// Phonic session-token and outbound-call Worker.
// The Webflow-to-Attio webhook is deployed separately from src/attio.js.
const PHONIC_STS_WS_URL = "wss://api.phonic.ai/v1/sts/ws";
const PHONIC_SESSION_TOKEN_URL = "https://api.phonic.ai/v1/auth/session_token";
const PHONIC_OUTBOUND_CALL_URL =
  "https://api.phonic.ai/v1/conversations/outbound_call";
const PHONIC_SIP_OUTBOUND_CALL_URL =
  "https://api.phonic.ai/v1/conversations/sip/outbound_call";
const PATIENT_INTAKE_AGENT_ID = "phonic-co-marketing-demo-healthcare";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env),
      });
    }

    if (url.pathname === "/api/phonic/session-token") {
      return handleSessionTokenRequest(request, env);
    }

    if (
      url.pathname === "/api/phonic/outbound-call" ||
      url.pathname === "/api/phonic/request-a-call"
    ) {
      return handleOutboundCallRequest(request, env, ctx);
    }

    return jsonResponse({ error: "Not found" }, 404, request, env);
  },
};

async function handleSessionTokenRequest(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, request, env);
  }

  if (!isOriginAllowed(request, env)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, request, env);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const agentId = normalizeAgentId(body.agentId);
    const conversationLabel = normalizeConversationLabel(
      body.conversationLabel,
    );

    if (!agentId) {
      return jsonResponse(
        { error: "Missing or invalid agent ID" },
        400,
        request,
        env,
      );
    }

    if (!env.PHONIC_API_KEY) {
      return jsonResponse(
        { error: "Missing PHONIC_API_KEY" },
        500,
        request,
        env,
      );
    }

    const phonicResponse = await fetch(PHONIC_SESSION_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PHONIC_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ttl_seconds: 300,
      }),
    });

    const phonicText = await phonicResponse.text();

    if (!phonicResponse.ok) {
      return jsonResponse(
        {
          error: "Failed to create Phonic session token",
          status: phonicResponse.status,
          details: safeJson(phonicText),
        },
        502,
        request,
        env,
      );
    }

    const phonicData = safeJson(phonicText);

    return jsonResponse(
      {
        sessionToken: phonicData.session_token,
        expiresAt: phonicData.expires_at,
        websocketUrl: PHONIC_STS_WS_URL,
        agentId,
        conversationLabel,
        config: {
          type: "config",
          agent: agentId,
        },
      },
      200,
      request,
      env,
    );
  } catch (error) {
    return jsonResponse(
      {
        error: "Unexpected Worker error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
      request,
      env,
    );
  }
}

async function handleOutboundCallRequest(request, env, ctx) {
  if (request.method !== "POST") {
    return outboundErrorResponse(
      "Method not allowed",
      "This call request could not be sent. Please refresh the page and try again.",
      405,
      request,
      env,
    );
  }

  if (!isOriginAllowed(request, env)) {
    return outboundErrorResponse(
      "Origin not allowed",
      "This form can only be submitted from an approved Phonic page.",
      403,
      request,
      env,
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const defaultCountryCode = normalizeDefaultCountryCode(
      env.PHONIC_DEFAULT_COUNTRY_CODE,
    );
    const phoneNumber = normalizePhoneNumber(
      body.phoneNumber ?? body.to_phone_number,
      defaultCountryCode,
    );
    const agentId = resolveOutboundAgentId(body);
    const voiceId = normalizeOptionalText(body.voiceId, 128);
    const useSip = shouldUseSipOutbound(env);

    if (!phoneNumber) {
      return outboundErrorResponse(
        "Invalid phone number",
        "Please enter a valid phone number with a country code, like +1 555 123 4567.",
        400,
        request,
        env,
      );
    }

    if (!agentId) {
      return outboundErrorResponse(
        "Missing or invalid agent ID",
        "Please choose a demo option before requesting a call.",
        400,
        request,
        env,
      );
    }

    if (!env.PHONIC_API_KEY) {
      return outboundErrorResponse(
        "Missing PHONIC_API_KEY",
        "We could not start the call because the call service is not fully configured.",
        500,
        request,
        env,
      );
    }

    const phonicPayload = {
      to_phone_number: phoneNumber,
      config: {
        agent: agentId,
      },
      dry_run: normalizeBoolean(body.dryRun),
    };

    if (voiceId) {
      phonicPayload.config.voice_id = voiceId;
    }

    const templateVariables = buildTemplateVariables(body);
    if (Object.keys(templateVariables).length > 0) {
      phonicPayload.config.template_variables = templateVariables;
    }

    const phonicHeaders = {
      Authorization: `Bearer ${env.PHONIC_API_KEY}`,
      "Content-Type": "application/json",
    };
    let phonicUrl = PHONIC_OUTBOUND_CALL_URL;

    if (useSip) {
      const sipAddress = normalizeOptionalText(env.PHONIC_SIP_ADDRESS, 512);
      const fromPhoneNumber = normalizePhoneNumber(
        env.PHONIC_FROM_PHONE_NUMBER,
        defaultCountryCode,
      );

      if (!sipAddress) {
        return outboundErrorResponse(
          "Missing PHONIC_SIP_ADDRESS",
          "We could not start the call because the call service is not fully configured.",
          500,
          request,
          env,
        );
      }

      if (!fromPhoneNumber) {
        return outboundErrorResponse(
          "Missing or invalid PHONIC_FROM_PHONE_NUMBER",
          "We could not start the call because the caller number is not configured correctly.",
          500,
          request,
          env,
        );
      }

      phonicUrl = PHONIC_SIP_OUTBOUND_CALL_URL;
      phonicPayload.from_phone_number = fromPhoneNumber;
      phonicHeaders["X-Sip-Address"] = sipAddress;

      const sipUsername = normalizeOptionalText(
        env.PHONIC_SIP_AUTH_USERNAME,
        256,
      );
      const sipPassword = normalizeOptionalText(
        env.PHONIC_SIP_AUTH_PASSWORD,
        256,
      );

      if (sipUsername) {
        phonicHeaders["X-Sip-Auth-Username"] = sipUsername;
      }

      if (sipPassword) {
        phonicHeaders["X-Sip-Auth-Password"] = sipPassword;
      }
    }

    const shouldWaitForPhonic =
      normalizeBoolean(body.dryRun) ||
      normalizeBoolean(body.waitForPhonic) ||
      normalizeBoolean(env.PHONIC_WAIT_FOR_OUTBOUND_RESPONSE);

    if (!shouldWaitForPhonic) {
      const callTask = sendPhonicOutboundCall({
        phonicUrl,
        phonicHeaders,
        phonicPayload,
      }).catch(() => {});

      if (ctx?.waitUntil) {
        ctx.waitUntil(callTask);
      }

      return jsonResponse(
        {
          callStarted: true,
          queued: true,
          toPhoneNumber: phoneNumber,
          dryRun: false,
          mode: useSip ? "sip" : "managed",
        },
        202,
        request,
        env,
      );
    }

    const phonicData = await sendPhonicOutboundCall({
      phonicUrl,
      phonicHeaders,
      phonicPayload,
    });

    return jsonResponse(
      {
        conversationId: phonicData.conversation_id ?? null,
        twilioCallSid: phonicData.twilio_call_sid ?? null,
        toPhoneNumber: phoneNumber,
        dryRun: Boolean(phonicData.dry_run),
        mode: useSip ? "sip" : "managed",
      },
      200,
      request,
      env,
    );
  } catch (error) {
    if (isPhonicOutboundError(error)) {
      return outboundErrorResponse(
        "Failed to request Phonic outbound call",
        "We could not start the call just now. Please try again in a moment.",
        502,
        request,
        env,
        {
          status: error.status,
          details: error.details,
        },
      );
    }

    return outboundErrorResponse(
      "Unexpected Worker error",
      "Something went wrong while starting the call. Please try again in a moment.",
      500,
      request,
      env,
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    );
  }
}


function outboundErrorResponse(
  error,
  userMessage,
  status,
  request,
  env,
  extra,
) {
  return jsonResponse(
    {
      error,
      userMessage,
      ...(extra || {}),
    },
    status,
    request,
    env,
  );
}

function isPhonicOutboundError(error) {
  return (
    error instanceof Error &&
    error.message === "Failed to request Phonic outbound call" &&
    typeof error.status === "number"
  );
}

async function sendPhonicOutboundCall({
  phonicUrl,
  phonicHeaders,
  phonicPayload,
}) {
  const phonicResponse = await fetch(phonicUrl, {
    method: "POST",
    headers: phonicHeaders,
    body: JSON.stringify(phonicPayload),
  });

  const phonicText = await phonicResponse.text();
  const phonicData = safeJson(phonicText);

  if (!phonicResponse.ok) {
    const error = new Error("Failed to request Phonic outbound call");
    error.status = phonicResponse.status;
    error.details = phonicData;
    throw error;
  }

  return phonicData;
}







function buildTemplateVariables(body) {
  const variables = {};

  addTemplateVariable(variables, "demo_type", body.demoType);
  addTemplateVariable(variables, "voice_label", body.voiceType);
  addTemplateVariable(variables, "page_url", body.pageUrl, 1024);
  addTemplateVariable(variables, "source", body.source);

  return variables;
}

function resolveOutboundAgentId(body) {
  const explicitAgentId = normalizeAgentId(body.agentId ?? body.agent);
  const demoType = normalizeOptionalText(body.demoType, 256);
  const voiceType = normalizeOptionalText(body.voiceType, 256);

  const isPatientIntakeMaya =
    matchesText(demoType, "Patient intake") &&
    matchesText(voiceType, "Calm voice by Maya");

  if (
    isPatientIntakeMaya &&
    (!explicitAgentId || matchesText(explicitAgentId, "Patient intake"))
  ) {
    return PATIENT_INTAKE_AGENT_ID;
  }

  return explicitAgentId || normalizeAgentId(demoType);
}

function matchesText(value, expected) {
  return value.trim().toLowerCase() === expected.toLowerCase();
}

function addTemplateVariable(variables, key, value, maxLength = 256) {
  const normalized = normalizeOptionalText(value, maxLength);
  if (normalized) {
    variables[key] = normalized;
  }
}

function shouldUseSipOutbound(env) {
  const mode = normalizeOptionalText(
    env.PHONIC_OUTBOUND_MODE,
    32,
  ).toLowerCase();

  return mode === "sip" || (!mode && Boolean(env.PHONIC_SIP_ADDRESS));
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeDefaultCountryCode(value) {
  if (typeof value !== "string") return "1";
  const digits = value.replace(/\D/g, "");

  return /^[1-9]\d{0,2}$/.test(digits) ? digits : "1";
}

function normalizePhoneNumber(value, defaultCountryCode = "1") {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  let normalized = "";
  if (trimmed.startsWith("+")) {
    normalized = `+${digits}`;
  } else if (digits.length === 10) {
    normalized = `+${defaultCountryCode}${digits}`;
  } else if (digits.length === 11 && digits.startsWith(defaultCountryCode)) {
    normalized = `+${digits}`;
  } else if (/^[1-9]\d{7,14}$/.test(digits)) {
    normalized = `+${digits}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : "";
}

function normalizeOptionalText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}




































function jsonResponse(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(request, env),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Webhook-Secret, X-Webflow-Webhook-Secret",
    Vary: "Origin",
  };
}

function isOriginAllowed(request, env) {
  const allowedOrigins = getAllowedOrigins(env);
  const origin = request.headers.get("Origin");

  return (
    !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)
  );
}

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAgentId(value) {
  if (typeof value !== "string") return "";
  const agentId = value.trim();
  return agentId.length > 0 && agentId.length <= 256 ? agentId : "";
}

function normalizeConversationLabel(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 256);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
