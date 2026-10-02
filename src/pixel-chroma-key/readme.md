# pixel-chroma-key

Makes one color transparent, like a green screen, so whatever is behind the `<pixel-canvas>` shows through. Pixels near the color fade out over `softness`, for smoother edges. Use it as `chroma-key(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [pixelable](../readme.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas width="200" effects="chroma-key(lime, 0.35)">
  <img src="photo.jpg" alt="A photo" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="200">
  <pixel-chroma-key color="#00b140" tolerance="0.35">
    <img src="photo.jpg" alt="A photo" />
  </pixel-chroma-key>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `color` |  | `string` | The color to remove, any CSS color. Default `lime`. |
| `tolerance` |  | `number` | How different a color can be and still be removed, 0–1. Default 0.3. |
| `softness` |  | `number` | A fade beyond the tolerance, 0–1, for smooth edges. Default 0.1. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Put the new background on the `<pixel-canvas>` with CSS (`background: url(beach.jpg) center / cover`).
- With a camera `<video>` as the source, that's a virtual backdrop in HTML.
