# pixel-adjust

Adjusts brightness, contrast, saturation, and hue, like the CSS filter functions of the same names. Run it before `palette()`: a little extra contrast makes dithering much cleaner. Use it as `adjust(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [pixelable](../readme.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas width="200" effects="adjust(contrast 1.4, saturation 1.2) palette(pico-8)">
  <img src="photo.jpg" alt="A photo" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="200">
  <pixel-adjust contrast="1.4" saturation="1.2">
    <img src="photo.jpg" alt="A photo" />
  </pixel-adjust>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `brightness` |  | `number` | Multiplier: 1 is unchanged, 0 is black. Default 1. |
| `contrast` |  | `number` | Multiplier around mid-gray: 1 is unchanged, 0 is flat gray. Default 1. |
| `saturation` |  | `number` | Multiplier: 1 is unchanged, 0 is grayscale. Default 1. |
| `hue` |  | `number` | Rotation in degrees. Default 0. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Brightness, then contrast, then saturation, then hue, in that order, using the matrices from the Filter Effects spec.
- Values may be written as percentages too: `adjust(contrast 140%)`.
