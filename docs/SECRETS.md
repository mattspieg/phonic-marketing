# Secrets and runtime configuration

This file records secret names and ownership only. It must never contain secret values.

## Phonic Worker secrets (`phonic-session-token`)

| Name | Required when | Owner/source |
| --- | --- | --- |
| `PHONIC_API_KEY` | Always: session-token and outbound-call endpoints | Client Phonic account |
| `PHONIC_SIP_ADDRESS` | `PHONIC_OUTBOUND_MODE="sip"` | Client telephony configuration |
| `PHONIC_FROM_PHONE_NUMBER` | `PHONIC_OUTBOUND_MODE="sip"` | Client telephony configuration |
| `PHONIC_SIP_AUTH_USERNAME` | The SIP provider requires authentication | Client telephony provider |
| `PHONIC_SIP_AUTH_PASSWORD` | The SIP provider requires authentication | Client telephony provider |

The current configuration uses managed outbound calling, so the SIP values are not required unless that mode changes.

## Attio Worker secrets (`phonic-attio-webhook`)

| Name | Required when | Owner/source |
| --- | --- | --- |
| `ATTIO_API_TOKEN` | The Webflow-to-Attio webhook is enabled | Client Attio account |
| `WEBFLOW_WEBHOOK_SECRET` | The Webflow-to-Attio webhook is enabled | Matching client Webflow webhook secret |

## Non-secret variables

The following current production values are declared in the matching Wrangler config files and are safe to version:

Phonic Worker (`wrangler.toml`):

- `ALLOWED_ORIGIN`
- `PHONIC_DEFAULT_COUNTRY_CODE`
- `PHONIC_OUTBOUND_MODE`
- `PHONIC_WAIT_FOR_OUTBOUND_RESPONSE` (optional override)

Attio Worker (`wrangler.attio.toml`):

- `ATTIO_DEFAULT_COUNTRY_CODE`
- `ATTIO_DEMO_REQUEST_LIST_ID`
- `ATTIO_DEMO_REQUEST_DEFAULT_STATUS`
- Optional Attio field-slug overrides supported by `src/attio.js`

## Setting production secrets

First authenticate and confirm that Wrangler shows the client-owned account:

```bash
npm run cloudflare:whoami
```

After each Worker exists, set only the secrets belonging to that Worker:

```bash
npx wrangler secret put PHONIC_API_KEY --config wrangler.toml
npx wrangler secret list --config wrangler.toml

npx wrangler secret put ATTIO_API_TOKEN --config wrangler.attio.toml
npx wrangler secret put WEBFLOW_WEBHOOK_SECRET --config wrangler.attio.toml
npx wrangler secret list --config wrangler.attio.toml
```

For SIP mode, repeat `wrangler secret put` with `--config wrangler.toml` for the applicable SIP names.

Do not paste secret values into issues, pull requests, chat messages, shell command arguments, GitHub build variables, or committed files. The safest handover is for the client to enter them directly under the matching Worker's **Settings > Variables & Secrets**, or paste them only into Wrangler's interactive hidden prompt.

Cloudflare can list configured secret names but does not return their values. The client should create or rotate fresh credentials rather than rely on recovering credentials from the previous deployment.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and add local values. The resulting `.dev.vars` file is ignored by Git.
