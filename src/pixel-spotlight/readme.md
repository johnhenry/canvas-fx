# pixel-spotlight

Light around the pointer, the rest of the image dimmed: within `radius` of
the pointer the image is unchanged, beyond `radius + softness` it's darkened
by `dim`, with a smooth falloff between. While the pointer is away, the
image is unchanged. Use it as `spotlight(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [canvas-fx](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/canvas-fx/global.mjs"></script>

<pixel-canvas width="320" effects="spotlight(40, 20, 0.8)">
  <img src="painting.jpg" alt="A painting" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="320">
  <pixel-spotlight radius="40" softness="20" dim="0.8">
    <img src="painting.jpg" alt="A painting" />
  </pixel-spotlight>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `radius` |  | `number` | The lit circle's radius, in working pixels. Default 32. |
| `softness` |  | `number` | How far the light fades out beyond the radius. Default 16. |
| `dim` |  | `number` | How dark the rest gets, 0–1. Default 0.7. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Runs on the GPU too (`<pixel-canvas gpu>`).
- Works over live HTML (`<pixel-canvas html>`): a reading light over a page.
