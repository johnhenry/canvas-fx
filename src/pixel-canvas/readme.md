# pixel-canvas

Draws an image, video, or canvas through [pixel effects](../readme.md),
listed in its `effects` attribute like CSS `filter`, or wrapped around the
source as elements. The first `<img>`, `<video>`, or `<canvas>` inside is
the source, or a [`<pixel-sprite>`](../pixel-sprite/readme.md). Part of
[pixelable](../readme.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas width="120" effects="adjust(contrast 1.2) palette(1bit, floyd-steinberg)">
  <img src="portrait.jpg" alt="A portrait, dithered" />
</pixel-canvas>
```

## Effects

`effects` lists effects to run left to right, each as `name(…)` with its
parameters in order or by name (see the [effects table](../readme.md#effects)).
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
- The content's elements are drawn, so put text inside an element (bare
  text directly inside the `<pixel-canvas>` isn't drawn).
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
[`<frame-timer>`](../../frame-timer/readme.md). Pausing freezes `time`
(and the `fps` redraws), not a video source. For visitors who prefer
reduced motion, the clock waits for `play()`.

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
| `html` |  | `boolean` | Experimental: draw its own HTML content (live, and still interactive) through the effects, where the browser supports HTML-in-canvas; elsewhere the content shows as it is. Without `width`/`height`, one working pixel is one CSS pixel. |

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
| `width` | `number` | Mirrors the `width` attribute. |
| `height` | `number` | Mirrors the `height` attribute. |

### Methods

| Method | Description |
|---|---|
| `play()` | Start or resume the clock (and the `fps` redraws). |
| `pause()` | Pause the clock where it is. |
| `render()` | Draw now, instead of on the next frame. Returns whether it drew. |
| `toBlob(type, quality)` | The result as an image file, like `HTMLCanvasElement.toBlob()`. |
| `toDataURL(type, quality)` | The result as a data: URL, like `HTMLCanvasElement.toDataURL()`. |

### Events

| Event | Description |
|---|---|
| `play` | The clock started or resumed. |
| `pause` | The clock paused. |
| `load` | The first frame of a source was drawn. |
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
- Your own effects: see [Your own effects](../readme.md#your-own-effects).
