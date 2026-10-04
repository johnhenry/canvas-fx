# pixel-palette

A pixel effect that limits the image to a palette, optionally with
dithering, which spreads the error as patterns of dots so gradients
survive. Use it as `palette(colors, dither)` in a [`<pixel-canvas>`](../pixel-canvas/readme.md)'s
`effects`, or as this element wrapped around the source.
Part of [canvas-fx](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/canvas-fx/global.mjs"></script>

<pixel-canvas width="160" effects="palette(gameboy, ordered)">
  <img src="photo.jpg" alt="A photo in Game Boy colors" />
</pixel-canvas>

<!-- or, as an element -->
<pixel-canvas width="160">
  <pixel-palette colors="gameboy" dither="ordered">
    <img src="photo.jpg" alt="A photo in Game Boy colors" />
  </pixel-palette>
</pixel-canvas>
```

## Palettes

`colors` is a named palette, a space-separated list of any CSS colors
(`colors="#000 white rgb(255 0 0)"`), or `auto`, which picks `count`
colors from the image itself: `palette(auto, floyd-steinberg, 6)`.

| Name | Colors |
|---|---|
| `1bit` (default) | black, white |
| `gameboy` | four greens |
| `grayscale` | four grays |
| `cga` | black, cyan, magenta, white |
| `sepia` | four browns |
| `pico-8` | the 16 PICO-8 colors |
| `auto` | the image's own dominant colors, `count` of them (default 8) |

The named palettes are the default export of `palettes.mjs`, and
the `palette` property gives the resolved colors as `[r, g, b]` triples.

## Dithering

| `dither` | Looks like |
|---|---|
| `none` (default) | Flat areas of the nearest color |
| `floyd-steinberg` | Fine, organic noise: error diffusion, best for photos |
| `ordered` | A regular cross-hatch: a 4×4 Bayer matrix, the classic retro look, and stable from frame to frame on video |

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `colors` |  | `string` | A named palette (`1bit`, `gameboy`, `grayscale`, `cga`, `sepia`, `pico-8`), space-separated CSS colors, or `auto` (the image's own dominant colors). Default `1bit`. |
| `dither` |  | `string` | `none` (default), `floyd-steinberg` (error diffusion), or `ordered` (a 4×4 Bayer pattern). |
| `count` |  | `number` | With `colors="auto"`: how many colors to pick. Default 8. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

### Properties

| Property | Type | Description |
|---|---|---|
| `palette` (read-only) | `number[][]` | The resolved palette, as `[r, g, b]` triples. Empty for `auto`, which depends on the image (see `<pixel-canvas>`'s `palette`). |

<!-- api:end -->

## Notes

- The nearest color is chosen by distance weighted for how eyes see
  brightness (more weight on green).
- Transparency is kept as it is; only red, green, and blue are mapped.
- With `auto` on a video, the palette is picked again every frame, so it
  can shift as the picture changes.
