// <pixel-palette colors="gameboy" dither="ordered">: the palette() effect
// as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, resolvePalette } from "./effect.mjs";

/**
 * Reduces the image to a palette, optionally dithered. The element form of
 * `palette(colors, dither)`.
 *
 * @tag pixel-palette
 * @summary A pixel effect: limit colors to a palette, with dithering.
 *
 * @attr {string} colors - A named palette (`1bit`, `gameboy`, `grayscale`, `cga`, `sepia`, `pico-8`), space-separated CSS colors, or `auto` (the image's own dominant colors). Default `1bit`.
 * @attr {string} dither - `none` (default), `floyd-steinberg` (error diffusion), or `ordered` (a 4×4 Bayer pattern).
 * @attr {number} count - With `colors="auto"`: how many colors to pick. Default 8.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelPalette extends PixelEffect {
  static effect = { name: "palette", params, apply };

  /**
   * The resolved palette, as `[r, g, b]` triples. Empty for `auto`, which
   * depends on the image (see `<pixel-canvas>`'s `palette`).
   * @type {number[][]}
   * @readonly
   */
  get palette() {
    return resolvePalette(this.getAttribute("colors"));
  }
}

export { PALETTES } from "./effect.mjs";
