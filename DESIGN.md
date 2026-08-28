---
version: beta
name: Notary by Exalto / Axis
description: A compact evidence workspace for people who need to find, inspect, notarize, and verify LLM interactions without ceremony.
colors:
  canvas: "#FFFFFF"
  surface: "#FFFFFF"
  surface-active: "#F2F2F2"
  section-muted: "#F5F5F5"
  ink: "#101010"
  muted: "#6B6B6B"
  rule: "#D4D4D4"
  rule-soft: "#E7E7E7"
  action: "#1C55CD"
  action-ink: "#143D94"
  action-soft: "#B9D8FF"
  action-fill: "#1C55CD"
  action-fill-hover: "#143D94"
  action-contrast: "#FFFFFF"
  inverse-accent: "#B9D8FF"
  attention: "#A85F25"
  attention-soft: "#F4C27C"
  dark-canvas: "#000000"
  dark-surface: "#0B0B0B"
  dark-surface-active: "#171717"
  dark-section-muted: "#0B0B0B"
  dark-ink: "#F5F5F5"
  dark-muted: "#A0A0A0"
  dark-rule: "#2C2C2C"
  dark-action: "#6D92FF"
  dark-action-ink: "#A9BEFF"
  dark-action-soft: "#1A2340"
  dark-action-fill: "#1C55CD"
  dark-action-fill-hover: "#285FD1"
  dark-action-contrast: "#FFFFFF"
  dark-inverse-accent: "#B9D8FF"
typography:
  display:
    fontFamily: "Instrument Sans Variable"
    fontWeight: 600
    letterSpacing: "-0.05em"
    lineHeight: 0.93
  interface:
    fontFamily: "Instrument Sans Variable"
    fontWeight: 400
    lineHeight: 1.45
  data:
    fontFamily: "IBM Plex Mono"
    fontWeight: 500
    letterSpacing: "0.05em"
    lineHeight: 1.3
shape:
  controlRadius: 0px
  markRadius: 5px
  statusRadius: 0px
  shadow: none
layout:
  desktopGutter: 16px
  compactGutter: 12px
  pageMax: none
  controlHeight: 34px
  navigationHeight: 50px
  rowHeight: 57px
  splitRailDefault: 320px
  splitRailRange: 272–460px
---

# Exalto design language

Exalto ships two deliberately different design systems under one brand, and this
document governs both. The front-matter tokens above belong to **Axis**, the
operational product system, and are consumed as machine-readable tokens; do not
edit them for marketing work.

| Surface | System | Section |
| --- | --- | --- |
| exalto.ai landing and its /docs pages (`platform/landing`) | **Ledger Phosphor** | Part II |
| Hosted product site and Account (`platform/web`, moving to seal.exalto.ai) | **Axis** | Part III |
| Local admin dashboard (`runtime/apps/admin-dashboard`) | **Axis** | Part III |
| Desktop app (`apps/notary-app`) | **Axis** chrome, **Exalto** app icon | Parts I + III |
| Brand marks, icon kits, illustration | **Shared** | Part I |

The split is a snapshot of the rebrand in motion: the Exalto identity leads on
marketing surfaces today and extends to the product surfaces when the hosted
site takes the seal.exalto.ai name. Until then, Axis rules keep governing
operational UI exactly as before. Statements like "never warm cream" are scoped
to their system; they are not contradictions.

---

# Part I · The brand

## Identity

- **Wordmark:** `Exalto`, set live in Fraunces at weight 640 (26px in
  navigation), ink `#1a2233`, **no trailing dot**. There is no logo file for
  the wordmark; it is always typeset.
- **Tagline lockup:** `VERIFICATION UNBOUND` stacked under the wordmark — IBM
  Plex Mono 500, 10.5px, letter-spacing 0.22em, **no comma, never italic**. The
  comma survives only in prose contexts off-site ("Verification, unbound.").
- **Tagline system, three lines with three jobs:** "Verification, unbound."
  (brand: footer, decks, bios) · "Anyone can verify." (the refrain inside copy;
  the hero closes with it) · "Verification wants to be free." (pricing
  doctrine; the page label currently reads "COSTS?").
- **Product names (frozen):** Exalto Notary Protocol (**ENP**), **Exalto
  Capture** (the desktop recorder; ships today under the working name Notary),
  **Exalto Seal** (the hosted notary; signs as Alice), **Proof of Thought**
  (first-party writing app, early access). **Exalto Verify is retired as a
  separate brand**: verification and shared-trace pages live under Seal, and a
  shared trace shows as "Exalto Seal Verified". Lowercase "notary" survives
  only as the technical role term, the way PKI says "certificate authority".

