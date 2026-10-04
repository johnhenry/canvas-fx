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
  /** Mirrors the `gpu` attribute. */
  gpu: boolean;
  /** Mirrors the `html` attribute. */
  html: boolean;
  /** Mirrors the `transition` attribute. */
  transition: string;
  /** Where the last redraw ran: `"gpu"`, `"cpu"`, or `""` before the first. */
  readonly renderer: string;
  /** A video stream of the result, like `HTMLCanvasElement.captureStream()`. */
  captureStream(fps?: number): MediaStream;
  /** Record the result as a video (WebM where supported, else MP4), for
   * `duration` seconds. Effects that change over time need `fps` (or a
   * playing video) to animate while it records. */
  record(options?: { duration?: number, fps?: number, type?: string }): Promise<Blob>;
  /** The result as an animated GIF, at the working size: `frames` frames
   * (or `duration` seconds' worth) sampled `fps` times a second. Effects
   * that change over time need `fps` (or a playing video) to animate while
   * it captures. `loop`: 0 repeats forever, -1 plays once. */
  toGIF(options?: { duration?: number, fps?: number, frames?: number, loop?: number }): Promise<Blob>;
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
