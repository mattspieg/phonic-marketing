# Client handover

## Target ownership

At completion, the client should own:

- The GitHub repository and branch controls
- The Cloudflare account, both Workers (`phonic-session-token` and `phonic-attio-webhook`), Pages project, billing, and GitHub App installation
- The Phonic, Attio, and Webflow credentials
- The Webflow site, Code Components, custom code, and webhook configuration

Repository ownership alone does not transfer deployed services, secrets, URLs, domains, or billing.

## One-time client actions

1. Use or create the client-owned Cloudflare account.
2. In Cloudflare, open **Manage Account > Members**, invite the implementation user, and assign **Workers Platform Admin**. Super Administrator is not required.
3. In **Workers & Pages**, create/connect one Worker project for each Wrangler config in this repository, authorize the Cloudflare GitHub App, and restrict its installation to this repository only.
4. Confirm the repository's default production branch is `main`.

Useful Cloudflare documentation:

- Account members: <https://developers.cloudflare.com/fundamentals/manage-members/manage/>
- Account roles: <https://developers.cloudflare.com/fundamentals/manage-members/roles/>
- Workers Git integration: <https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/>
- Pages Git integration: <https://developers.cloudflare.com/pages/configuration/git-integration/>

## What Wrangler can automate

After the Cloudflare invitation is accepted, `npm run cloudflare:whoami` must show the client-owned account.

Wrangler can then:

- Create either Worker on the first deploy when the matching config is used
- Deploy new versions and perform rollbacks for each Worker
- Set and list secrets per Worker
- Create and deploy a Direct Upload Pages project
- List project deployments and configured secret names

Wrangler does not perform the client's GitHub App authorization. Native Git-connected Pages creation is best completed through the Cloudflare dashboard after that authorization. Creating Pages with `wrangler pages project create` creates a Direct Upload project, which cannot later be converted to native Git integration.

## Recommended deployment setup

### Phonic API Worker

Create or connect a Worker named `phonic-session-token`:

- Repository: this repository
- Root directory: `/`
- Wrangler config: `wrangler.toml`
- Production branch: `main`
- Build command: `npm run verify`
- Deploy command: `npx wrangler deploy --config wrangler.toml`

For a CLI-first initial deployment:

```bash
npm ci
npm run cloudflare:whoami
npm run deploy:worker
```

### Attio webhook Worker

Create or connect a separate Worker named `phonic-attio-webhook`:

- Repository: this repository
- Root directory: `/`
- Wrangler config: `wrangler.attio.toml`
- Production branch: `main`
- Build command: `npm run verify`
- Deploy command: `npx wrangler deploy --config wrangler.attio.toml`
- Webhook route: `/api/webflow/attio-person`

For a CLI-first initial deployment:

```bash
npm run cloudflare:whoami
npm run deploy:attio
```

Add only the Attio and Webflow webhook secrets listed in [SECRETS.md](SECRETS.md) to this Worker.

### Static assets

Recommended native Git-connected Pages settings:

- Repository: this repository
- Root directory: `static-assets`
- Build command: leave blank
- Build output directory: `public`
- Production branch: `main`

Manual deployment remains available after the Pages project exists:

```bash
npm run cloudflare:whoami
npm run deploy:assets
```

If native Git integration is not required, the entire Pages setup can instead be created through Wrangler:

```bash
npx wrangler pages project create phonic-static-assets
npm run deploy:assets
```

### Migration order from the current combined Worker

The previous Worker served both Phonic and Attio routes. Deploy `phonic-attio-webhook` first, move the Webflow webhook to its new URL, and verify an approved test submission. Only then deploy the updated `phonic-session-token` Worker, which intentionally no longer serves the Attio route.

## URL cutover inventory

Deploy the client-owned projects before changing the live Webflow site. Replace all old deployment URLs together:

| Consumer | Current source location | New destination |
| --- | --- | --- |
| Live conversation session token | `src/webflow-ai-components/PhonicLiveConversation.tsx` | Client Phonic Worker `/api/phonic/session-token` |
| Request-a-call default endpoint | `static-assets/public/js/request-a-call-form.js` | Client Phonic Worker `/api/phonic/outbound-call` |
| Multilingual audio samples | `src/webflow-ai-components/PhonicMultiLanguagePlayback.tsx` | Client Pages `/assets/audio/...` |
| Webflow custom-code script reference | Webflow site settings/page custom code | Client Pages `/js/request-a-call-form.js` |
| Ashby stylesheet reference | Ashby job-board configuration | Client Pages `/css/ashby-embed.css` |
| Webflow form webhook | Webflow webhook configuration | Client Attio Worker `/api/webflow/attio-person` |

Client-owned custom domains such as `api.<client-domain>` and `assets.<client-domain>` are preferable to provider-specific URLs when DNS ownership permits. They reduce future URL changes if the deployment account changes again.

## Verification and cutover

1. Run `npm ci`, `npm run verify`, and `npm audit`.
2. Deploy the Attio Worker first, move and test the Webflow webhook, then deploy the Phonic Worker and assets without changing the other production consumers.
3. Confirm the expected Worker and Pages URLs respond and inspect Cloudflare logs.
4. Add the required secrets to the matching Worker and verify each `npx wrangler secret list --config ...` shows the expected names.
5. Update the source URLs listed above and upload the revised standalone `.tsx` files to Webflow.
6. Update Webflow custom code, the Webflow webhook URL/secret, and the Ashby stylesheet URL.
7. Publish Webflow staging and test:
   - Live conversation startup, microphone permission, audio, and disconnect
   - Multilingual sample loading, playback, shuffle, and volume
   - Request-a-call form validation and an approved test call
   - Webflow-to-Attio using an approved test contact because this creates CRM data
8. Publish production and re-run the same checks.
9. Record the final URLs, deployment IDs, test date, and owner in the handover record.

## Rollback and close-out

- Keep the previous deployments of both Workers and Pages available for a short agreed rollback period.
- If the Phonic Worker fails, roll back `phonic-session-token` and restore the previous Phonic endpoint URLs.
- If the Attio Worker fails, roll back `phonic-attio-webhook` and restore the previous Webflow webhook URL.
- If static assets fail, roll back the Pages deployment or restore the previous asset URLs.
- Do not remove old deployments until the client confirms that they can access GitHub, Cloudflare, Webflow, Phonic, and Attio and can complete a deployment without the previous owner.
- After sign-off, revoke the previous account credentials and remove or reduce temporary collaborator access.
