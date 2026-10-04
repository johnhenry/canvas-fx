// <pixel-halftone>: the halftone() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, gpu } from "./effect.mjs";

/**
 * Turns the image into printed dots: each cell of a rotated grid becomes one dot, larger where it's darker. The element form of `halftone(size, angle, ink, paper)`.
 *
 * @tag pixel-halftone
 * @summary A pixel effect: halftone dots, like print.
 *
 * @attr {number} size - Cell size in pixels. Default 6.
 * @attr {number} angle - Grid angle in degrees. Default 45.
 * @attr {string} ink - Dot color, any CSS color, or `auto` for each cell's own color. Default black.
 * @attr {string} paper - Background color. Default white.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelHalftone extends PixelEffect {
  static effect = { name: "halftone", params, apply, gpu };
}
