# Changelog

## 0.0.0 — 2026-10-04 — split out of domkit

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

**Added since the split** (canvas-fx#1):

- **`<pixel-canvas gpu>`: whole chains on the GPU.** The source is uploaded
  once (an image, video, or canvas with `texImage2D`; live HTML with
  `texElementImage2D`), each effect is a fragment shader passing a texture
  to the next, and the result is drawn without a read-back (unless
  `swatches` needs one). `mosaic`, `palette` (named or listed, up to 64
  colors, undithered or ordered), `grid`, `adjust`, `halftone`, `outline`,
  `crt`, `chroma-key`, `wave`, `lens`, `spotlight`, `<pixel-shader>`, and
  `definePixelShader()` effects run there, and draw what the CPU draws (the
  tests compare every one pixel by pixel). Anything else in the chain keeps
  it on the CPU; `renderer` says which ran. `definePixelEffect(…, { gpu })`
  gives your own effect a GPU version (`gpu.mjs`: `gpuShader()`,
  `pipelineFor()`).
- **Effects that follow the pointer:** effects get `pointer` (`{ x, y,
  inside, down }` in the image's pixels), shaders get `u_pointer`, and a
  canvas with one redraws as the pointer moves. New: `lens(radius, zoom)`
  and `spotlight(radius, softness, dim)` (and `<pixel-lens>`,
  `<pixel-spotlight>`).
- **`transition="400ms"`:** changes to `effects` animate, interpolating the
  numbers in the same effects, or cross-fading to a different list; not for
  visitors who prefer reduced motion. `interpolateEffects()` in
  `effects.mjs`.
- **Chaining:** a `<pixel-canvas>` fires `framechange` after each redraw and
  exposes `canvas`, so it's another `<pixel-canvas>`'s source.
- **Recording:** `captureStream(fps)`, `record({ duration, fps })` (WebM or
  MP4, with `MediaRecorder`), and `toGIF({ frames | duration, fps, loop })`,
  an animated GIF from a built-in encoder (`gif.mjs`, `encodeGIF()`), exact
  colors for pixel art.
- **`<pixel-canvas html>` draws one block holding its content,** so the
  content lays out as it would anywhere else and bare text is drawn too
  (it was skipped). `gpu`, `html`, and `transition` properties mirror their
  attributes.

- **`glyphs()` and `<pixel-glyphs>`: the image as text characters.** Each
  cell becomes the character that best matches it, from an atlas measured
  from the real font: by brightness (ink coverage, measured, not the
  nominal order) or by shape (ink in a 2 × 3 grid, so edges get `/` `\`
  `|`; text drawn in the same font reads back exactly). Character sets
  (`ramp`, `ascii`, `blocks`, `binary`, or your own), any font (redrawn
  when it loads), ink in each cell's color or one color, any background
  (light backgrounds ink the dark). On the GPU too, matching the CPU.
- **`toText()`:** the result as text, one line per row: the characters
  `glyphs()` drew, or the result converted with `glyphs()`'s options.
- **Quoted effect arguments:** `glyphs(8, ' .,:')` keeps its spaces and
  commas (`unquote()` in `effects.mjs`). Effects on the GPU can bring their
  own textures (`{ texture, key }` uniforms).

**Changed in the split:**

- **Import paths are `@johnhenry/canvas-fx/…`,** not
  `@johnhenry/domkit/pixelable/…` (`@johnhenry/canvas-fx/global.mjs`,
  `@johnhenry/canvas-fx/pixel-canvas`, `@johnhenry/canvas-fx/effects.mjs`).
  The package root, `@johnhenry/canvas-fx`, exports every class
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
