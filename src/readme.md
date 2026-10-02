# pixelable

Pixel effects for any image, video, or canvas, written as HTML. Put the
image in a `<pixel-canvas>` and list the effects, like CSS `filter`:

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas width="160" effects="adjust(contrast 1.3) palette(gameboy, ordered)">
  <img src="photo.jpg" alt="Our cat" />
</pixel-canvas>
```

Effects run left to right: here the contrast is raised, then the photo is
reduced to the Game Boy's four greens. Before the script loads, or if the
image can't be read, the plain `<img>` shows, so nothing is lost.

## Effects

| Function | Element | What it does |
|---|---|---|
| `mosaic(size)` | [`<pixel-mosaic>`](./pixel-mosaic/readme.md) | Pixelates into blocks of one color |
| `palette(colors, dither, count)` | [`<pixel-palette>`](./pixel-palette/readme.md) | Limits the colors to a palette (`gameboy`, `pico-8`, `1bit`, …, any CSS colors, or `auto` from the image), with dithering |
| `grid(size, color, line)` | [`<pixel-grid>`](./pixel-grid/readme.md) | Grid lines between cells |
| `adjust(brightness, contrast, saturation, hue)` | [`<pixel-adjust>`](./pixel-adjust/readme.md) | Tone and color, like the CSS filter functions |
| `halftone(size, angle, ink, paper)` | [`<pixel-halftone>`](./pixel-halftone/readme.md) | Printed dots |
| `outline(threshold, ink, paper)` | [`<pixel-outline>`](./pixel-outline/readme.md) | Line art from edges |
| `crt(scanlines, mask, glow)` | [`<pixel-crt>`](./pixel-crt/readme.md) | An old screen: scanlines and a color stripe mask |
| `chroma-key(color, tolerance, softness)` | [`<pixel-chroma-key>`](./pixel-chroma-key/readme.md) | Makes a color transparent (green screen) |

The [`<pixel-canvas>`](./pixel-canvas/readme.md) draws the result.
`global.mjs` here registers it and every effect element; for the
`effects` attribute alone, `pixel-canvas/global.mjs` is enough.

## Writing effects

**As a function**, parameters fill in order, or by name: `palette(gameboy,
ordered)` and `palette(dither ordered, colors gameboy)` are the same.
Values are as you'd write them in CSS (`grid(8, rgb(0 0 0 / 0.5))`).
An effect can appear more than once.

**As elements** wrapped around the source, each effect's parameters are
attributes, and the effects apply from the inside out:

```html
<pixel-canvas width="160">
  <pixel-palette colors="gameboy" dither="ordered">  <!-- 2. then this -->
    <pixel-adjust contrast="1.3">                    <!-- 1. this first -->
      <img src="photo.jpg" alt="Our cat" />
    </pixel-adjust>
  </pixel-palette>
</pixel-canvas>
```

Elements earn their keep when you want to switch one effect on and off
(`disabled`, say from a checkbox) or drive it from script. Both forms can
be mixed: the elements run first (they're inside), then the attribute's
list.

## Your own effects

`definePixelEffect()` registers an effect for both forms:

```js
import { definePixelEffect, number } from "@johnhenry/domkit/pixelable/effects.mjs";

definePixelEffect(
  "posterize",
  (image, params) => {
    const levels = number(params.levels, 4, { min: 2 });
    const step = 255 / (levels - 1);
    for (let i = 0; i < image.data.length; i += 4) {
      for (let c = 0; c < 3; c++) image.data[i + c] = Math.round(image.data[i + c] / step) * step;
    }
    return image;
  },
  { params: ["levels"] },
);
```

```html
<pixel-canvas effects="posterize(3)">…</pixel-canvas>
<pixel-canvas><pixel-posterize levels="3">…</pixel-posterize></pixel-canvas>
```

The function gets the `ImageData` and the parameters as strings, by name
(`number()` and `parseColor()` help read them), and returns an
`ImageData`. A canvas already showing an effect that wasn't defined yet
redraws once it is. For an effect with its own state, extend `PixelEffect`
and override `apply(image)`; call `invalidate()` after a change that isn't
an attribute. Any element with an `apply(image)` method works.

## Ideas

- **Retro art:** any photo in Game Boy greens, PICO-8 colors, 1-bit
  dither, or as halftone print.
- **A live camera effect:** a `<video>` showing `getUserMedia()` is
  redrawn every frame. Add `chroma-key(lime)` and a CSS background on the
  `<pixel-canvas>` for a virtual backdrop.
- **Privacy:** `mosaic(16)` makes faces or screenshots unrecognizable, on
  the client.
- **Theme from a picture:** `<pixel-canvas swatches="3" swatches-target="html">`
  sets `--pixel-swatch-1` … `--pixel-swatch-3` from an album cover or
  photo, for the page's CSS to use.
- **Previews:** what an image looks like on an e-ink panel
  (`palette(#000 #fff, floyd-steinberg)`) or an old TV (`crt()`).

## Notes

- Effects run on the CPU, once per redraw. For video, keep the working
  size small (`<pixel-canvas width="160">`) and scale the result up with
  CSS. It's drawn with `image-rendering: pixelated`, so it stays crisp.
- Formerly `experimental/imagedata-emitter`, `pixel-shader`, and
  `canvas-renderer`.
