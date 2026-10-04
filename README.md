# canvas-fx

[![npm version](https://img.shields.io/npm/v/%40johnhenry%2Fcanvas-fx.svg)](https://www.npmjs.com/package/@johnhenry/canvas-fx)
[![CI](https://github.com/johnhenry/canvas-fx/actions/workflows/ci.yml/badge.svg)](https://github.com/johnhenry/canvas-fx/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/%40johnhenry%2Fcanvas-fx.svg)](LICENSE)

Full documentation: [opensource.johnhenry.me/canvas-fx](https://opensource.johnhenry.me/canvas-fx/)

Pixel effects for any image, video, or canvas, written as HTML. Put the
image in a `<pixel-canvas>` and list the effects, like CSS `filter`:

```html
<script type="module" src="https://esm.sh/@johnhenry/canvas-fx/global.mjs"></script>

<pixel-canvas width="160" effects="adjust(contrast 1.3) palette(gameboy, ordered)">
  <img src="photo.jpg" alt="Our cat" />
</pixel-canvas>
```

Effects run left to right: here the contrast is raised, then the photo is
reduced to the Game Boy's four greens. Before the script loads, or if the
image can't be read, the plain `<img>` shows, so nothing is lost.

Effects work on images, video, canvases, pixel art you write as text, your
own drawing elements (a game, a visualization), and, experimentally, live
HTML. Custom elements, shipped as source: no build step, no dependencies.

## Contents

- [Install](#install)
- [Effects](#effects)
- [Writing effects](#writing-effects)
- [Your own effects](#your-own-effects)
- [GPU effects](#gpu-effects)
- [Live HTML (experimental)](#live-html-experimental)
- [Ideas](#ideas)
- [Notes](#notes)
- [Adding a new effect](#adding-a-new-effect)
- [Family](#family)
- [License](#license)

## Install

```sh
npm install @johnhenry/canvas-fx
```

Or straight from a CDN, with no install at all:

```html
<script type="module" src="https://esm.sh/@johnhenry/canvas-fx/global.mjs"></script>
```

`global.mjs` registers every element; `pixel-canvas/global.mjs` alone is
enough for the `effects` attribute; `@johnhenry/canvas-fx` exports every
class unregistered, plus the effect toolkit (`definePixelEffect`,
`definePixelShader`, …). Each element's guide is in its directory
(`src/<element>/readme.md`); the generated
[element reference](docs/reference.md) lists every attribute, property,
event, and CSS part.

**Provenance.** canvas-fx was developed inside
[`@johnhenry/domkit`](https://github.com/johnhenry/domkit) (as
`src/pixelable/`, and before that `experimental/pixel-shader` and the
`pixelshader.component` that domkit 0.0.4 shipped, from `johnhenry/lib`) and
split out into this package with its history. This family was never
published to npm under any name: `0.0.0` is its first version.

## Effects

| Function | Element | What it does |
|---|---|---|
| `mosaic(size)` | [`<pixel-mosaic>`](src/pixel-mosaic/readme.md) | Pixelates into blocks of one color |
| `palette(colors, dither, count)` | [`<pixel-palette>`](src/pixel-palette/readme.md) | Limits the colors to a palette (`gameboy`, `pico-8`, `1bit`, …, any CSS colors, or `auto` from the image), with dithering |
| `grid(size, color, line)` | [`<pixel-grid>`](src/pixel-grid/readme.md) | Grid lines between cells |
| `adjust(brightness, contrast, saturation, hue)` | [`<pixel-adjust>`](src/pixel-adjust/readme.md) | Tone and color, like the CSS filter functions |
| `halftone(size, angle, ink, paper)` | [`<pixel-halftone>`](src/pixel-halftone/readme.md) | Printed dots |
| `outline(threshold, ink, paper)` | [`<pixel-outline>`](src/pixel-outline/readme.md) | Line art from edges |
| `crt(scanlines, mask, glow)` | [`<pixel-crt>`](src/pixel-crt/readme.md) | An old screen: scanlines and a color stripe mask |
| `chroma-key(color, tolerance, softness)` | [`<pixel-chroma-key>`](src/pixel-chroma-key/readme.md) | Makes a color transparent (green screen) |
| `glitch(amount, rate)` | [`<pixel-glitch>`](src/pixel-glitch/readme.md) | Animated digital breakup |
| `wave(amplitude, wavelength, speed)` | [`<pixel-wave>`](src/pixel-wave/readme.md) | Rows rippling along a moving sine wave |
| `lens(radius, zoom)` | [`<pixel-lens>`](src/pixel-lens/readme.md) | A magnifying glass that follows the pointer |
| `spotlight(radius, softness, dim)` | [`<pixel-spotlight>`](src/pixel-spotlight/readme.md) | Light around the pointer, the rest dimmed |
| `glyphs(cell, chars, font, mode, color, background)` | [`<pixel-glyphs>`](src/pixel-glyphs/readme.md) | The image as text characters (ASCII art), by brightness or by shape; `toText()` gives it back as text |

The [`<pixel-canvas>`](src/pixel-canvas/readme.md) draws the result. Its
source can be an `<img>`, a `<video>`, a `<canvas>`, or a
[`<pixel-sprite>`](src/pixel-sprite/readme.md): pixel art written as text,
with animation frames, or another `<pixel-canvas>` (they chain). With
`html` (experimental), it draws its own HTML content, live and still
interactive, where the browser has
[HTML-in-canvas](src/pixel-canvas/readme.md#html-content-experimental).
It also runs whole chains on the GPU (`gpu`), animates between settings
(`transition="400ms"`), follows the pointer, and records itself as an
animated GIF (`toGIF()`), a video (`record()`), or text (`toText()`); its
[guide](src/pixel-canvas/readme.md) has each.
`global.mjs` here registers it and every effect element; for the
`effects` attribute alone, `pixel-canvas/global.mjs` is enough.

## Writing effects

**As a function**, parameters fill in order, or by name: `palette(gameboy,
ordered)` and `palette(dither ordered, colors gameboy)` are the same.
Values are as you'd write them in CSS (`grid(8, rgb(0 0 0 / 0.5))`).
An effect can appear more than once.

**As elements** wrapped around the source, each effect's parameters are
attributes, and the effects apply from the inside out:

```html
<pixel-canvas width="160">
  <pixel-palette colors="gameboy" dither="ordered">  <!-- 2. then this -->
    <pixel-adjust contrast="1.3">                    <!-- 1. this first -->
      <img src="photo.jpg" alt="Our cat" />
    </pixel-adjust>
  </pixel-palette>
</pixel-canvas>
```

Elements earn their keep when you want to switch one effect on and off
(`disabled`, say from a checkbox) or drive it from script. Both forms can
be mixed: the elements run first (they're inside), then the attribute's
list.

## Your own effects

`definePixelEffect()` registers an effect for both forms:

```js
import { definePixelEffect, number } from "@johnhenry/canvas-fx/effects.mjs";

definePixelEffect(
  "posterize",
  (image, params) => {
    const levels = number(params.levels, 4, { min: 2 });
    const step = 255 / (levels - 1);
    for (let i = 0; i < image.data.length; i += 4) {
      for (let c = 0; c < 3; c++) image.data[i + c] = Math.round(image.data[i + c] / step) * step;
    }
    return image;
  },
  { params: ["levels"] },
);
```

```html
<pixel-canvas effects="posterize(3)">…</pixel-canvas>
<pixel-canvas><pixel-posterize levels="3">…</pixel-posterize></pixel-canvas>
```

The function gets the `ImageData` and the parameters as strings, by name
(`number()` and `parseColor()` help read them), and returns an
`ImageData`. A third argument, `{ time, frame }`, is for effects that
change over time: `time` is seconds on the canvas's clock, and `frame`
counts redraws. `random(seed)` gives repeatable randomness, so a paused
canvas doesn't flicker. A canvas already showing an effect that wasn't defined yet
redraws once it is. For an effect with its own state, extend `PixelEffect`
and override `apply(image)`; call `invalidate()` after a change that isn't
an attribute. Any element with an `apply(image)` method works.

## GPU effects

`<pixel-canvas gpu>` runs the whole chain on WebGL2 when every effect in it
can (most built-ins, every shader): upload once, a shader per effect,
nothing read back. A chain with a CPU-only step (`glitch`, `palette(auto)`,
Floyd–Steinberg, a JavaScript effect) runs on the CPU; `renderer` says
which ran. Your own effect gets a GPU version with
`definePixelEffect(name, apply, { gpu: { fragment, uniforms } })` (see
`gpu.mjs`).

[`<pixel-shader>`](src/pixel-shader/readme.md) runs a GLSL fragment shader
you write in a `<script type="x-shader/x-fragment">` child, on the GPU,
with the image, its size, and the clock provided, and its `u_` uniforms
set from attributes. `definePixelShader(name, code)` (in `shader.mjs`)
makes a shader a named effect for both forms.

## Live HTML (experimental)

`<pixel-canvas html>` draws its own HTML content, live and still
interactive, through the effects, using the proposed
[HTML-in-canvas](https://github.com/WICG/html-in-canvas) API; where the API
is missing, the content shows as it is.
[`<pixel-canvas>`'s guide](src/pixel-canvas/readme.md#html-content-experimental)
has the details.

## Ideas

- **Retro art:** any photo in Game Boy greens, PICO-8 colors, 1-bit
  dither, or as halftone print.
- **A live camera effect:** a `<video>` showing `getUserMedia()` is
  redrawn every frame. Add `chroma-key(lime)` and a CSS background on the
  `<pixel-canvas>` for a virtual backdrop.
- **Privacy:** `mosaic(16)` makes faces or screenshots unrecognizable, on
  the client.
- **Creative coding:** a `<pixel-shader>` over a camera, with `fps` and
  `u_time` for motion.
- **Icons and game art with no image files:** `<pixel-sprite>`, animated
  with `fps`, run through `crt()` or `palette(gameboy)`.
- **Theme from a picture:** `<pixel-canvas swatches="3" swatches-target="html">`
  sets `--pixel-swatch-1` … `--pixel-swatch-3` from an album cover or
  photo, for the page's CSS to use.
- **Previews:** what an image looks like on an e-ink panel
  (`palette(#000 #fff, floyd-steinberg)`) or an old TV (`crt()`).

## Notes

- Without `gpu`, effects run on the CPU, once per redraw. For video, use
  `gpu`, or keep the working size small (`<pixel-canvas width="160">`) and
  scale the result up with CSS. It's drawn with `image-rendering:
  pixelated`, so it stays crisp.

## Adding a new effect

`grid()` cutting gaps (`grid(8, transparent)`, see the CHANGELOG) is the best
small worked example: one registered function, picked up by both forms.

**Smallest: a new parameter on an existing effect.** Every effect reads its
parameters by name (`resolveParams`), so a new one is a new name in the
effect's `params` list and a branch in its function. No new element, no new
tag. Prefer this whenever the new behavior is a variant of an existing look.

**A genuinely new effect** is one function and four touchpoints:

1. **`src/pixel-<name>/effect.mjs`**: `definePixelEffect("<name>", (image, params, { time, frame }) => …, { params: [...] })`.
   This registers `<name>(…)` for the `effects` attribute and a
   `<pixel-<name>>` element for the wrapping form.
2. **`src/pixel-<name>/index.mjs` and `global.mjs`**: the element class
   (a `PixelEffect` subclass with JSDoc for the manifest: `@tag`, `@attr`
   per parameter) and its registration.
3. **`src/builtins.mjs`** (and `src/global.mjs`, `src/index.mjs`): load it
   with the built-ins, register and export it.
4. **The one part that isn't boilerplate: the pixel math.** Work on the
   `ImageData` in place and return it; use `random(seed)` rather than
   `Math.random()` so a paused canvas doesn't flicker; read `time` only if
   the effect changes over time, and `pointer` only if it follows the
   pointer (then pass `{ pointer: true }`). For `<pixel-canvas gpu>`, give
   it a `gpu: { fragment, uniforms }` version too (built with `gpuShader()`
   from `gpu.mjs`), and a test that the two draw the same pixels
   (`test/browser/expansions.spec.mjs` does this for every built-in).

Then: a test in `test/browser/pixel-canvas.spec.mjs` that checks actual pixels
(not just that the function ran), a row in the [Effects](#effects) table, a
`readme.md` for the element, `npm run manifest`, and a CHANGELOG entry.

## Family

- **[`@johnhenry/domkit`](https://github.com/johnhenry/domkit)**, where this
  family started: its `<frame-timer>` is the clock that animated sources
  (games, sprites) usually run on, and its `<hot-key>`, `<gamepad-input>`,
  and `<swipe-input>` drive whatever is drawn. canvas-fx doesn't import
  domkit; they meet in the page.
- **[`forsnaken`](https://github.com/johnhenry/forsnaken)** is a consumer: its
  `<forsnaken-game>` is a custom source (it exposes a `canvas` and fires
  `framechange`), shown through `<pixel-canvas effects="grid(…)">`.
- **[`htmlbuilder`](https://github.com/johnhenry/htmlbuilder)** reads this
  package's `custom-elements.json` (through `package.json`'s
  `customElements`), so every effect is in its palette with typed fields.

## License

MIT
