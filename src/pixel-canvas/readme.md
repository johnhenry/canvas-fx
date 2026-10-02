# pixel-canvas

Draws an image, video, or canvas through the
[pixel effects](../readme.md) wrapped around it. The first `<img>`,
`<video>`, or `<canvas>` inside is the source, and every effect element
between it and the `<pixel-canvas>` is applied, innermost first. Part of
[pixelable](../readme.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas width="120">
  <pixel-palette colors="1bit" dither="floyd-steinberg">
    <img src="portrait.jpg" alt="A portrait, dithered" />
  </pixel-palette>
</pixel-canvas>
```

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
- when anything inside changes: an effect's attributes, effects added or
  removed, a different source;
- when an effect calls `invalidate()`, or you call `render()` (which draws
  now and returns whether it could).

The light-DOM content stays in the document, so an image keeps loading
and a video keeps playing, but only the canvas is displayed.

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

### Properties

| Property | Type | Description |
|---|---|---|
| `source` (read-only) | `HTMLImageElement \| HTMLVideoElement \| HTMLCanvasElement \| null` | The image, video, or canvas being drawn: the first one inside. |
| `effects` (read-only) | `Element[]` | The effect elements applied to the source, in the order they run (innermost first). Disabled ones are included. |
| `canvas` (read-only) | `HTMLCanvasElement` | The canvas showing the result (in the shadow root). |
| `width` | `number` | Mirrors the `width` attribute. |
| `height` | `number` | Mirrors the `height` attribute. |

### Methods

| Method | Description |
|---|---|
| `render()` | Draw now, instead of on the next frame. Returns whether it drew. |
| `toBlob(type, quality)` | The result as an image file, like `HTMLCanvasElement.toBlob()`. |
| `toDataURL(type, quality)` | The result as a data: URL, like `HTMLCanvasElement.toDataURL()`. |

### Events

| Event | Description |
|---|---|
| `load` | The first frame of a source was drawn. |
| `error` | The source can't be read (for example, a cross-origin image without CORS) or an effect threw. An `ErrorEvent`; the original content is shown instead. |

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
- An effect is any element with an `apply(image)` method; see
  [writing an effect](../readme.md#writing-an-effect).
