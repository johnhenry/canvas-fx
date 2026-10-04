# pixel-mosaic

A pixel effect that pixelates: each `size`×`size` block of the image
becomes its average color. Use it as `mosaic(size)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of
[pixelable](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/pixelable/global.mjs"></script>

<pixel-canvas effects="mosaic(12)">
  <img src="screenshot.png" alt="A screenshot, pixelated for privacy" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas>
  <pixel-mosaic size="12">
    <img src="screenshot.png" alt="A screenshot, pixelated for privacy" />
  </pixel-mosaic>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `size` |  | `number` | Block size, in the working image's pixels. Default 8. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- `size` is in the working image's pixels, so it's relative to
  `<pixel-canvas width>`. A smaller working width pixelates too, more
  cheaply, but with blocks that follow the image's scaling rather than a
  fixed grid.
- Pair it with a [`<pixel-grid>`](../pixel-grid/readme.md) of the same
  `size` for visible tiles.
