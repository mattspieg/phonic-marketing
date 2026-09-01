// Dedicated Cloudflare Worker for the Webflow-to-Attio webhook.
// This worker intentionally has no Phonic credentials or routes.
const ATTIO_PEOPLE_UPSERT_URL =
  "https://api.attio.com/v2/objects/people/records?matching_attribute=email_addresses";
const ATTIO_COMPANIES_UPSERT_URL =
  "https://api.attio.com/v2/objects/companies/records?matching_attribute=domains";
const ATTIO_ATTRIBUTES_URL = "https://api.attio.com/v2";
const ATTIO_LIST_ENTRY_URL = "https://api.attio.com/v2/lists";
const DEFAULT_ATTIO_PERSON_FIELD_SLUGS = {
  country: "country",
  sourcePage: "source_page",
  latestFormSubmitted: "latest_form_submitted",
  latestDemoRequestAt: "latest_demo_request_at",
  companyName: "company_name",
};
const DEFAULT_ATTIO_DEMO_REQUEST_FIELD_SLUGS = {
  status: "status",
  submittedAt: "submitted_at",
  useCase: "use_case",
  expectedCallVolume: "expected_call_volume",
  country: "country",
  sourcePage: "source_page",
  formName: "form_name",
  webflowSubmissionId: "webflow_submission_id",
  webflowFormId: "webflow_form_id",
  companyName: "company_name",
  companyWebsite: "company_website",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
  referrer: "referrer",
  landingPage: "landing_page",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env),
      });
    }

    if (url.pathname === "/api/webflow/attio-person") {
      return handleWebflowAttioPersonRequest(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404, request, env);
  },
};

