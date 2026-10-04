# pixel-glitch

Digital breakup: bands of rows slide sideways and the red and blue channels split apart, differently at each step of the canvas clock. Give the `<pixel-canvas>` an `fps` to animate it on a still image; on a playing video it animates anyway. Use it as `glitch(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [pixelable](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/pixelable/global.mjs"></script>

<pixel-canvas width="200" fps="12" effects="glitch(0.4)">
  <img src="photo.jpg" alt="A photo" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="200" fps="30">
  <pixel-glitch amount="0.4">
    <img src="photo.jpg" alt="A photo" />
  </pixel-glitch>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `amount` |  | `number` | How broken, 0 (none) to 1. Default 0.3. |
| `rate` |  | `number` | New glitches per second of the canvas clock. Default 8. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- The breakup is random but repeatable: the same moment on the clock always looks the same, so a paused canvas holds still.
- `rate` sets how many times a second it changes; the canvas only shows the steps it redraws.
- Like everything that moves here, it holds still for visitors who prefer
  reduced motion, until the canvas's `play()` is called.
