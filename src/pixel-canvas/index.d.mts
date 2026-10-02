// Generated from custom-elements.json by scripts/manifest-outputs.mjs.
// Do not edit: change the JSDoc in index.mjs and run `npm run manifest`.

/** Draws its source image, video, or canvas through the pixel effects
 * wrapped around it. */
export default class PixelCanvas extends HTMLElement {
  /** Seconds on the clock that effects animate by. It runs while the
   * element is connected and not paused (and, for visitors who prefer
   * reduced motion, only once `play()` is called). */
  readonly time: number;
  /** Whether the clock is paused. */
  readonly paused: boolean;
  /** Start or resume the clock (and the `fps` redraws). */
  play(): void;
  /** Pause the clock where it is. */
  pause(): void;
  /** What's being drawn: the first element inside that's an `<img>`,
   * `<video>`, or `<canvas>`, or that exposes a `canvas` property (like
   * `<pixel-sprite>`). */
  readonly source: Element | null;
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