async function handleWebflowAttioPersonRequest(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, request, env);
  }

  const rawBody = await request.text();
  const webhookValidation = await validateWebflowWebhookRequest(
    request,
    env,
    rawBody,
  );

  if (!webhookValidation.valid) {
    return jsonResponse({ error: "Webhook secret invalid" }, 403, request, env);
  }

  try {
    const body = parseIncomingBody(rawBody, request.headers.get("Content-Type"));
    const formFields = extractWebflowFormFields(body);
    const submissionContext = buildWebflowSubmissionContext(formFields, body);
    let attioValues = buildAttioPersonValues(
      formFields,
      body,
      env,
      submissionContext,
    );
    let demoRequestEntryValues = buildAttioDemoRequestEntryValues(
      submissionContext,
      env,
    );
    let attioCompanyRecordId = null;

    if (env.ATTIO_API_TOKEN) {
      try {
        const peopleAttributes = await listAttioAttributeSlugs({
          env,
          target: "objects",
          identifier: "people",
        });
        const filteredPersonValues = filterAttioValuesByAttributes(
          attioValues,
          peopleAttributes,
        );
        attioValues = filteredPersonValues;

        const demoRequestListId = getAttioDemoRequestListId(env);
        if (demoRequestListId) {
          const demoRequestListAttributes = await listAttioAttributeSlugs({
            env,
            target: "lists",
            identifier: demoRequestListId,
          });
          const filteredEntryValues = filterAttioValuesByAttributes(
            demoRequestEntryValues,
            demoRequestListAttributes,
          );
          demoRequestEntryValues = filteredEntryValues;
        }
      } catch (error) {
        return jsonResponse(
          {
            error: "Failed to inspect Attio schema",
            status: error.status,
            details: error.details,
          },
          502,
          request,
          env,
        );
      }
    }

    if (!env.ATTIO_API_TOKEN) {
      return jsonResponse(
        { error: "Missing ATTIO_API_TOKEN" },
        500,
        request,
        env,
      );
    }

    if (!attioValues.email_addresses) {
      return jsonResponse(
        { error: "Missing or invalid email address" },
        400,
        request,
        env,
      );
    }

    const companyDomain = normalizeDomain(submissionContext.companyWebsite);
    if (companyDomain && attioValues.company) {
      try {
        const companyData = await upsertAttioCompany({
          env,
          domain: companyDomain,
          name: submissionContext.companyName,
        });
        const companyRecordId = companyData?.data?.id?.record_id;

        if (companyRecordId) {
          attioCompanyRecordId = companyRecordId;
          attioValues.company = [
            {
              target_object: "companies",
              target_record_id: companyRecordId,
            },
          ];
        }
      } catch (error) {
        return jsonResponse(
          {
            error: "Failed to upsert Attio company",
            status: error.status,
            details: error.details,
          },
          502,
          request,
          env,
        );
      }
    }

    const attioResponse = await fetch(ATTIO_PEOPLE_UPSERT_URL, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.ATTIO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          values: attioValues,
        },
      }),
    });
    const attioText = await attioResponse.text();
    const attioData = safeJson(attioText);

    if (!attioResponse.ok) {
      return jsonResponse(
        {
          error: "Failed to upsert Attio person",
          status: attioResponse.status,
          details: attioData,
        },
        502,
        request,
        env,
      );
    }

    const demoRequestListId = getAttioDemoRequestListId(env);
    let demoRequestEntryData = null;

    if (demoRequestListId && attioData?.data?.id?.record_id) {
      try {
        const demoRequestParent = await resolveAttioDemoRequestParent({
          env,
          listId: demoRequestListId,
          personRecordId: attioData.data.id.record_id,
          companyRecordId: attioCompanyRecordId,
        });

        if (demoRequestParent) {
          demoRequestEntryData = await createAttioDemoRequestEntry({
            env,
            listId: demoRequestListId,
            parentObject: demoRequestParent.parentObject,
            parentRecordId: demoRequestParent.parentRecordId,
            entryValues: demoRequestEntryValues,
          });
        }
      } catch (error) {
        return jsonResponse(
          {
            error: "Failed to create Attio demo request entry",
            status: error.status,
            details: error.details,
          },
          502,
          request,
          env,
        );
      }
    }

    return jsonResponse(
      {
        upserted: true,
        email: attioValues.email_addresses[0].email_address,
        recordId: attioData?.data?.id?.record_id ?? null,
        webUrl: attioData?.data?.web_url ?? null,
        demoRequestEntryId:
          demoRequestEntryData?.data?.id?.entry_id ?? null,
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
async function createAttioDemoRequestEntry({
  env,
  listId,
  parentObject,
  parentRecordId,
  entryValues,
}) {
  const attioResponse = await fetch(`${ATTIO_LIST_ENTRY_URL}/${listId}/entries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.ATTIO_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        parent_record_id: parentRecordId,
        parent_object: parentObject,
        entry_values: entryValues,
      },
    }),
  });
  const attioText = await attioResponse.text();
  const attioData = safeJson(attioText);

  if (!attioResponse.ok) {
    const error = new Error("Failed to create Attio demo request entry");
    error.status = attioResponse.status;
    error.details = attioData;
    throw error;
  }

  return attioData;
}
async function upsertAttioCompany({ env, domain, name }) {
  const values = {
    domains: [{ domain }],
  };
  const companyName = normalizeOptionalText(name, 256);

  if (companyName) {
    values.name = [{ value: companyName }];
  }

  const response = await fetch(ATTIO_COMPANIES_UPSERT_URL, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.ATTIO_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        values,
      },
    }),
  });
  const text = await response.text();
  const data = safeJson(text);

  if (!response.ok) {
    const error = new Error("Failed to upsert Attio company");
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}
async function resolveAttioDemoRequestParent({
  env,
  listId,
  personRecordId,
  companyRecordId,
}) {
  const explicitParentObject = normalizeAttioSlug(
    env.ATTIO_DEMO_REQUEST_PARENT_OBJECT,
  );
  const parentObjects = explicitParentObject
    ? [explicitParentObject]
    : await getAttioListParentObjects({ env, listId });

  if (parentObjects.includes("people") && personRecordId) {
    return {
      parentObject: "people",
      parentRecordId: personRecordId,
    };
  }

  if (parentObjects.includes("companies") && companyRecordId) {
    return {
      parentObject: "companies",
      parentRecordId: companyRecordId,
    };
  }

  return null;
}
async function getAttioListParentObjects({ env, listId }) {
  const response = await fetch(`${ATTIO_LIST_ENTRY_URL}/${listId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.ATTIO_API_TOKEN}`,
      Accept: "application/json",
    },
  });
  const text = await response.text();
  const data = safeJson(text);

  if (!response.ok) {
    const error = new Error("Failed to get Attio list");
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return (Array.isArray(data?.data?.parent_object)
    ? data.data.parent_object
    : []
  )
    .map(normalizeAttioSlug)
    .filter(Boolean);
}
async function listAttioAttributeSlugs({ env, target, identifier }) {
  const response = await fetch(
    `${ATTIO_ATTRIBUTES_URL}/${target}/${identifier}/attributes?limit=200`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.ATTIO_API_TOKEN}`,
        Accept: "application/json",
      },
    },
  );
  const text = await response.text();
  const data = safeJson(text);

  if (!response.ok) {
    const error = new Error("Failed to list Attio attributes");
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return new Set(
    (Array.isArray(data?.data) ? data.data : [])
      .filter((attribute) => attribute?.is_writable !== false)
      .map((attribute) => normalizeAttioSlug(attribute?.api_slug))
      .filter(Boolean),
  );
}
function filterAttioValuesByAttributes(values, attributeSlugs) {
  return Object.entries(values).reduce(
    (filteredValues, [key, value]) => {
      if (attributeSlugs.has(key)) {
        filteredValues[key] = value;
      }

      return filteredValues;
    },
    {},
  );
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
function parseIncomingBody(rawBody, contentType = "") {
  if (!rawBody) return {};

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}
function extractWebflowFormFields(body) {
  const candidates = [
    body?.payload?.data,
    body?.payload?.formData,
    body?.payload?.fields,
    body?.data,
    body?.formData,
    body?.fields,
    body?.submission?.data,
    body,
  ];

  for (const candidate of candidates) {
    const formFields = normalizeFormFields(candidate);
    if (Object.keys(formFields).length > 0) {
      return formFields;
    }
  }

  return {};
}
function normalizeFormFields(value) {
  if (Array.isArray(value)) {
    return value.reduce((fields, item) => {
      if (!isPlainObject(item)) return fields;

      const key = normalizeOptionalText(
        item.name ?? item.label ?? item.slug ?? item.id,
        256,
      );
      const fieldValue = normalizeFieldValue(item.value ?? item.text);

      if (key && fieldValue) {
        fields[key] = fieldValue;
      }

      return fields;
    }, {});
  }

  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce((fields, [rawKey, rawValue]) => {
    const key = normalizeWebflowFieldKey(rawKey);
    const fieldValue = normalizeFieldValue(rawValue);

    if (fieldValue) {
      fields[key] = fieldValue;
    }

    return fields;
  }, {});
}
function normalizeWebflowFieldKey(key) {
  const normalizedKey = normalizeOptionalText(key, 256);
  const fieldMatch = normalizedKey.match(/^fields\[(.*)\]$/);
  if (!fieldMatch) return normalizedKey;

  try {
    return decodeURIComponent(fieldMatch[1]);
  } catch {
    return fieldMatch[1];
  }
}
function normalizeFieldValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFieldValue).filter(Boolean).join(", ");
  }

  if (isPlainObject(value) && "value" in value) {
    return normalizeFieldValue(value.value);
  }

  return "";
}
function buildWebflowSubmissionContext(formFields, body) {
  const pageUrl = normalizeUrl(
    body?.payload?.pageUrl ||
      pickFormField(formFields, [
        "page url",
        "page",
        "source url",
        "source",
        "landing page",
      ]),
  );
  const sourcePage = pageUrl || normalizeOptionalText(body?.payload?.pageUrl, 1024);
  const submittedAt =
    normalizeTimestamp(body?.payload?.submittedAt || body?.submittedAt) ||
    new Date().toISOString();

  return {
    formName: normalizeOptionalText(
      body?.payload?.name ??
        body?.payload?.formName ??
        body?.name ??
        body?.formName,
      256,
    ),
    sourcePage,
    submittedAt,
    companyName: normalizeOptionalText(
      pickFormField(formFields, [
        "company",
        "company name",
        "organization",
        "organisation",
      ]),
      256,
    ),
    companyWebsite: normalizeUrl(
      pickFormField(formFields, [
        "company website",
        "company domain",
        "website",
        "domain",
        "work website",
      ]),
    ),
    country: normalizeOptionalText(
      pickFormField(formFields, ["country", "country name", "location"]),
      256,
    ),
    expectedCallVolume: normalizeOptionalText(
      pickFormField(formFields, [
        "expected call volume",
        "call volume",
        "expected volume",
      ]),
      256,
    ),
    useCase: normalizeOptionalText(
      pickFormField(formFields, [
        "tell us about your use case",
        "use case",
        "message",
        "comments",
        "comment",
        "notes",
        "description",
      ]),
      5000,
    ),
    webflowSubmissionId: normalizeOptionalText(
      body?.payload?.id ?? body?.id,
      128,
    ),
    webflowFormId: normalizeOptionalText(
      body?.payload?.formId ?? body?.formId,
      128,
    ),
    tracking: buildTrackingValues(formFields, pageUrl, body),
  };
}
function buildTrackingValues(formFields, pageUrl, body) {
  return {
    utmSource: pickTrackingValue(formFields, pageUrl, [
      "utm_source",
      "utm source",
      "UTM Source",
    ]),
    utmMedium: pickTrackingValue(formFields, pageUrl, [
      "utm_medium",
      "utm medium",
      "UTM Medium",
    ]),
    utmCampaign: pickTrackingValue(formFields, pageUrl, [
      "utm_campaign",
      "utm campaign",
      "UTM Campaign",
    ]),
    utmContent: pickTrackingValue(formFields, pageUrl, [
      "utm_content",
      "utm content",
      "UTM Content",
    ]),
    utmTerm: pickTrackingValue(formFields, pageUrl, [
      "utm_term",
      "utm term",
      "UTM Term",
    ]),
    referrer: normalizeUrl(
      pickFormField(formFields, [
        "referrer",
        "referer",
        "document referrer",
        "previous page",
      ]) ||
        body?.payload?.referrer ||
        body?.referrer,
    ),
    landingPage: normalizeUrl(
      pickFormField(formFields, [
        "landing page",
        "landing_page",
        "first page",
        "first touch page",
      ]) ||
        body?.payload?.landingPage ||
        body?.landingPage,
    ),
  };
}
function pickTrackingValue(formFields, pageUrl, labels) {
  const fieldValue = normalizeOptionalText(pickFormField(formFields, labels), 512);
  if (fieldValue) return fieldValue;

  const queryParamName = labels[0];
  return normalizeOptionalText(getUrlQueryParam(pageUrl, queryParamName), 512);
}
function getUrlQueryParam(value, key) {
  const url = normalizeUrl(value);
  if (!url) return "";

  try {
    return new URL(url).searchParams.get(key) || "";
  } catch {
    return "";
  }
}
function buildAttioPersonValues(formFields, body, env, submissionContext) {
  const values = {};
  const email = normalizeEmail(
    pickFormField(formFields, [
      "email",
      "email address",
      "work email",
      "business email",
      "your email",
    ]) || findEmailValue(formFields),
  );
  const name = buildAttioNameValue(formFields);
  const phoneNumber = normalizePhoneNumber(
    pickFormField(formFields, [
      "phone",
      "phone number",
      "mobile",
      "mobile number",
      "tel",
      "telephone",
    ]),
    normalizeDefaultCountryCode(env.ATTIO_DEFAULT_COUNTRY_CODE),
  );
  const companyDomain = normalizeDomain(
    pickFormField(formFields, [
      "company domain",
      "company website",
      "website",
      "domain",
      "work website",
    ]),
  );
  const jobTitle = normalizeOptionalText(
    pickFormField(formFields, ["job title", "title", "role"]),
    256,
  );
  const linkedin = normalizeUrl(
    pickFormField(formFields, ["linkedin", "linkedin url", "linkedin profile"]),
  );
  const description = buildAttioDescription(formFields, body);
  const personFieldSlugs = getAttioPersonFieldSlugs(env);

  if (email) values.email_addresses = [{ email_address: email }];
  if (name) values.name = [name];
  if (phoneNumber) {
    values.phone_numbers = [{ original_phone_number: phoneNumber }];
  }
  if (companyDomain) {
    values.company = [
      {
        target_object: "companies",
        domains: [{ domain: companyDomain }],
      },
    ];
  }
  if (jobTitle) values.job_title = [{ value: jobTitle }];
  if (linkedin) values.linkedin = [{ value: linkedin }];
  if (description) values.description = [{ value: description }];
  addAttioTextValue(values, personFieldSlugs.country, submissionContext.country);
  addAttioTextValue(
    values,
    personFieldSlugs.sourcePage,
    submissionContext.sourcePage,
  );
  addAttioTextValue(
    values,
    personFieldSlugs.latestFormSubmitted,
    submissionContext.formName,
  );
  addAttioTimestampValue(
    values,
    personFieldSlugs.latestDemoRequestAt,
    submissionContext.submittedAt,
  );
  addAttioTextValue(
    values,
    personFieldSlugs.companyName,
    submissionContext.companyName,
  );

  return values;
}
function buildAttioDemoRequestEntryValues(submissionContext, env) {
  const slugs = getAttioDemoRequestFieldSlugs(env);
  const values = {};

  addAttioTextValue(
    values,
    slugs.status,
    normalizeOptionalText(env.ATTIO_DEMO_REQUEST_DEFAULT_STATUS, 128) || "New",
  );
  addAttioTimestampValue(values, slugs.submittedAt, submissionContext.submittedAt);
  addAttioTextValue(values, slugs.useCase, submissionContext.useCase);
  addAttioTextValue(
    values,
    slugs.expectedCallVolume,
    submissionContext.expectedCallVolume,
  );
  addAttioTextValue(values, slugs.country, submissionContext.country);
  addAttioTextValue(values, slugs.sourcePage, submissionContext.sourcePage);
  addAttioTextValue(values, slugs.formName, submissionContext.formName);
  addAttioTextValue(
    values,
    slugs.webflowSubmissionId,
    submissionContext.webflowSubmissionId,
  );
  addAttioTextValue(values, slugs.webflowFormId, submissionContext.webflowFormId);
  addAttioTextValue(values, slugs.companyName, submissionContext.companyName);
  addAttioTextValue(values, slugs.companyWebsite, submissionContext.companyWebsite);
  addAttioTextValue(values, slugs.utmSource, submissionContext.tracking.utmSource);
  addAttioTextValue(values, slugs.utmMedium, submissionContext.tracking.utmMedium);
  addAttioTextValue(
    values,
    slugs.utmCampaign,
    submissionContext.tracking.utmCampaign,
  );
  addAttioTextValue(values, slugs.utmContent, submissionContext.tracking.utmContent);
  addAttioTextValue(values, slugs.utmTerm, submissionContext.tracking.utmTerm);
  addAttioTextValue(values, slugs.referrer, submissionContext.tracking.referrer);
  addAttioTextValue(
    values,
    slugs.landingPage,
    submissionContext.tracking.landingPage,
  );

  return values;
}
function addAttioTextValue(values, slug, value) {
  const normalizedSlug = normalizeAttioSlug(slug);
  const normalizedValue = normalizeOptionalText(value, 5000);
  if (normalizedSlug && normalizedValue) {
    values[normalizedSlug] = normalizedValue;
  }
}
function addAttioTimestampValue(values, slug, value) {
  const normalizedSlug = normalizeAttioSlug(slug);
  const normalizedValue = normalizeTimestamp(value);
  if (normalizedSlug && normalizedValue) {
    values[normalizedSlug] = normalizedValue;
  }
}
function normalizeTimestamp(value) {
  const normalized = normalizeOptionalText(value, 64);
  if (!normalized) return "";

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString();
}
function getAttioPersonFieldSlugs(env) {
  const overrides = parseJsonObject(env.ATTIO_PERSON_FIELD_SLUGS);

  return {
    country:
      normalizeAttioSlug(env.ATTIO_PERSON_COUNTRY_ATTRIBUTE) ||
      normalizeAttioSlug(overrides.country) ||
      DEFAULT_ATTIO_PERSON_FIELD_SLUGS.country,
    sourcePage:
      normalizeAttioSlug(env.ATTIO_PERSON_SOURCE_PAGE_ATTRIBUTE) ||
      normalizeAttioSlug(overrides.sourcePage) ||
      DEFAULT_ATTIO_PERSON_FIELD_SLUGS.sourcePage,
    latestFormSubmitted:
      normalizeAttioSlug(env.ATTIO_PERSON_LATEST_FORM_SUBMITTED_ATTRIBUTE) ||
      normalizeAttioSlug(overrides.latestFormSubmitted) ||
      DEFAULT_ATTIO_PERSON_FIELD_SLUGS.latestFormSubmitted,
    latestDemoRequestAt:
      normalizeAttioSlug(env.ATTIO_PERSON_LATEST_DEMO_REQUEST_AT_ATTRIBUTE) ||
      normalizeAttioSlug(overrides.latestDemoRequestAt) ||
      DEFAULT_ATTIO_PERSON_FIELD_SLUGS.latestDemoRequestAt,
    companyName:
      normalizeAttioSlug(env.ATTIO_PERSON_COMPANY_NAME_ATTRIBUTE) ||
      normalizeAttioSlug(overrides.companyName) ||
      DEFAULT_ATTIO_PERSON_FIELD_SLUGS.companyName,
  };
}
function getAttioDemoRequestFieldSlugs(env) {
  const overrides = parseJsonObject(env.ATTIO_DEMO_REQUEST_FIELD_SLUGS);

  return Object.entries(DEFAULT_ATTIO_DEMO_REQUEST_FIELD_SLUGS).reduce(
    (slugs, [key, defaultSlug]) => {
      slugs[key] =
        normalizeAttioSlug(overrides[key]) || normalizeAttioSlug(defaultSlug);
      return slugs;
    },
    {},
  );
}
function getAttioDemoRequestListId(env) {
  return normalizeOptionalText(
    env.ATTIO_DEMO_REQUEST_LIST_ID || env.ATTIO_DEMO_REQUEST_LIST,
    128,
  );
}
function normalizeAttioSlug(value) {
  if (typeof value !== "string") return "";
  const slug = value.trim();

  return /^[a-zA-Z0-9_-]+$/.test(slug) ? slug : "";
}
function parseJsonObject(value) {
  if (typeof value !== "string" || !value.trim()) return {};

  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function buildAttioNameValue(formFields) {
  const suppliedFullName = normalizeNamePart(
    pickFormField(formFields, ["name", "full name", "your name"]),
    256,
  );
  let firstName = normalizeNamePart(
    pickFormField(formFields, ["first name", "firstname"]),
    128,
  );
  let lastName = normalizeNamePart(
    pickFormField(formFields, ["last name", "lastname", "surname"]),
    128,
  );

  if (suppliedFullName && (!firstName || !lastName)) {
    const splitName = splitFullName(suppliedFullName);
    firstName = firstName || splitName.firstName;
    lastName = lastName || splitName.lastName;
  }

  // Attio's object syntax requires all three properties to be non-null.
  // For mononyms or partial form data, reuse the available name rather than
  // rejecting the submission or sending null values.
  const nameFallback = firstName || lastName || suppliedFullName;
  firstName = firstName || nameFallback;
  lastName = lastName || nameFallback;

  if (!nameFallback || !firstName || !lastName) {
    return null;
  }

  const resolvedFullName =
    suppliedFullName ||
    [firstName, lastName]
      .filter(Boolean)
      .filter((part, index, parts) => index === 0 || part !== parts[index - 1])
      .join(" ");

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: resolvedFullName,
  };
}
function splitFullName(value) {
  const normalizedValue = normalizeNamePart(value, 256);
  const commaIndex = normalizedValue.indexOf(",");

  // Match Attio's documented "Last, First" convention when supplied.
  if (commaIndex > 0 && commaIndex < normalizedValue.length - 1) {
    return {
      firstName: normalizeNamePart(normalizedValue.slice(commaIndex + 1), 128),
      lastName: normalizeNamePart(normalizedValue.slice(0, commaIndex), 128),
    };
  }

  const parts = normalizedValue.split(" ");
  if (parts.length < 2) {
    return { firstName: parts[0] || "", lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}
function normalizeNamePart(value, maxLength) {
  return normalizeOptionalText(value, maxLength).replace(/\s+/g, " ");
}
function buildAttioDescription(formFields, body) {
  const lines = ["Webflow form submission"];
  const formName = normalizeOptionalText(
    body?.payload?.name ??
      body?.payload?.formName ??
      body?.name ??
      body?.formName,
    256,
  );
  const pageUrl = normalizeUrl(
    pickFormField(formFields, [
      "page url",
      "page",
      "source url",
      "source",
      "referrer",
    ]) || body?.payload?.pageUrl,
  );
  const message = normalizeOptionalText(
    pickFormField(formFields, [
      "message",
      "comments",
      "comment",
      "notes",
      "description",
      "use case",
      "tell us about your use case",
    ]),
    2000,
  );
  const fieldSummary = Object.entries(formFields)
    .filter(([key]) => !isSensitiveFormField(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  if (formName) lines.push(`Form: ${formName}`);
  if (pageUrl) lines.push(`Page: ${pageUrl}`);
  if (message) lines.push(`Message: ${message}`);
  if (fieldSummary) lines.push("", fieldSummary);

  return lines.join("\n").trim().slice(0, 5000);
}
function pickFormField(fields, labels) {
  const normalizedFields = Object.entries(fields).map(([key, value]) => ({
    key,
    normalizedKey: normalizeFormKey(key),
    value,
  }));

  for (const label of labels) {
    const normalizedLabel = normalizeFormKey(label);
    const match = normalizedFields.find(
      (field) => field.normalizedKey === normalizedLabel,
    );

    if (match?.value) {
      return match.value;
    }
  }

  return "";
}
function findEmailValue(fields) {
  for (const value of Object.values(fields)) {
    const match = value.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (match) {
      return match[0];
    }
  }

  return "";
}
function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}
function normalizeDomain(value) {
  if (typeof value !== "string") return "";
  const withoutProtocol = value.trim().replace(/^https?:\/\//i, "");
  const hostname = withoutProtocol.split("/")[0].replace(/^www\./i, "");

  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)
    ? hostname.toLowerCase()
    : "";
}
function normalizeUrl(value) {
  if (typeof value !== "string") return "";
  const url = value.trim();

  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url.slice(0, 1024);
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(url))
    return `https://${url}`.slice(0, 1024);

  return "";
}
function normalizeFormKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function isSensitiveFormField(key) {
  const normalizedKey = normalizeFormKey(key);
  return (
    normalizedKey.includes("password") ||
    normalizedKey.includes("token") ||
    normalizedKey.includes("secret")
  );
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function validateWebflowWebhookRequest(request, env, rawBody) {
  const expectedSecret = normalizeOptionalText(env.WEBFLOW_WEBHOOK_SECRET, 512);
  if (!expectedSecret) return { valid: false, reason: "missing_webhook_secret" };

  const signature = normalizeOptionalText(
    request.headers.get("x-webflow-signature"),
    256,
  );
  const timestamp = normalizeOptionalText(
    request.headers.get("x-webflow-timestamp"),
    64,
  );

  if (signature || timestamp) {
    return validateWebflowSignature({
      secret: expectedSecret,
      timestamp,
      rawBody,
      signature,
    });
  }

  return {
    valid: isLegacyWebhookSecretAllowed(request, expectedSecret),
    reason: "missing_webflow_signature",
  };
}
async function validateWebflowSignature({
  secret,
  timestamp,
  rawBody,
  signature,
}) {
  if (!timestamp) return { valid: false, reason: "missing_webflow_timestamp" };
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return { valid: false, reason: "invalid_webflow_signature_format" };
  }

  const requestTimestamp = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(requestTimestamp)) {
    return { valid: false, reason: "invalid_webflow_timestamp" };
  }

  const requestAgeMs = Date.now() - requestTimestamp;
  if (requestAgeMs > 300000 || requestAgeMs < -300000) {
    return { valid: false, reason: "stale_webflow_timestamp" };
  }

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(`${requestTimestamp}:${rawBody}`),
  );
  const expectedSignature = arrayBufferToHex(digest);

  return {
    valid: timingSafeEqualHex(expectedSignature, signature),
    reason: "invalid_webflow_signature",
  };
}
function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function timingSafeEqualHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}
function isLegacyWebhookSecretAllowed(request, expectedSecret) {
  const url = new URL(request.url);
  const providedSecret =
    normalizeOptionalText(request.headers.get("X-Webhook-Secret"), 512) ||
    normalizeOptionalText(
      request.headers.get("X-Webflow-Webhook-Secret"),
      512,
    ) ||
    normalizeOptionalText(url.searchParams.get("secret"), 512);

  return providedSecret === expectedSecret;
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
function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export { buildAttioNameValue, splitFullName };
