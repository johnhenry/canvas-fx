// <pixel-grid size="8">: the grid() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply } from "./effect.mjs";

/**
 * Draws grid lines every `size` pixels. The element form of
 * `grid(size, color, line)`.
 *
 * @tag pixel-grid
 * @summary A pixel effect: grid lines between cells.
 *
 * @attr {number} size - Cell size, in the working image's pixels. Default 8.
 * @attr {string} color - Line color, any CSS color (transparency blends). Default `rgb(0 0 0 / 0.35)`.
 * @attr {number} line - Line thickness in pixels. Default 1.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelGrid extends PixelEffect {
  static effect = { name: "grid", params, apply };
}
