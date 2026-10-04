// <pixel-crt>: the crt() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, gpu } from "./effect.mjs";

/**
 * Makes the image look like an old screen: scanlines, a red/green/blue stripe mask, and a little glow. The element form of `crt(scanlines, mask, glow)`.
 *
 * @tag pixel-crt
 * @summary A pixel effect: an old CRT screen.
 *
 * @attr {number} scanlines - How much alternate rows are darkened, 0–1. Default 0.35.
 * @attr {number} mask - Strength of the color stripe mask, 0–1. Default 0.25.
 * @attr {number} glow - Overall brightness boost. Default 1.15.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelCrt extends PixelEffect {
  static effect = { name: "crt", params, apply, gpu };
}
