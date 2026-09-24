# Aperture, the design system for capture.exalto.ai

Status: shipped. [`DESIGN.md`](../DESIGN.md) Part IIB is the rule; this
document is why the rule reads the way it does, and what the port cost. Change
Part IIB when the system changes, and this document when the reasoning does.

Aperture is a clean-break replacement for Ledger Phosphor on
`capture.exalto.ai`. It keeps the frozen Part I identity (the Exalto wordmark,
the product names, the marks, and the capture / seal / verify vocabulary) and
replaces the palette, typography, geometry, density, and component language
underneath it.

Every surface lives in `platform/web/src/next`. Run it with
`npm --prefix platform/web run preview:capture`.

## Why a new system

Ledger Phosphor is an editorial system: cream paper, a serif display face, and
a magazine measure. It reads well on a marketing page and works against the
account console, where a 60px serif heading sits above five numbers a person
came to check. The prototype starts from the product's own unit instead.

The normative tokens, type, geometry, and components are in
[`DESIGN.md`](../DESIGN.md) Part IIB. What follows is why they read that way.

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

## What the port cost

Seven layers, each landing on its own: the design system and a parallel
prototype, a real shell, the session, traces, settings, usage and billing, and
this cutover. The old application is gone, and with it twelve hand-written
stylesheets, the shadcn and Radix primitives, Tailwind, cmdk, lucide, recharts,
and three webfont families.

Two bugs turned up in the billing layer, which is why it was scheduled last.
The account hook returned a new `refresh` function on every render, so a poll
meant to run eight times ran 1,375 times in twelve seconds; and the checkout
poll listed its own completion callback as a dependency, restarting a request
already in flight. Both were found by driving a real checkout return rather
than by reading the code.

## Still open

- Whether the wordmark keeps Fraunces, which costs a font payload for one word.
- Whether the local admin dashboard follows Aperture or stays on the developer
  workspace rules in Part III.
- Whether the shared appearance preference should gain a fourth state now that
  the desktop app and the site read the same key.
