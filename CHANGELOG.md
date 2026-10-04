# Changelog

## 0.0.0 — split out of domkit (unreleased)

The pixel effects family, split out of
[`@johnhenry/domkit`](https://github.com/johnhenry/domkit) (where it was
`src/pixelable/`) into its own package, with its history. It was never
published to npm under any name, so `0.0.0` is its first version; domkit
0.0.4 shipped only an ancestor (`pixelshader.component`, from
`johnhenry/lib`). Pull request numbers below are domkit's.

**What 0.0.0 contains** (all developed in domkit):

- **`<pixel-canvas>`: pixel effects on any image, video, or canvas, written
  as HTML,** and the effect elements `<pixel-mosaic>`, `<pixel-palette>`,
  `<pixel-grid>`: 40b562a.
- **The `effects` attribute, listed like CSS `filter`**
  (`effects="adjust(contrast 1.3) palette(gameboy, ordered)"`), one shared
  effect registry for both forms, and `adjust`, `halftone`, `outline`,
  `crt`, `chroma-key`: 3ad25b8 (johnhenry/domkit#34).
- **Colors from the image:** `palette(auto)` and `swatches`, published as
  `--pixel-swatch-N` custom properties: 586a340 (johnhenry/domkit#35).
- **`<pixel-sprite>`: pixel art written as text,** with animation frames:
  ee82066 (johnhenry/domkit#36).
- **A clock for effects** (`fps`, `play()`/`pause()`) and the animated
  `glitch` and `wave` effects: 27b7b78 (johnhenry/domkit#37).
- **`<pixel-shader>` and `definePixelShader()`: effects in GLSL, on the
  GPU:** 23d610a (johnhenry/domkit#38).
- **Custom sources:** any element exposing a `canvas` and firing
  `framechange` (a game, a visualization): 428158b (johnhenry/domkit#39).
- **`grid(size, transparent)` cuts gaps** instead of drawing lines: 87b4ee0.
- **`<pixel-canvas html>` (experimental): live HTML through the effects,**
  still interactive, with the proposed HTML-in-canvas API; elsewhere the
  content shows as it is: 3fa83ef (was johnhenry/domkit#43, a draft).

**Changed in the split:**

- **Import paths are `@johnhenry/pixelable/…`,** not
  `@johnhenry/domkit/pixelable/…` (`@johnhenry/pixelable/global.mjs`,
  `@johnhenry/pixelable/pixel-canvas`, `@johnhenry/pixelable/effects.mjs`).
  The package root, `@johnhenry/pixelable`, exports every class
  unregistered plus the effect toolkit.
- **`--domkit-sprite-scale` is now `--pixel-sprite-scale`.**
- **The generated `effects.d.mts` declared `readonly get params()`,** which
  TypeScript rejects; the getter's `@readonly` tag is gone (a getter without
  a setter is read-only anyway). domkit's type test never imported it, so
  it never showed.
- **`<pixel-canvas html>` without HTML-in-canvas no longer calls itself an
  image.** It labelled itself `role="img"`, so a working form inside was
  announced as an unlabelled image with nested controls (axe:
  `role-img-alt`, `nested-interactive`). With `html`, the element's role is
  always its content's.
