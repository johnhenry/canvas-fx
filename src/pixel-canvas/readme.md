# pixel-canvas

Draws an image, video, or canvas through [pixel effects](../../README.md),
listed in its `effects` attribute like CSS `filter`, or wrapped around the
source as elements. The first `<img>`, `<video>`, or `<canvas>` inside is
the source, or a [`<pixel-sprite>`](../pixel-sprite/readme.md). Part of
[pixelable](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/pixelable/global.mjs"></script>

<pixel-canvas width="120" effects="adjust(contrast 1.2) palette(1bit, floyd-steinberg)">
  <img src="portrait.jpg" alt="A portrait, dithered" />
</pixel-canvas>
```

## Effects

`effects` lists effects to run left to right, each as `name(…)` with its
parameters in order or by name (see the [effects table](../../README.md#effects)).
Effect elements wrapped around the source run first, innermost first, and
`effectElements` lists them. An unknown name is skipped, and reported once
with an `error` event; if it's defined later, the canvas redraws.

## Drawing

The source is drawn at its own size, or scaled to `width` (or `height`)
keeping its aspect ratio. That working size is what the effects see, and
the result is shown on a canvas in the element's shadow root, scaled with
CSS and `image-rendering: pixelated`. The element is an inline block that
sizes like an image: set its `inline-size` to scale it up.

It redraws, at most once a frame:

- when an `<img>` source loads (or changes `src`), and on a `<video>`'s
  `loadeddata` and `seeked`;
- on every new frame while a `<video>` plays (with
  `requestVideoFrameCallback` where available);
- when `effects`, `width`, or `height` changes, or anything inside does:
  an effect's attributes, effects added or removed, a different source;
- when an effect calls `invalidate()`, or you call `render()` (which draws
  now and returns whether it could).

The light-DOM content stays in the document, so an image keeps loading
and a video keeps playing, but only the canvas is displayed.

## Your own sources

Besides `<img>`, `<video>`, and `<canvas>`, any element that exposes a
`canvas` property (an `HTMLCanvasElement` or `OffscreenCanvas`) is a
source: a game, a visualization, a sprite. Fire `framechange` on it when
it redraws, and the `<pixel-canvas>` redraws too.
[`<pixel-sprite>`](../pixel-sprite/readme.md) works this way.

```js
customElements.define("my-plasma", class extends HTMLElement {
  canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
  draw() {
    // …paint this.canvas…
    this.dispatchEvent(new Event("framechange"));
  }
});
```

```html
<pixel-canvas effects="palette(pico-8, ordered) crt()"><my-plasma></my-plasma></pixel-canvas>
```

The first such element inside (in document order) is the source. One
that isn't defined yet becomes a source when it is.

**A `<pixel-canvas>` is a source too:** it exposes `canvas` and fires
`framechange` after each redraw, so canvases chain. The inner one's result
goes through the outer one's effects, and the outer one follows every
change:

```html
<pixel-canvas effects="crt()">
  <pixel-canvas effects="mosaic(4) palette(gameboy)" swatches="3">
    <img src="photo.jpg" alt="A photo" />
  </pixel-canvas>
</pixel-canvas>
```

That's how one source gets two looks with different settings, or how a
later stage keeps its own `fps` or `transition`. (A `<pixel-canvas html>`
can't be an inner one: its content must be on screen to be drawn.)

## HTML content (experimental)

With `html`, the `<pixel-canvas>` draws its own HTML: a form, text,
anything, live, through the effects. It stays HTML: it's laid out where the
result is drawn, so clicks, typing, focus, and screen readers all work as
usual, and every change to it (a typed letter, a hover style) redraws.

```html
<pixel-canvas html effects="mosaic(3) palette(gameboy, ordered)">
  <form>
    <label>Name <input name="name"></label>
    <button>Sign</button>
  </form>
</pixel-canvas>
```

This uses [HTML-in-canvas](https://github.com/WICG/html-in-canvas)
(`<canvas layoutsubtree>` and `drawElementImage()`), which is still a
proposal: in Chromium it's behind `chrome://flags/#canvas-draw-element`
or an origin trial. Where it's missing, the content shows as it is,
without effects, and works the same. Your markup isn't moved: it's slotted
into a `<canvas layoutsubtree>` in the shadow root (the `html-canvas`
part), which is as wide as the `<pixel-canvas>` and as tall as its content.

- One working pixel is one CSS pixel, unless `width` or `height` says
  otherwise, so `mosaic(4)` makes 4-pixel blocks.
- The content is laid out in a block (the `html-content` part) as it would
  be anywhere else, bare text included, and that block is what's drawn.
- In Chromium 153, an element with nothing in it (only a background, say)
  isn't drawn; give it some content.
- With `gpu`, the content goes straight into a WebGL texture
  (`texElementImage2D(target, internalformat, element)` in this Chromium,
  not the explainer's argument order) and nothing is read back.
- Effects that move pixels (`wave`, `glitch`) move the picture, not the
  hit areas: clicks go where the content really is.
- With `html`, the element's role is its content's, not an image's.
- The API may change before it ships; so may this.

## Animation

Effects can change over time (`glitch()`, `wave()`, or your own): each one
gets the canvas's clock, `time`, in seconds. The canvas redraws whenever
something changes and on every frame of a playing video or sprite. Add
`fps` to redraw on a clock even for a still image:

```html
<pixel-canvas fps="24" effects="wave(3, 24) glitch(0.2)">
  <img src="poster.jpg" alt="A poster" />
</pixel-canvas>
```

`play()`, `pause()`, the `paused` attribute (write it to start paused),
`play`/`pause` events, and the `--play`, `--pause`, and `--toggle`
invoker commands control the clock, as on
[`<frame-timer>`](https://github.com/johnhenry/domkit/blob/main/src/frame-timer/readme.md). Pausing freezes `time`
(and the `fps` redraws), not a video source. For visitors who prefer
reduced motion, the clock waits for `play()`.

## On the GPU

With `gpu`, the whole chain runs on WebGL2 when every effect in it can: the
source is uploaded once, each effect is a fragment shader passing a texture
to the next, and the result is drawn without coming back to the CPU (unless
`swatches` needs it). For large sources, live HTML, and video, that's the
difference between keeping up and not.

```html
<pixel-canvas gpu width="480" effects="adjust(contrast 1.2) mosaic(3) palette(pico-8, ordered) crt()">
  <video src="clip.mp4" autoplay muted loop></video>
</pixel-canvas>
```

`mosaic` (blocks up to 64), `palette` (named or listed palettes up to 64
colors, undithered or `ordered`), `grid`, `adjust`, `halftone`, `outline`,
`crt`, `chroma-key`, `wave`, `lens`, `spotlight`, every `<pixel-shader>`,
and every `definePixelShader()` effect run there; the GPU draws what the CPU
draws, to within rounding (the tests compare them pixel by pixel). A chain
with anything else (`glitch`, `palette(auto)`, Floyd–Steinberg dithering,
a JavaScript effect) runs on the CPU as before. `renderer` says which ran
(`"gpu"` or `"cpu"`). Your own effect gets a GPU version through
`definePixelEffect(name, apply, { gpu: { fragment, uniforms } })`; see
`gpu.mjs` for what a fragment shader is given.

## Following the pointer

Effects get the pointer, in the image's pixels: `{ x, y, inside, down }`
(0,0 at the top left), or null before it's been over the canvas.
`lens(radius, zoom)` and `spotlight(radius, softness, dim)` use it, and so
can your own effects (`definePixelEffect(…, { pointer: true })`, or
`u_pointer` in a shader). A canvas with one redraws as the pointer moves,
with no `fps` needed:

```html
<pixel-canvas width="320" effects="palette(gameboy) spotlight(40, 24)">
  <img src="map.png" alt="A map" />
</pixel-canvas>
```

## Transitions

`transition="400ms"` animates changes to `effects`: numbers in the same
effects are interpolated (`mosaic(2)` to `mosaic(16)` grows the blocks),
and a different list of effects cross-fades from the old look to the new.
A change mid-transition starts from where it is. Visitors who prefer
reduced motion get the new look at once.

```js
canvas.setAttribute("effects", "mosaic(16) palette(1bit)"); // animates, with transition set
```

## Colors from the image

`swatches="5"` publishes the result's five most common colors as custom
properties, `--pixel-swatch-1` (the most common) to `--pixel-swatch-5`, on
the `<pixel-canvas>` and on whatever `swatches-target` selects. So a page,
or a card, can take its theme from a photo or an album cover:

```html
<pixel-canvas swatches="3" swatches-target="html" width="64">
  <img src="album.jpg" alt="Album cover" />
</pixel-canvas>
<style>
  body { background: var(--pixel-swatch-1); color: var(--pixel-swatch-3); }
</style>
```

The `palette` property lists them (`#rrggbb`, most common first), and a
`palettechange` event fires when they change, such as when the image
does. They're found by clustering the colors (median cut, refined with
k-means), from at most about 16,000 sampled pixels. Mostly transparent
pixels don't count. Removing the element, or the attribute, takes the
properties back off.

## Saving the result

`toBlob(type, quality)` and `toDataURL(type, quality)` work like a
canvas's, for downloads and uploads:

```js
const blob = await document.querySelector("pixel-canvas").toBlob("image/png");
```

**Text:** `await canvas.toText()` gives the result as text characters, one
line per row: with [`glyphs()`](../pixel-glyphs/readme.md) in the chain,
the characters it drew; otherwise the result converted with the options you
pass (`toText({ cell: "4x8", chars: "blocks" })`, the same as `glyphs()`'s
parameters). It waits for a redraw on the CPU, where the characters are
known.

**Animated GIF:** `toGIF({ frames, fps, loop })` (or `{ duration, fps }`)
samples the result `fps` times a second and encodes it, at the working
size, with no library: pixel art keeps its exact colors (a frame with more
than 255 is quantized). **Video:** `record({ duration, fps })` records WebM
(or MP4) with `MediaRecorder`, and `captureStream(fps)` is the live stream,
for a `<video>`, WebRTC, or your own recorder. Effects that change over time
need `fps` (or a playing video) to animate while you capture.

```js
const gif = await canvas.toGIF({ duration: 2, fps: 12 });
const video = await canvas.record({ duration: 5 });
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `width` | `width` | `number` | Working width in pixels: the source is scaled to it (keeping its aspect ratio) before the effects run. Smaller is faster and chunkier. Default: the source's own width. |
| `height` | `height` | `number` | Working height, if `width` isn't given. |
| `effects` | `effects` | `string` | Effects to apply, in order, like CSS `filter`: `mosaic(4) palette(gameboy, ordered) adjust(contrast 1.3)`. They run after any effect elements inside. |
| `swatches` | `swatches` | `number` | Publish the result's N most common colors as `--pixel-swatch-1` … `--pixel-swatch-N` custom properties (and the `palette` property). Default: none. |
| `swatches-target` | `swatchesTarget` | `string` | A selector for more elements to set those custom properties on (for example `html`, to theme the page). They're always set on the `<pixel-canvas>` itself. |
| `fps` |  | `number` | Redraw at this rate, so effects that change over time (`glitch`, `wave`, your own) animate even on a still image. Without it, it redraws only when something changes (or every frame of a playing video). |
| `paused` | `paused` | `boolean` | Stops the clock effects animate by, and the `fps` redraws. Reflects; write it in markup to start paused. |
| `html` | `html` | `boolean` | Experimental: draw its own HTML content (live, and still interactive) through the effects, where the browser supports HTML-in-canvas; elsewhere the content shows as it is. Without `width`/`height`, one working pixel is one CSS pixel. |
| `gpu` | `gpu` | `boolean` | Run the effects on the GPU (WebGL2) when every effect in the chain can: the source is uploaded once and nothing is read back (unless `swatches` needs it). Otherwise, or without WebGL2, they run on the CPU as usual. `renderer` says which ran. |
| `transition` | `transition` | `string` | Animate changes to `effects` over this long (`400ms`, `0.5s`): numbers in the same effects are interpolated; a different list of effects cross-fades. Not for visitors who prefer reduced motion. |

### Properties

| Property | Type | Description |
|---|---|---|
| `time` (read-only) | `number` | Seconds on the clock that effects animate by. It runs while the element is connected and not paused (and, for visitors who prefer reduced motion, only once `play()` is called). |
| `paused` (read-only) | `boolean` | Whether the clock is paused. |
| `source` (read-only) | `Element \| null` | What's being drawn: the first element inside that's an `<img>`, `<video>`, or `<canvas>`, or that exposes a `canvas` property (like `<pixel-sprite>`). |
| `effectElements` (read-only) | `Element[]` | The effect elements wrapped around the source, in the order they run (innermost first). Disabled ones are included. |
| `effects` | `string` | Mirrors the `effects` attribute. |
| `swatches` | `number` | How many swatches to publish. Mirrors the `swatches` attribute. |
| `swatchesTarget` | `string` | Mirrors the `swatches-target` attribute. |
| `palette` (read-only) | `string[]` | With `swatches`: the result's most common colors, as `#rrggbb`, most common first. Empty otherwise. |
| `canvas` (read-only) | `HTMLCanvasElement` | The canvas showing the result (in the shadow root). |
| `gpu` | `boolean` | Mirrors the `gpu` attribute. |
| `html` | `boolean` | Mirrors the `html` attribute. |
| `transition` | `string` | Mirrors the `transition` attribute. |
| `renderer` (read-only) | `string` | Where the last redraw ran: `"gpu"`, `"cpu"`, or `""` before the first. |
| `width` | `number` | Mirrors the `width` attribute. |
| `height` | `number` | Mirrors the `height` attribute. |

### Methods

| Method | Description |
|---|---|
| `play()` | Start or resume the clock (and the `fps` redraws). |
| `pause()` | Pause the clock where it is. |
| `captureStream(fps)` | A video stream of the result, like `HTMLCanvasElement.captureStream()`. |
| `record(options)` | Record the result as a video (WebM where supported, else MP4), for `duration` seconds. Effects that change over time need `fps` (or a playing video) to animate while it records. |
| `toGIF(options)` | The result as an animated GIF, at the working size: `frames` frames (or `duration` seconds' worth) sampled `fps` times a second. Effects that change over time need `fps` (or a playing video) to animate while it captures. `loop`: 0 repeats forever, -1 plays once. |
| `toText(options)` | The result as text: with a `glyphs()` effect (or `<pixel-glyphs>`) in the chain, the characters it chose, one line per row; otherwise the result converted with `options` (the same as `glyphs()`'s parameters: `cell`, `chars`, `font`, `mode`, `background`). It waits for a redraw, which runs on the CPU, where the characters are known. Resolves to "" if there's nothing to draw. |
| `render()` | Draw now, instead of on the next frame. Returns whether it drew. |
| `toBlob(type, quality)` | The result as an image file, like `HTMLCanvasElement.toBlob()`. |
| `toDataURL(type, quality)` | The result as a data: URL, like `HTMLCanvasElement.toDataURL()`. |

### Events

| Event | Description |
|---|---|
| `play` | The clock started or resumed. |
| `pause` | The clock paused. |
| `load` | The first frame of a source was drawn. |
| `framechange` | After each redraw, so a `<pixel-canvas>` can be another one's source. |
| `palettechange` | With `swatches`: the published colors changed. |
| `error` | The source can't be read (for example, a cross-origin image without CORS) or an effect threw: an `ErrorEvent`, and the original content is shown instead. Also fired, once per name, for an unknown effect in `effects`, which is skipped. |

<!-- api:end -->

## Styling

| Selector | Matches |
|---|---|
| `pixel-canvas` | The element; size it like an image (`inline-size: 320px`) |
| `pixel-canvas::part(canvas)` | The canvas showing the result |
| `pixel-canvas[data-failed]` | It couldn't read the source, and shows the original content instead |

## Notes

- **Accessibility:** it's `role="img"`, named after the source's `alt`
  (or `aria-label`, or `title`). An empty `alt` makes it decorative
  (`role="presentation"`). Your own `aria-label` on the `<pixel-canvas>`
  wins.
- **Cross-origin images** can only be read if the server allows it (CORS)
  and the `<img>` has `crossorigin`. Otherwise it fires `error` and shows
  the original image unchanged.
- `load` fires once per source (and per new `src`), after its first
  frame is drawn, not on every redraw.
- Your own effects: see [Your own effects](../../README.md#your-own-effects).
