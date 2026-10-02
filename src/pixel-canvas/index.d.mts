// Generated from custom-elements.json by scripts/manifest-outputs.mjs.
// Do not edit: change the JSDoc in index.mjs and run `npm run manifest`.

/** Draws its source image, video, or canvas through the pixel effects
 * wrapped around it. */
export default class PixelCanvas extends HTMLElement {
  /** The image, video, or canvas being drawn: the first one inside. */
  readonly source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null;
  /** The effect elements wrapped around the source, in the order they run
   * (innermost first). Disabled ones are included. */
  readonly effectElements: Element[];
  /** Mirrors the `effects` attribute. */
  effects: string;
  /** How many swatches to publish. Mirrors the `swatches` attribute. */
  swatches: number;
  /** Mirrors the `swatches-target` attribute. */
  swatchesTarget: string;
  /** With `swatches`: the result's most common colors, as `#rrggbb`, most
   * common first. Empty otherwise. */
  readonly palette: string[];
  /** The canvas showing the result (in the shadow root). */
  readonly canvas: HTMLCanvasElement;
  /** Draw now, instead of on the next frame. Returns whether it drew. */
  render(): boolean;
  /** The result as an image file, like `HTMLCanvasElement.toBlob()`. */
  toBlob(type?: string, quality?: number): Promise<Blob | null>;
  /** The result as a data: URL, like `HTMLCanvasElement.toDataURL()`. */
  toDataURL(type?: string, quality?: number): string;
  width: number;
  height: number;
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-canvas": PixelCanvas;
  }
}
