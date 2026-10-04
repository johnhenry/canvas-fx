# pixel-halftone

Turns the image into printed dots, like a newspaper photo: the image is divided into cells on a grid rotated by `angle`, and each cell becomes one dot, larger where the image is darker. With `ink="auto"`, each dot takes its cell's color. Use it as `halftone(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [canvas-fx](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/canvas-fx/global.mjs"></script>

<pixel-canvas width="200" effects="halftone(5)">
  <img src="photo.jpg" alt="A photo" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="200">
  <pixel-halftone size="5" ink="auto">
    <img src="photo.jpg" alt="A photo" />
  </pixel-halftone>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `size` |  | `number` | Cell size in pixels. Default 6. |
| `angle` |  | `number` | Grid angle in degrees. Default 45. |
| `ink` |  | `string` | Dot color, any CSS color, or `auto` for each cell's own color. Default black. |
| `paper` |  | `string` | Background color. Default white. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Dot area follows darkness, so mid-gray covers about half the paper.
- Run `adjust(contrast …)` first for punchier dots.
