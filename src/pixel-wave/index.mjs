// <pixel-wave>: the wave() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply } from "./effect.mjs";

/**
 * Slides each row sideways along a sine wave that travels over time: water, heat haze, a waving flag. The element form of `wave(amplitude, wavelength, speed)`.
 *
 * @tag pixel-wave
 * @summary A pixel effect: an animated wave.
 *
 * @attr {number} amplitude - How far rows move, in pixels. Default 4.
 * @attr {number} wavelength - Rows per wave. Default 32.
 * @attr {number} speed - Waves per second on the canvas clock (negative reverses). Default 0.5.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelWave extends PixelEffect {
  static effect = { name: "wave", params, apply };
}
