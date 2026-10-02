# pixel-grid

A pixel effect that draws grid lines every `size` pixels, like the seams
between tiles or the cells of an LED panel. Use it as `grid(size, color, line)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element, usually around a
[`<pixel-mosaic>`](../pixel-mosaic/readme.md) of the same size. Part of
[pixelable](../readme.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas effects="mosaic(8) grid(8, rgb(0 0 0 / 0.5))">
  <img src="photo.jpg" alt="A photo as tiles" />
</pixel-canvas>

<!-- or, as elements -->
<pixel-canvas>
  <pixel-grid size="8" color="rgb(0 0 0 / 0.5)">
    <pixel-mosaic size="8">
      <img src="photo.jpg" alt="A photo as tiles" />
    </pixel-mosaic>
  </pixel-grid>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `size` |  | `number` | Cell size, in the working image's pixels. Default 8. |
| `color` |  | `string` | Line color, any CSS color (transparency blends). Default `rgb(0 0 0 / 0.35)`. |
| `line` |  | `number` | Line thickness in pixels. Default 1. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Lines run along the top and left of each cell, `line` pixels thick, in
  the working image's pixels.
- A translucent `color` blends with the image beneath; an opaque one
  replaces it.
