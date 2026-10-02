# pixel-outline

Draws line art from the image's edges, where brightness changes sharply (a Sobel filter). With `paper="none"`, the lines are drawn over the image instead, for a comic look. Use it as `outline(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [pixelable](../readme.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas width="200" effects="outline(0.15)">
  <img src="photo.jpg" alt="A photo" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="200">
  <pixel-outline threshold="0.15" paper="none">
    <img src="photo.jpg" alt="A photo" />
  </pixel-outline>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `threshold` |  | `number` | Edge strength needed for a line, 0–1. Lower draws more lines. Default 0.2. |
| `ink` |  | `string` | Line color. Default black. |
| `paper` |  | `string` | Background color, or `none` to draw the lines over the image. Default white. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Lower `threshold` draws more lines; noisy photos look better with `mosaic(2)` or a smaller working `width` first.
- Lines are about two pixels wide, one each side of an edge.
