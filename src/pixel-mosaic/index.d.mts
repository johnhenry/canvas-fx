// Generated from custom-elements.json by scripts/manifest-outputs.mjs.
// Do not edit: change the JSDoc in index.mjs and run `npm run manifest`.

/** Pixelates the image: each `size`×`size` block becomes its average color. */
export default class PixelMosaic extends HTMLElement {
  /** Block size. Mirrors the `size` attribute. */
  size: number;
  apply(image: ImageData): ImageData;
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-mosaic": PixelMosaic;
  }
}
