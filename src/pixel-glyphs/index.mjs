// <pixel-glyphs>: the glyphs() effect as an element. See readme.md.
import { PixelEffect } from "../effects.mjs";
import { params, apply, gpu } from "./effect.mjs";

/**
 * Turns the image into text characters: each cell becomes the character that best matches it, from a font atlas measured from the real font. The element form of `glyphs(cell, chars, font, mode, color, background)`.
 *
 * @tag pixel-glyphs
 * @summary A pixel effect: the image as text characters (ASCII art).
 *
 * @attr {string} cell - Cell size in working pixels, `8x12` (the default) or `10` for square. 2–32 a side.
 * @attr {string} chars - The characters to use: a set (`ramp`, the default for brightness; `ascii`, the default for shape; `blocks`; `binary`) or your own, quoted when it has spaces or commas (`' .:#'`).
 * @attr {string} font - A CSS font family. Default `monospace`.
 * @attr {"brightness" | "shape"} mode - Choose by how much ink a character has (`brightness`, the default) or where its ink is (`shape`: lines and edges get matching characters).
 * @attr {string} color - The ink: `source` (each cell's own color, the default) or a CSS color.
 * @attr {string} background - Behind the characters: `none` (transparent, the default) or a CSS color. On a light background, darkness is inked.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelGlyphs extends PixelEffect {
  static effect = { name: "glyphs", params, apply, gpu };
}
