# pixel-crt

Makes the image look like an old screen: alternate rows darkened like scanlines, columns tinted red, green, and blue like a shadow mask, and a little glow to make up the lost light. Use it as `crt(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [pixelable](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/pixelable/global.mjs"></script>

<pixel-canvas width="200" effects="palette(cga) crt()">
  <img src="photo.jpg" alt="A photo" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="200">
  <pixel-crt scanlines="0.5">
    <img src="photo.jpg" alt="A photo" />
  </pixel-crt>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `scanlines` |  | `number` | How much alternate rows are darkened, 0–1. Default 0.35. |
| `mask` |  | `number` | Strength of the color stripe mask, 0–1. Default 0.25. |
| `glow` |  | `number` | Overall brightness boost. Default 1.15. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- It works per pixel of the working image, so scale the result up with CSS (`image-rendering: pixelated` keeps the stripes crisp).
- Pairs with `palette(cga)` or `palette(pico-8)`.
