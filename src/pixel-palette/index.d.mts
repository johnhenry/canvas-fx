// Generated from custom-elements.json by scripts/manifest-outputs.mjs.
// Do not edit: change the JSDoc in index.mjs and run `npm run manifest`.

/** Reduces the image to a palette, optionally dithered. The element form of
 * `palette(colors, dither)`. */
export default class PixelPalette extends HTMLElement {
  /** The resolved palette, as `[r, g, b]` triples. Empty for `auto`, which
   * depends on the image (see `<pixel-canvas>`'s `palette`). */
  readonly palette: number[][];
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-palette": PixelPalette;
  }
}
