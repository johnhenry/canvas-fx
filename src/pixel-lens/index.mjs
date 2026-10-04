// <pixel-lens>: the lens() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, gpu, pointer } from "./effect.mjs";

/**
 * A magnifying glass that follows the pointer over the `<pixel-canvas>`. The element form of `lens(radius, zoom)`.
 *
 * @tag pixel-lens
 * @summary A pixel effect: a magnifying glass at the pointer.
 *
 * @attr {number} radius - The lens's radius, in working pixels. Default 24.
 * @attr {number} zoom - How much it enlarges. Default 2.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelLens extends PixelEffect {
  static effect = { name: "lens", params, apply, gpu, pointer };
}
