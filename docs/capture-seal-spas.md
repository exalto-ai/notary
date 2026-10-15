# Capture and public website

`platform/web` is the Capture site: the landing page, docs and legal pages
(the public pages, DESIGN.md Part IIB), and the account overview, usage and
billing, hosted Trace management, device approval and sign-in under `/app`,
`/signin` and `/authorize` (Part IIC). It does not repeat the exalto.ai story
and has no public Trace/Registry/verifier routes.

The public pages are prerendered at build time (`scripts/prerender.mjs`, from
the SSR entry `src/site/prerender.tsx`): a fetch of `/docs/getting-started`
returns the page's content without running any script, and the client
hydrates it. The same render produces a Markdown twin of every public page at
the same address with `.md` added, `llms.txt` (the index, kept in `public/`)
and `llms-full.txt` (the whole site in one file), and `sitemap.xml`. A request
with `Accept: text/markdown` is redirected to the twin. The account routes
are served from `_shell.html`, the empty build output, and render on the
client. `scripts/check-agent-files.mjs` verifies all of it in every build.

The sibling `website` repository owns the exalto.ai marketing page and public
`/traces`, `/s/{trace_id}`, `/registry`, and `/verify` routes. Public tools do
not initialize an account session. Sharing publishes only packages admitted
by the API's verification and safety review; the public verifier still
requires disclosure consent before uploading a package.

Both sites use `VITE_API_ORIGIN` (production: `https://api.exalto.ai`). JSON and
package requests go directly to the API with host-only cookies and explicit
credentialed CORS. OAuth navigation also goes directly to the API. Vercel's
rewrite to `_shell.html` serves deep account routes; it does not forward API
requests.

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
