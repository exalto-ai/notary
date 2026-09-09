# Capture and public website

`platform/web` is the Capture SPA: account overview, usage and billing, hosted
Trace management, device approval, sign-in, docs, and legal pages. Its root
opens the account overview or sign-in. It has no duplicate marketing landing
page or public Trace/Registry/verifier routes.

The sibling `website` repository owns the exalto.ai marketing page and public
`/traces`, `/s/{trace_id}`, `/registry`, and `/verify` routes. Public tools do
not initialize an account session. Sharing publishes only packages admitted
by the API's verification and safety review; the public verifier still
requires disclosure consent before uploading a package.

Both sites use `VITE_API_ORIGIN` (production: `https://api.exalto.ai`). JSON and
package requests go directly to the API with host-only cookies and explicit
credentialed CORS. OAuth navigation also goes directly to the API. Vercel's
local HTML fallback serves deep SPA routes; it does not forward API requests.

## Local development

Run `npm --prefix platform/web run dev:capture` and `npm --prefix ../website
run dev`. Capture uses localhost:4174, the website uses localhost:4175, and both
call localhost:8080. Set API `NOTARY_CAPTURE_PUBLIC_ORIGIN` and
`NOTARY_WEBSITE_PUBLIC_ORIGIN` to these exact origins (the local defaults).
Do not mix `127.0.0.1` and `localhost` when testing cookies.

For safe UI previews without a database, run `npm --prefix platform/web run
preview:capture` and `npm --prefix ../website run dev:sample`. Sample mode is
explicitly labeled, uses synthetic traces, and rejects all writes. It is
excluded from production builds.

The website commits its generated API contract. After changing backend routes,
run `npm --prefix platform/web run generate:platform-api`, then the website's
`npm run sync:api -- /absolute/path/to/notary/platform/web/src/platform-api/generated`.
Neither production build depends on a sibling checkout.

See [deployment](../deploy/fly/README.md) for Vercel, DNS, OAuth, and Fly setup.
