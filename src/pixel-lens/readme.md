# pixel-lens

A magnifying glass that follows the pointer: inside a circle around it, the
image is enlarged `zoom` times; elsewhere, and while the pointer is away,
it's unchanged. Use it as `lens(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [pixelable](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/pixelable/global.mjs"></script>

<pixel-canvas width="320" effects="lens(32, 3)">
  <img src="map.png" alt="A city map" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="320">
  <pixel-lens radius="32" zoom="3">
    <img src="map.png" alt="A city map" />
  </pixel-lens>
</pixel-canvas>
```

The canvas redraws as the pointer moves; no `fps` needed. Radius is in
working pixels (the `<pixel-canvas>`'s `width`), not screen pixels.

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `radius` |  | `number` | The lens's radius, in working pixels. Default 24. |
| `zoom` |  | `number` | How much it enlarges. Default 2. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Runs on the GPU too (`<pixel-canvas gpu>`).
- Over live HTML (`<pixel-canvas html>`), the lens moves the picture, not
  the hit areas: clicks go where the content really is.
