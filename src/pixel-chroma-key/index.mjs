// <pixel-chroma-key>: the chroma-key() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, gpu } from "./effect.mjs";

/**
 * Makes one color transparent, like a green screen. The element form of `chroma-key(color, tolerance, softness)`.
 *
 * @tag pixel-chroma-key
 * @summary A pixel effect: make a color transparent (green screen).
 *
 * @attr {string} color - The color to remove, any CSS color. Default `lime`.
 * @attr {number} tolerance - How different a color can be and still be removed, 0–1. Default 0.3.
 * @attr {number} softness - A fade beyond the tolerance, 0–1, for smooth edges. Default 0.1.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelChromaKey extends PixelEffect {
  static effect = { name: "chroma-key", params, apply, gpu };
}
