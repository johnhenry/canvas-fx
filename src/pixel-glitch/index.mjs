// <pixel-glitch>: the glitch() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply } from "./effect.mjs";

/**
 * Digital breakup: bands of rows slide sideways and the red and blue channels split, differently at each step of the canvas clock. The element form of `glitch(amount, rate)`.
 *
 * @tag pixel-glitch
 * @summary A pixel effect: animated digital glitches.
 *
 * @attr {number} amount - How broken, 0 (none) to 1. Default 0.3.
 * @attr {number} rate - New glitches per second of the canvas clock. Default 8.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelGlitch extends PixelEffect {
  static effect = { name: "glitch", params, apply };
}
