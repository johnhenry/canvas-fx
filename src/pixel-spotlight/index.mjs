// <pixel-spotlight>: the spotlight() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, gpu, pointer } from "./effect.mjs";

/**
 * Light around the pointer, the rest of the image dimmed. The element form of `spotlight(radius, softness, dim)`.
 *
 * @tag pixel-spotlight
 * @summary A pixel effect: a spotlight that follows the pointer.
 *
 * @attr {number} radius - The lit circle's radius, in working pixels. Default 32.
 * @attr {number} softness - How far the light fades out beyond the radius. Default 16.
 * @attr {number} dim - How dark the rest gets, 0–1. Default 0.7.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelSpotlight extends PixelEffect {
  static effect = { name: "spotlight", params, apply, gpu, pointer };
}
