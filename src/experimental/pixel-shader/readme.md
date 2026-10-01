# pixel-shader

> Experimental. See [experimental](../readme.md) for what that means.

The middle of the [pixel pipeline](../readme.md#the-pixel-pipeline): two
element classes, each of which catches a `render` event coming up from
its children, transforms the `ImageData` in `event.detail`, stops the
original event, and dispatches a new `render` on its parent element.

```js
import { zoom, grid } from "@johnhenry/domkit/experimental/pixel-shader";
customElements.define("pixel-zoom", zoom);
customElements.define("pixel-grid", grid);
```

| Export | Attributes | Transform |
|---|---|---|
| `zoom` | `value`: a factor (`"4"`) or `"x,y"` factors (`"4,2"`) | Nearest-neighbor upscaling. Output is `width × x` wide |
| `grid` | `width`, `height`: cell size in pixels | Makes the pixels on each cell's edge transparent, which draws a grid |

Both are `display: contents`, so they add no layout. Attributes are read
on connect. Stack them in any order, since each one only sees the output
of the layers inside it.

See [`canvas-renderer/demo.html`](../canvas-renderer/demo.html) for both
running.
