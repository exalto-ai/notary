# Exalto landing (exalto.ai)

The marketing landing page for the Exalto Notary Protocol, built from the
`design_handoff_exalto_7a` handoff ("Record + Protocol" in Ledger Phosphor).
Static-first Vite with no framework: semantic HTML, one tokenized stylesheet,
and a small vanilla script for the contribution-history popover and the hero
ledger loop. Fully responsive; all motion is CSS and disabled under
`prefers-reduced-motion`.

This site is separate from the hosted product site in `platform/web`. Product
links point at the product origin (default `https://seal.exalto.ai`), set at
build time with `VITE_PRODUCT_ORIGIN`.

## Develop

```bash
npm ci
npm run dev        # http://127.0.0.1:4174
npm run build      # runs the copy audit, then builds dist/
npm run preview
```

`npm run check:copy` enforces the handoff QA checklist: banned vocabulary
absent (notarize, finalize, checkpoint, fingerprint claims, any API), required
doctrine strings present verbatim, live capture always badged "(coming soon)",
tile order, and no em- or en-dashes in rendered copy.

## Placeholders

- The three Proof of Thought CTAs point at the `#pot` band and the band's join
  button reads "early access · opens soon" until `POT_EARLY_ACCESS_URL` exists;
  swap the `#pot` hrefs and the button when it does.
- `favicon.svg` is a placeholder; no commissioned logo exists yet.
- No `og:image` yet (open item; suggestion: a rendered receipt card).
- The applications grid ships without art; the nine commissioned pieces land in
  the collapsed image slots later.

## Deploy (Fly, same pattern as platform/web)

```bash
fly deploy platform/landing \
  --config deploy/fly/landing.fly.toml \
  --app exalto-prod-landing
fly certs add exalto.ai --app exalto-prod-landing
```

Cutover checklist (founder-owned, in order):

1. Create the Fly app and deploy; point exalto.ai DNS at it and issue certs.
2. Add `seal.exalto.ai` as a cert/hostname on the existing web app and switch
   its `NOTARY_PUBLIC_ORIGIN`/`VITE_PUBLIC_ORIGIN` build arg when ready.
3. 301 `notary.exalto.ai` to `seal.exalto.ai` on the old hostname.
4. Update OAuth redirect URIs (Google, GitHub), the Stripe webhook URL, and the
   product site's hardcoded install command.
5. Later, move the notary endpoint hostname (`alice.notary.exalto.ai`) with a
   Registry generation bump; it keeps working unchanged until then.