## The house glyph and product marks

The double opening-quote is the house glyph: it is the Proof of Thought mark
and the center of the Seal stamp. All marks are drawn in brand blue `#0C1622`
(which is also Ledger Phosphor's band navy) with white geometry. Kits live in
`brand/`; web-ready copies used by the landing live in
`platform/landing/public/` and `platform/landing/public/icons/`.

- **Proof of Thought** — the quote glyph. `pot-tile.svg` (app tile),
  `pot-mark-white.svg` / `pot-mark-blue.svg` (outline marks for dark / light
  surfaces).
- **Exalto Capture — "The Recorder"** — viewfinder corner brackets around a
  record lens. Full kit in `brand/exalto-capture/` (SVGs, macOS AppIcon set +
  `Exalto-Capture.icns`, web favicons). The desktop app bundles this icon set
  today, including a menu-bar tray template redrawn from the mark (black on
  alpha, stroke 8 on the 92-unit viewBox, `icon_as_template`).
- **Exalto Seal — "The Round Stamp"** — a circular `EXALTO · VERIFIED` ring
  (IBM Plex Mono 500, rotated −8°) around the quote glyph. Kit in
  `brand/exalto-seal/`; its favicons are the natural set for seal.exalto.ai.
  **Raster caveat:** the raw Seal SVG's ring text references IBM Plex Mono via
  textPath, which `<img>` and SVG-image contexts do not resolve — use the
  font-baked rasters (`icon-192.png` etc.) anywhere the SVG is not inlined into
  a page that loads the font.
- **Usage:** marks appear where a tool is *named* — diagram party cards,
  ecosystem cards, window title bars, the first-party tile — at 14–40px, never
  as decoration. There is no Verify mark and none should be created.
- **exalto.ai favicon:** a placeholder "E" on navy; a commissioned site mark
  and OG image remain open items.

## The attribution code (sacred, recurs everywhere)

- **Registrar blue** (`#1e4a73` family) = **the record and its institutions**:
  model/AI lines, seals, the protocol diagram's additions, the receipt, links,
  verified checks.
- **Phosphor green** (`#0e8f5d` on light, `#35e39b` on dark) = **the human
  hand and living process**: YOU labels, TRACKED LOCALLY, human washes, carets,
  live statuses, the ledger thread.
- **`#35e39b` is only ever a glow or a hairline accent, never a fill.**
- **Recording red `#b3402a`** exists solely for REC.
- **Faded** = sealed-but-undisclosed. **No amber anywhere.**

## Vocabulary and doctrine (design-adjacent, CI-enforced)

The three verbs are **capture · seal · verify**. Marketing copy never says
notarize (the runtime's own vocabulary), never the retired "finaliz*", never
"checkpoint" for anything public (it names the runtime's private capture
state), never "only a fingerprint", "any API", "open and audited",
"tamper-proof", or "human-authored". The receipt IS the sealed trace. Evidence
timestamps say **witnessed** (the session's provider-connection time). The
protocol is drawn with its true relay topology (see Part II). Rendered copy
contains no em- or en-dashes. Required doctrine strings (the four-sentence
legal footer, "A trace proves presence, never absence.", the one-notary-among-
many sentence, the diagram caption, "Nothing readable ever leaves your
machine.") are enforced verbatim by `platform/landing/scripts/check-copy.mjs`;
the repo-wide product model is enforced by `scripts/check-terminology.mjs`.

---

# Part II · Ledger Phosphor (marketing surfaces)

"Record + Protocol" in Ledger Phosphor — option 7a of the homepage
exploration, chosen over forest+amber, Sealing Wax, and Counterproof variants.
The page must feel like the product: evidence, seals, receipts. Two signature
moves carry it: a hero whose background is a real human/AI conversation being
recorded and sealed, and the attribution code from Part I threaded through
every section. The full decision history lives in the design handoff
(`design_handoff_exalto_7a/`, kept outside the repo); the shipped page in
`platform/landing` is the copy authority.

## Tokens

Colors — paper `#f5f3ec` · card `#fdfcf7` · ink `#1a2233` · ink-soft
`#465166` · muted `#6d7482` · ledger blue `#1e4a73` · blue-deep `#16395a` ·
navy (CTA/pill) `#10304e` · phosphor `#0e8f5d` / bright `#35e39b` (dark
surfaces, glow only) · band `#0c1622` · editor `#141b26` · popover `#1c2430` ·
editor text `#c3c9d2` / `#e2e7ee` · cream-on-dark `#eef2f7` and its 75% ·
REC red `#b3402a` · hairline `rgba(26,34,51,.14)` (soft `.08`) · dark hairline
`rgba(255,255,255,.09)` · model wash `rgba(30,74,115,.1)` light /
`rgba(126,178,235,.15)` dark · human wash `rgba(14,143,93,.1)` light /
`rgba(53,227,155,.13)` dark.

Type — **Fraunces** (display; weights 560–640 at 62/54/46/31px, tracking
−0.015 to −0.018em; italics for doctrine lines) · **Newsreader** (body at
20/17.5/14.5px) · **IBM Plex Mono** (labels, chips, buttons, data at 9–12px,
tracking 0.06–0.22em, uppercase labels). Fonts are **self-hosted via
@fontsource** (variable opsz builds) — never a fonts CDN: a page that promises
nobody watches you work makes no third-party requests.

Shape and rhythm — buttons/cards radius 3–6px, editor window 12px, pills
999px; section padding 66px 96px inside a 1440px shell; dark band sections run
full-bleed with content constrained; section labels are mono caps with an
animated dashed rule.

## Motion

Slow ambient loops only, no entrance animations: the hero ledger scroll (56s,
duplicated list, masked fades), blinking cursor/REC (step-end), pulsing seal
chips, crawling diagram dashes and section rules. All animation is pure
CSS/SVG, pauses when the document is hidden, and dies completely under
`prefers-reduced-motion`. (This is the opposite of Axis's one-pass motion
doctrine; each applies only on its own surfaces.)

## Illustration — "Ledger Grain pointillist"

Nine 3:1 tile banners (1536×512 masters, shipped at 1000×333 WebP under
`/art/`): flat risograph-grain compositions on paper where **blue carries the
record and its institutions** and a **continuous phosphor thread — the ledger
line — runs through every piece**, marked by glowing seal points, echoing the
hero. Tiny lone figures set scale. `#35e39b` appears only as glow. Two earlier
directions (monumental stone allegories) were superseded because this set
speaks the page's own semantic language. Extend the series in this style; fix
unevenness with the shared seed, not the palette.

## Set pieces (the load-bearing components)

- **Hero ledger:** the background is a 22-exchange conversation scrolling
  upward forever; YOU rows phosphor, MODEL rows blue; surfaced exchanges carry
  `TRACKED LOCALLY` and `SEALED ✓ · WITNESSED hh:mm UTC` chips; faded rows are
  sealed-but-undisclosed. The foreground holds the pill (`EXALTO NOTARY
  PROTOCOL · RECORDING` with blinking cursor), the headline, CTAs, and a
  legend that teaches the color code. The radial paper wash behind the
  foreground is load-bearing for contrast.
- **Proof of Thought band** (dark `#0c1622`): headline copy left; the **PoT
  score card** featured top-right (the editor-overhang placement is retired —
  it covered prose below ~1400px). The card's anatomy deliberately mirrors and
  inverts a detector result box: `POT SCORE / VERIFIED ✓` rail; verdict
  "Verified human" over the word count; a 270° phosphor arc gauge (61% filled,
  pale remainder) containing the PoT mark, the score, and "of this draft is
  yours"; the anti-detector line "From the sealed ledger, not a detector's
  guess."; then the Details rows. The score must equal the ledger split
  everywhere. The band's empty navy carries an **ambient echo** of the PoT
  tile artwork — inverted and hue-rotated so its paper becomes the band navy
  and its marks read as faint luminous ledger rows, ~26% opacity under a
  radial mask, behind and around the card. (An in-card version was tried and
  rejected as crowded; do not reintroduce it.) Below, the editor mock: human
  titles never filenames, attribution washes that deepen on hover, the
  contribution-history popover (hover/focus/tap, Escape dismisses), a blinking
  phosphor caret, and the PoT mark in the title bar.
- **Protocol diagram:** must draw the **true relay topology** — the session
  runs You ⇄ Notary ⇄ Provider. Session curves in ink (the conversation that
  happens anyway); the notary relay, the returning receipt, and the outgoing
  trace in blue. Never a "fingerprint" flow. Caption doctrine: "The session
  already happens. Everything in blue is what the protocol adds: the witness
  in its path, the receipt, the portable, verified trace." Party cards carry
  the Capture and Seal marks. Below 1100px the SVG swaps for a stacked
  four-card rendition with the numbered exchanges labeled between cards.
- **Proof stamps** (Provenance / Integrity / Time): flat, quiet cards — small
  blue dot, mono label, one serif line. Rotated/wax/badge styling was rejected
  as cheesy.
- **Applications grid:** 3×3, rows carry meaning (makers / institutions /
  frontier), each tile opening with its 128px Ledger Grain band; first-party
  and "yours to build" tiles take blue accents, audience tiles phosphor dots;
  a ten-chip row of secondary use cases below.
- **Receipt card:** the sealed trace as a tangible artifact — mono rows
  (trace · provider + TLS ✓ · messages · sessions · sha-256 · **witnessed**
  UTC · notary), header chip `sealed ✓`, pulsing verified footer. No
  live-capture row inside evidence rows.
- **Ecosystem stack:** layered rows with a right-aligned mono rail (APP LAYER
  → ON YOUR MACHINE → THE NOTARIES → THE NETWORK), connector lines that state
  the trust boundary ("THE NOTARY WITNESSES ONLY CIPHERTEXT · A SIGNED RECEIPT
  RETURNS"), the Capture mini-window with blinking REC, and the ENP band with
  the animated node graph. Never call Seal "our notary service" — one notary
  among many; the kicker sentence is a required string.
- **Trust model:** the two lists stay on the homepage — filled blue ✓ squares
  for what a trace proves, hairline ✕ squares for what it cannot. This is the
  credibility strategy, not a compliance page.
- **Docs shell** (`/docs/*`): grouped sticky sidebar (Start / Understand /
  Share), prev/next footer navigation, chip TOC on long pages, definition
  tables and participant cards in the card style, code blocks in the dark
  editor treatment. Prose uses the Part I vocabulary; commands and API routes
  inside code blocks stay verbatim (the copy audit exempts `pre`/`code`).

## Responsive

Fully fluid; the 1440px composition is the ceiling, not the artboard. Major
stacking at ≤1100 (diagram swap, score card follows the copy, single-column
grids, ecosystem rail above groups), density trims at ≤768 (ledger thins,
compact rows hide). Test at 390, 768, 1100, 1440. Flex children that must
shrink need `min-width: 0`; wide content scrolls inside its own container.

---

# Part III · Axis (operational surfaces)

Axis is the product posture: evidence infrastructure for people who already
understand model providers and the difference between a claim and a record.
It must never read like a generic AI product or a marketing dashboard. The
front-matter tokens describe this system. Within Axis surfaces, the visual
signature is the indigo rounded-square pen mark; the ordinary product name is
`Notary`, formally `Notary by Exalto` (until the Exalto Capture / seal.exalto.ai
rename lands, which will revise this part).

## The governing rule: start with the work

Do not begin a product screen with a large page title, an eyebrow, or an
explanatory paragraph unless that text changes what the user can do. A capture
list begins with its controls and rows; a trace begins with the trace. When a
privacy or trust boundary matters, show it at the exact decision point as a
concise fact (`Request — Private on this device`), not as ambient reassurance.

## Color

Axis is monochrome by default: true white canvas in light mode, true black in
dark. Blue is a signal, never an atmosphere. `action` (#1C55CD) marks
selection, focus, and small highlights and is never a large text-bearing
background; `action-fill` carries solid primary controls with white text in
both themes; `inverse-accent` is the pale blue for small technical values on
black; `attention` appears only for real problems. **Within Axis surfaces:**
never navy as a default surface, never gradients, glow, or warm cream — those
belong to Ledger Phosphor and stop at the marketing boundary. Normal text and
controls meet WCAG AA in both modes.

## Typography

Two families, three roles: **Instrument Sans Variable** for display and
interface (scale and weight distinguish thesis from controls; never a second
sans), **IBM Plex Mono** for evidence — identifiers, status, provider/model
strings, timestamps, counts, code. Display 52–78px for a single landing
thesis; record titles 24–32; interface 12–16; data labels 9–11. Uppercase
mono only where a field name or compact state aids scanning, never as texture.

## Layout and density

Product views are edge-to-edge workspaces with a 16px outer gutter (12px
compact), no centered shell. The standard browse view is a four-band
list/inspector workspace: 50px navigation (54px public), 34px controls, ~57px
result rows, a 320px resizable list rail (272–460px) against a dominant
inspector, divided by one vertical rule — no cards around either side. Rows
open their record; no trailing arrow columns. On mobile, list and inspector
become sequential views; never force horizontal scrolling on an operational
table. Grids are drawn with one outer 1px rule and 1px internal rules, never
doubled borders.

## Components

- **Navigation:** a single horizontal band; active items take an indigo rule,
  never a pill; counts in mono only when they change a decision.
- **Controls:** rectangular `action-fill` primaries with white text; direct
  verbs ("Notarize trace", "Share trace", "Revoke device"); one primary per
  screen. Secondary actions bordered or text-only; square neutral filters;
  inputs with a visible 1px rule. No rounded pills, floating buttons, or
  icon-only actions without labels. Behavior-heavy primitives use shadcn/Radix
  restyled through Axis variables — a primitive is not permission to accept
  its default radius or shadow.
- **Lists and inspectors:** continuous rule-separated rows; selection gets
  `surface-active` plus a 3px indigo inset; hover never lifts or shadows.
  Inspectors are attached panels: identifier and state on top, facts as
  compact mono rows describing real trust boundaries.
- **States:** square outlined status markers plus words, never color alone;
  empty states name what is absent and offer the next action; errors say what
  failed and how to recover, without apology or theater; loading preserves the
  geometry it replaces — no spinner theater. Dialogs are flat surfaces with a
  hard rule, the affected record, the consequence, and the two real choices.
- **Documentation and public traces:** reading surfaces with a compact sticky
  outline; quiet mono inline-code; the black block treatment only for
  copyable examples. Use artifact names precisely: a `.llmcapture` is private
  deferred state, a `.llmtrace` is the portable evidence package; never label
  a bare public JSON as carrying cryptographic evidence. The body-disclosure
  warning sits beside every upload or share action.

## Motion

Motion explains an evidence transition. The relay diagram moves in one
deliberate pass and rests; selection and dialogs fade in 120–160ms; nothing
springs, spins, or loops indefinitely. Respect `prefers-reduced-motion` by
showing final states. (The marketing surfaces' ambient loops are a deliberate
Ledger Phosphor exception and stay on that side of the boundary.)

## Copy

Write for a user deciding what to do with an evidence record: sentence case,
direct nouns, real state names ("Notarize trace", "3 traces match this
view"). Avoid generic AI-product language ("unlock", "seamless", "delve",
"robust") and empty trust claims. Use actual values in comparisons and
fixtures, never invented dashboards.

---

# Part IV · Governance, enforcement, assets

## Which system, which words

Ledger Phosphor surfaces speak the Part I marketing vocabulary
(capture · seal · verify; no "notarize"). Axis surfaces speak the settled
product model (Trace, Captured, Notarized) that `check-terminology.mjs`
enforces repo-wide. This is intentional during the transition; the boundary is
the marketing/product line, and the seal.exalto.ai rename is the event that
moves it.

## Enforcement

- `platform/landing/scripts/check-copy.mjs` — landing banned/required strings,
  tile order, em-dash ban; runs in every landing build and the `Landing site`
  CI job, and inside the deploy image build.
- `scripts/check-terminology.mjs` — repo-wide retired-term and brand audit
  (scans tracked files; stage new files before running).
- `platform/web/scripts/test-brand.mjs` — the product site's "Notary by
  Exalto" identity (unchanged until the rename).
- The `Deploy landing` workflow ships `platform/landing` to exalto.ai on every
  merge to main that touches it, digest-pinned with automatic rollback.

## Asset inventory

| Asset | Location |
| --- | --- |
| Capture icon kit (SVG, macOS + icns, web) | `brand/exalto-capture/` |
| Seal icon kit (SVG, macOS + icns, web) | `brand/exalto-seal/` |
| PoT marks | `platform/landing/public/pot-*.svg` |
| Landing web icons (Capture/Seal) | `platform/landing/public/icons/` |
| Ledger Grain tile art (WebP, 1000×333) | `platform/landing/public/art/` |
| Desktop app bundle icons (Capture set) | `apps/notary-app/src-tauri/icons/` |
| Product-site mark (pen, Axis) | `platform/web/public/notary-mark.svg` |

## Open design items

- Commissioned exalto.ai site mark and OG image (the placeholder favicon "E"
  stands in; a Ledger Grain crop or rendered receipt card are candidates).
- The Notary → Exalto Capture rename: product name, DMG identity, updater
  namespace migration, and this document's Part III revision.
- The seal.exalto.ai brand flip for the product site (Seal favicons ready in
  `brand/exalto-seal/web/`), including retitling the Registry page away from
  "Official Notaries".
- Proof of Thought early-access destination for the three CTAs.
