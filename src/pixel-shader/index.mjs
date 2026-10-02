// <pixel-shader>: a GPU effect written in GLSL, in a child
// <script type="x-shader/x-fragment">. Its attributes set the shader's
// `u_` uniforms. See readme.md and ../shader.mjs.
import { PixelEffect } from "../effects.mjs";
import { runShader } from "../shader.mjs";

/**
 * Runs the image through the GLSL fragment shader in its
 * `<script type="x-shader/x-fragment">` child, on the GPU. Each `u_name`
 * uniform the shader uses (beyond the built-in ones) is a float set from
 * this element's `name` attribute.
 *
 * @tag pixel-shader
 * @summary A pixel effect written as a GLSL fragment shader, run on the GPU.
 *
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelShader extends PixelEffect {
  /**
   * The shader's code: the text of its `<script type="x-shader/x-fragment">`
   * child.
   * @type {string}
   * @readonly
   */
  get source() {
    return this.querySelector(':scope > script[type="x-shader/x-fragment"]')?.textContent ?? "";
  }

  /**
   * @param {ImageData} image
   * @param {{ time: number, frame: number }} [context]
   * @returns {ImageData}
   */
  apply(image, context) {
    const source = this.source;
    return source.trim() ? runShader(image, source, this.params, context) : image;
  }
}
