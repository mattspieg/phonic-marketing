# Phonic Marketing

Source files and deployment assets for the interactive components and integrations used by the Phonic marketing site.

This repository is the source of truth, but it is not the complete Webflow website. Webflow Code Components are uploaded to Webflow separately from the Cloudflare deployments.

## Deliverables

| Area | Source | Destination |
| --- | --- | --- |
| Live voice demo | `src/webflow-ai-components/PhonicLiveConversation.tsx` | Webflow Code Component |
| Multilingual playback | `src/webflow-ai-components/PhonicMultiLanguagePlayback.tsx` | Webflow Code Component |
| Mixed form/code tabs | `src/webflow-ai-components/PhonicMixedFormCodeTabs.tsx` | Webflow Code Component |
| Phonic API | `src/phonic-api.js` | Cloudflare Worker `phonic-session-token` |
| Webflow-to-Attio webhook | `src/attio.js` | Cloudflare Worker `phonic-attio-webhook` |
| CSS, JavaScript, audio, images, and video | `static-assets/public/` | Cloudflare Pages |

The three Webflow `.tsx` files are standalone components. They do not depend on one another or on local shared component files.

## Requirements

- Node.js 22 or later
- npm
- A Cloudflare account membership with access to Workers and Pages for deployment

## Local setup

```bash
npm ci
npm run verify
```

For local Worker secrets, copy `.dev.vars.example` to `.dev.vars` and fill in local-only values. `.dev.vars` is ignored by Git.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite environment |
| `npm run typecheck` | Type-check the Webflow TypeScript components |
| `npm run check:worker` | Check the Phonic Worker JavaScript syntax |
| `npm run check:attio` | Check the Attio Worker JavaScript syntax |
| `npm run verify` | Type-check components, check both Worker entrypoints, and run the Attio tests |
| `npm run cloudflare:whoami` | Confirm the authenticated Cloudflare user and account before deploying |
| `npm run deploy:worker` | Verify and deploy `phonic-session-token` from `wrangler.toml` |
| `npm run deploy:attio` | Verify and deploy `phonic-attio-webhook` from `wrangler.attio.toml` |
| `npm run deploy:assets` | Manually deploy `static-assets/public` to the Pages project |

Always inspect `npm run cloudflare:whoami` before a deployment. Do not deploy until it shows the intended client-owned Cloudflare account.

## Configuration and secrets

Non-secret production configuration is stored in `wrangler.toml` and `wrangler.attio.toml`. Production secret values must be added directly to the matching client-owned Cloudflare Worker and must never be committed.

See [docs/SECRETS.md](docs/SECRETS.md) for the secret inventory and [docs/HANDOVER.md](docs/HANDOVER.md) for the ownership transfer, deployment, URL cutover, testing, and rollback procedure.
