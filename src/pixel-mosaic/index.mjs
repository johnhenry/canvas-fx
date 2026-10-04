// <pixel-mosaic size="8">: the mosaic() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, gpu } from "./effect.mjs";

/**
 * Pixelates the image: each `size`×`size` block becomes its average color.
 * The element form of `mosaic(size)`.
 *
 * @tag pixel-mosaic
 * @summary A pixel effect: pixelate into blocks of one color.
 *
 * @attr {number} size - Block size, in the working image's pixels. Default 8.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelMosaic extends PixelEffect {
  static effect = { name: "mosaic", params, apply, gpu };
}
