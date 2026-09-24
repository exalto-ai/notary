# Aperture, a proposed design system for Exalto Capture

Status: proposal. Nothing here governs a shipped surface yet.
[`DESIGN.md`](../DESIGN.md) remains the authority for everything in production.

Aperture is a clean-break replacement for Ledger Phosphor on
`capture.exalto.ai`. It keeps the frozen Part I identity (the Exalto wordmark,
the product names, the marks, and the capture / seal / verify vocabulary) and
replaces the palette, typography, geometry, density, and component language
underneath it.

A working prototype of every surface lives in `platform/web/src/next/` and is
served from its own document at `/next.html`. It shares no stylesheet, no
provider, and no route handling with the production entry.

## Why a new system

Ledger Phosphor is an editorial system: cream paper, a serif display face, and
a magazine measure. It reads well on a marketing page and works against the
account console, where a 60px serif heading sits above five numbers a person
came to check. The prototype starts from the product's own unit instead.

## The idea

A trace is a record of custody. It was recorded somewhere, witnessed by
someone, and can travel. The system draws that, once, and reuses the drawing
everywhere a trace appears: on the landing page, in an account row, and on a
trace detail.

Three rules carry the rest:

1. **Chrome is achromatic.** A hue always names a state or the single primary
   action on a screen. Blue is the attested record. Green is what is live and
   held on this machine. Red is recording, failure, and destruction.
2. **Sealed but undisclosed content is shown, not hidden.** It renders as
   redaction at the width it occupies, so a reader can see that something is
   there and that they cannot read it. An absent line and a sealed line never
   look the same.
3. **Machine-produced values keep their own typeface.** Digests, identifiers,
   byte counts, UTC times, hostnames, and commands are set in mono because they
   are read character by character. Labels and prose are not.

## Colour

Two surfaces and three signals, resolved per colour scheme.

| Token | Light | Dark | Job |
| --- | --- | --- | --- |
| `shell` | `#eff0f2` | `#0d1013` | The page |
| `record` | `#ffffff` | `#161a1f` | Anything that holds a record |
| `sunken` | `#e6e8eb` | `#10141a` | Inset bands, code, filled fields |
| `ink` | `#171a1f` | `#e7eaee` | Text |
| `quiet` | `#5a6069` | `#939aa4` | Secondary text |
| `rule` | 13% ink | 13% ink | Hairlines |
| `seal` | `#2b4acb` | `#8fa3f2` | The record, links, the primary action |
| `custody` | `#0b6e4f` | `#3fcf8e` | Local, live, held by the person |
| `alert` | `#c2321b` | `#f0705a` | Recording, failure, destruction |

Status is never carried by colour alone. Every state pairs a square lamp with
a word.

## Type

One family for people, one for machines.

- **Archivo Variable** carries display and interface text. Headings run at
  `wdth 112`; interface text runs at the normal width. The width axis does the
  work a second display family would otherwise do.
- **Geist Mono Variable** carries machine-produced values and code.
- The **Exalto wordmark stays in Fraunces** at weight 640, per Part I. The
  brand signs the product; the product's interface has its own voice.

Scale: 44 / 29 / 21 / 17 / 14.5 / 13 / 12.5 / 11.5px. Prose holds a 66ch
measure.

## Geometry and density

- Radius 4px on controls, 6px on records, round only on avatars.
- No shadows on static surfaces. Depth is the value difference between `shell`
  and `record`. Overlays are the one exception.
- Grids draw one outer rule and single internal rules, from each cell's
  outline rather than a coloured backdrop, so a row that does not fill leaves
  record surface rather than a hole.
- Control height 34px, table row 48px, 4px spacing base.

## The load-bearing components

- **Trace record.** Title, state lamp, provider and model, the disclosed lines
  with sealed ones redacted, the witnessed time and digest, and the custody
  strip. One perforated edge marks it as a record torn from something. This is
  the system's only ornament and it appears nowhere else.
- **Custody strip.** Recorded, Sealed, Shared, in order, with a filled node and
  a solid rule for each step reached and a hollow node and dashed rule for each
  step not reached.
- **Status lamp.** An 8px square and a word. Filled when the state is real,
  outlined when it is absent. The recording lamp is the only looping animation
  in the system, and it stops under `prefers-reduced-motion`.
- **Segmented meter.** An allowance reads as a count of discrete units, not a
  smooth bar, because what is being spent is discrete.
- **Readout strip.** Five facts about the account in one ruled band, value
  loud, label quiet.
- **Topology.** The true relay topology on one line, with the machine boundary
  drawn as a dashed enclosure that plaintext never crosses.

## What is deliberately absent

- Uppercase eyebrow labels above headings.
- Numbered markers on content that is not a sequence.
- Metadata strings joined with middle dots.
- Card shadows, gradient washes, and hover lift.
- Entrance animation.

## Open questions

- Whether the wordmark keeps Fraunces, which costs a font payload for one word.
- Whether `capture.exalto.ai` and `exalto.ai` should share one system or stay
  deliberately different, now that the hosted product carries most of the
  surface area.
- Whether the local admin dashboard follows Aperture or stays on the developer
  workspace rules in Part III.
