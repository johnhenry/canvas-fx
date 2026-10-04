// Generated from custom-elements.json by scripts/manifest-outputs.mjs.
// Do not edit: change the JSDoc in index.mjs and run `npm run manifest`.

/** Runs the image through the GLSL fragment shader in its
 * `<script type="x-shader/x-fragment">` child, on the GPU. Each `u_name`
 * uniform the shader uses (beyond the built-in ones) is a float set from
 * this element's `name` attribute. */
export default class PixelShader extends HTMLElement {
  /** The shader's code: the text of its `<script type="x-shader/x-fragment">`
   * child. */
  readonly source: string;
  apply(image: ImageData, context?: { time: number, frame: number }): ImageData;
  /** The shader as a GPU pass, for <pixel-canvas gpu>. */
  gpuPass(): { fragment: string, uniforms: Record<string, unknown> } | null;
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-shader": PixelShader;
  }
}
