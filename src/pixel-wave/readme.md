# pixel-wave

Slides each row sideways along a sine wave that travels over time: water, heat haze, a flag in the wind. Give the `<pixel-canvas>` an `fps` to animate it. Use it as `wave(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [pixelable](../readme.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas width="200" fps="30" effects="wave(3, 24, 0.5)">
  <img src="photo.jpg" alt="A photo" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="200" fps="30">
  <pixel-wave amplitude="3" wavelength="24">
    <img src="photo.jpg" alt="A photo" />
  </pixel-wave>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `amplitude` |  | `number` | How far rows move, in pixels. Default 4. |
| `wavelength` |  | `number` | Rows per wave. Default 32. |
| `speed` |  | `number` | Waves per second on the canvas clock (negative reverses). Default 0.5. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Rows move by whole pixels; the edges stretch rather than wrap around.
- `speed="0"` gives a still ripple.
- Like everything that moves here, it holds still for visitors who prefer
  reduced motion, until the canvas's `play()` is called.
