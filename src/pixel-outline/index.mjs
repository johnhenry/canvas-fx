// <pixel-outline>: the outline() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, gpu } from "./effect.mjs";

/**
 * Draws line art from the image's edges. The element form of `outline(threshold, ink, paper)`.
 *
 * @tag pixel-outline
 * @summary A pixel effect: line art from edges.
 *
 * @attr {number} threshold - Edge strength needed for a line, 0–1. Lower draws more lines. Default 0.2.
 * @attr {string} ink - Line color. Default black.
 * @attr {string} paper - Background color, or `none` to draw the lines over the image. Default white.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelOutline extends PixelEffect {
  static effect = { name: "outline", params, apply, gpu };
}
