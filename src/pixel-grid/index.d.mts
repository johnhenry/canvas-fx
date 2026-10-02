// Generated from custom-elements.json by scripts/manifest-outputs.mjs.
// Do not edit: change the JSDoc in index.mjs and run `npm run manifest`.

/** Draws grid lines every `size` pixels. */
export default class PixelGrid extends HTMLElement {
  /** Cell size. Mirrors the `size` attribute. */
  size: number;
  apply(image: ImageData): ImageData;
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-grid": PixelGrid;
  }
}
