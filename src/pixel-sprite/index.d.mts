// Generated from custom-elements.json by scripts/manifest-outputs.mjs.
// Do not edit: change the JSDoc in index.mjs and run `npm run manifest`.

/** Pixel art written as text: one character per pixel, one line per row,
 * and a blank line between animation frames. */
export default class PixelSprite extends HTMLElement {
  /** The canvas it's drawn on (in the shadow root), at one pixel per
   * character. */
  readonly canvas: HTMLCanvasElement;
  /** How many frames there are. */
  readonly frames: number;
  /** The frame showing, from 0. Setting it shows that frame (wrapping). */
  frame: number;
  /** Whether the animation is paused. */
  readonly paused: boolean;
  /** Play the frames (at `fps`). */
  play(): void;
  /** Pause on the current frame. */
  pause(): void;
  width: number;
  height: number;
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-sprite": PixelSprite;
  }
}
