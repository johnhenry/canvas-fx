// <pixel-adjust>: the adjust() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply } from "./effect.mjs";

/**
 * Adjusts brightness, contrast, saturation, and hue, like the CSS filter functions of those names. The element form of `adjust(brightness, contrast, saturation, hue)`.
 *
 * @tag pixel-adjust
 * @summary A pixel effect: brightness, contrast, saturation, and hue.
 *
 * @attr {number} brightness - Multiplier: 1 is unchanged, 0 is black. Default 1.
 * @attr {number} contrast - Multiplier around mid-gray: 1 is unchanged, 0 is flat gray. Default 1.
 * @attr {number} saturation - Multiplier: 1 is unchanged, 0 is grayscale. Default 1.
 * @attr {number} hue - Rotation in degrees. Default 0.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelAdjust extends PixelEffect {
  static effect = { name: "adjust", params, apply };
}
