# Hosted deployment

Vercel serves `capture.exalto.ai` from `platform/web` and `exalto.ai` from the
separate website repository. Fly serves `api.exalto.ai` directly from
`llm-notary-prod-api` and the protocol endpoint from `llm-notary-prod-server`.
There is no web gateway, frontend API proxy, or hostname redirect.

## API configuration

Keep the existing PostgreSQL, private Trace bucket, OAuth, Stripe, Registry,
admission, and signing-key secrets. The API config defines three independent
origins:

- `NOTARY_API_PUBLIC_ORIGIN=https://api.exalto.ai`: OAuth callbacks and browser API.
- `NOTARY_CAPTURE_PUBLIC_ORIGIN=https://capture.exalto.ai`: device approval, billing returns, sign-in return routes.
- `NOTARY_WEBSITE_PUBLIC_ORIGIN=https://exalto.ai`: public `/s/{trace_id}` links.

Browser requests include credentials. CORS permits these exact origins plus
`NOTARY_API_ADDITIONAL_BROWSER_ORIGINS`, configured as `https://www.exalto.ai`
for the existing marketing domain.
Untrusted origins and cookie-authenticated writes without an allowed Origin
receive `403 browser_origin_denied`. Native bearer clients need no Origin.
Cookies remain host-only on the API. Do not wildcard Vercel preview domains;
use sample mode or a separately configured staging API with matching origins.

`Fly-Client-IP` is trusted only when the socket peer belongs to the configured
Fly proxy CIDRs. Other forwarded client-address headers are ignored. Metrics
use a separate private port 9090; only port 8080 is exposed by Fly Proxy.
Both API Machines remain running. The notary calls
`http://llm-notary-prod-api.internal:8080` over the private network, bypassing
Flycast's HTTP-only routing and the public HTTPS redirect.

## Initial domain cutover

1. Allocate public addresses and request the API certificate:
   ```sh
   flyctl ips allocate-v4 --shared -a llm-notary-prod-api
   flyctl ips allocate-v6 -a llm-notary-prod-api
   flyctl certs add api.exalto.ai -a llm-notary-prod-api
   flyctl certs setup api.exalto.ai -a llm-notary-prod-api
   ```
   Add the DNS records returned by Fly, then check the certificate with
   `flyctl certs check api.exalto.ai -a llm-notary-prod-api`.
2. Register `https://api.exalto.ai/api/auth/google/callback` and, if enabled,
   `https://api.exalto.ai/api/auth/github/callback` with the OAuth providers.
   Point Stripe's webhook to `https://api.exalto.ai/api/billing/stripe/webhook`.
3. Deploy the API before the notary through the Fly deployment workflow.
   The API must listen on `[::]:8080` before the notary switches to `.internal`. Check `/api/readyz`, `/api/registry`, browser sign-in, device
   approval, billing returns, and private admission/settlement.
4. In Vercel, create a Capture project with root directory `platform/web`,
   install `npm ci`, build `npm run build:site`, output `dist`. Assign
   `capture.exalto.ai`. The website project keeps its own root/build settings.
   Both default to `VITE_API_ORIGIN=https://api.exalto.ai`.
5. Allow GET and HEAD from `https://capture.exalto.ai` on the public downloads
   bucket (`notary-prod-downloads`). Release metadata and artifacts are served
   directly from `https://notary-prod-downloads.t3.tigrisfiles.io/releases`.
   Publish a release using the new URL configuration; old signed manifests
   cannot be edited without invalidating their signatures.
6. After the new targets pass the checks above, remove the old web app and its
   DNS records. No redirects are required. Do not delete the API/notary apps,
   private buckets, database, outbox volume, or signing keys.

## Rollouts and rollback

`.github/workflows/deploy.yml` accepts a validated main SHA or a successful
rollout run. It builds and records digest-pinned API and notary images, runs
forward database migrations before replacing API Machines, checks readiness
and the notary TLS path, and records a `notary/production-rollout/v2` manifest.
On failure it restores attempted images and their saved live configuration,
starting with the notary before the API. Requested rollback uses a recorded
v2 image set and skips old release commands. Never run a down-migration as
part of rollback. Frontend deployments and rollbacks are managed in Vercel.

Before deployment, run the relevant checks in `AGENTS.md`, validate both Fly
configs, and validate Compose with placeholder required variables. Database
backup/recovery remains documented in
[database operations](../../docs/database-operations.md).
