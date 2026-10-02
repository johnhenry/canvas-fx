# pixelable

Pixel effects for any image, video, or canvas, written as HTML. Wrap the
image in the effects you want, innermost first, and wrap all of that in a
`<pixel-canvas>`, which draws the result:

```html
<script type="module" src="https://esm.sh/@johnhenry/domkit/pixelable/global.mjs"></script>

<pixel-canvas width="160">
  <pixel-palette colors="gameboy" dither="ordered">
    <pixel-mosaic size="2">
      <img src="photo.jpg" alt="Our cat" />
    </pixel-mosaic>
  </pixel-palette>
</pixel-canvas>
```

Read it from the inside out: the photo is pixelated, then reduced to the
Game Boy's four greens. Before the script loads, or if the image can't be
read, the plain `<img>` shows, so nothing is lost.

| Module | Element | What it does |
|---|---|---|
| [pixel-canvas](./pixel-canvas/readme.md) | `<pixel-canvas>` | Draws its source through the effects around it; redraws on load, on changes, and every frame of a playing video |
| [pixel-mosaic](./pixel-mosaic/readme.md) | `<pixel-mosaic size="8">` | Pixelates into blocks of one color |
| [pixel-palette](./pixel-palette/readme.md) | `<pixel-palette colors="pico-8" dither="floyd-steinberg">` | Limits the colors to a palette, with dithering |
| [pixel-grid](./pixel-grid/readme.md) | `<pixel-grid size="8">` | Draws grid lines between cells |
| [pixel-filter.mjs](./pixel-filter.mjs) | | `PixelFilter` and `definePixelFilter()`, for writing your own effects |

`global.mjs` here registers all four elements; each module also has its
own `global.mjs`.

## Ideas

- **Retro art:** any photo in Game Boy greens, PICO-8 colors, or 1-bit
  newspaper dither.
- **A live camera effect:** put a `<video>` showing `getUserMedia()` inside,
  and every frame is redrawn.
- **Privacy:** a `<pixel-mosaic size="16">` blurs faces or screenshots
  beyond recognition, on the client.
- **Previews for small screens:** what an image looks like on an e-ink or
  LED panel, with `<pixel-palette colors="#000 #fff">` and `<pixel-grid>`.
- **Your own effects:** a few lines with `definePixelFilter()`.

## Writing an effect

An effect is any element with an `apply(image)` method that takes an
`ImageData` and returns one. The quickest way to make one:

```js
import { definePixelFilter } from "@johnhenry/domkit/pixelable/pixel-filter.mjs";

definePixelFilter("pixel-invert", (image) => {
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 255 - image.data[i];
    image.data[i + 1] = 255 - image.data[i + 1];
    image.data[i + 2] = 255 - image.data[i + 2];
  }
  return image;
});
```

```html
<pixel-canvas><pixel-invert><img src="photo.jpg" alt="…" /></pixel-invert></pixel-canvas>
```

The function also receives the element, to read its attributes:
`(image, element) => …`. For more control, extend `PixelFilter` and
override `apply()`. Either way you get `disabled` (pass the image
through) and `invalidate()` (redraw after a change that isn't an
attribute; attribute changes already redraw).

## Notes

- Effects run on the CPU, once per redraw. For video, keep the working
  size small (`<pixel-canvas width="160">`) and scale the result up with
  CSS. It's drawn with `image-rendering: pixelated`, so it stays crisp.
- Formerly `experimental/imagedata-emitter`, `pixel-shader`, and
  `canvas-renderer`, a pipeline that passed `render` events up through
  nested elements from a built-in 6×6 bitmap.
