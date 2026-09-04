# Exalto brand icon kits

Shared product marks for Exalto's tools. Brand blue `#0C1622`, mark white
`#FFFFFF`; the Seal ring text is IBM Plex Mono 500, baked into every
PNG/ICNS/ICO. The raw SVGs reference the font by name, so use them only
where that font is loaded (inline on the website); elsewhere prefer the
baked rasters. Web-ready copies used by the landing site live in
`platform/landing/public/icons/`.

## exalto-capture/: Exalto Capture ("The Recorder")

The Exalto Capture desktop app. Viewfinder brackets around a record lens.

- `macos/` AppIcon-16…1024.png (Apple squircle on transparent margin) plus
  `Exalto-Capture.icns` for the app bundle.
- `web/` favicon-16/32/48.png, favicon.ico, icon-192/512.png, and
  apple-touch-icon-180.png.
- `svg/` `exalto-capture-tile.svg` (full tile) and
  `exalto-capture-mark-white.svg` (mark only, for dark surfaces).

## exalto-seal/: Exalto Seal ("The Round Stamp")

The Exalto Seal hosted sealing and verification product. A circular EXALTO ·
VERIFIED stamp around the house quote glyph. Same layout as above with
`Exalto-Seal.icns`; the Seal favicons are the canonical set for
seal.exalto.ai.

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/svg+xml" href="/exalto-capture-tile.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
```
