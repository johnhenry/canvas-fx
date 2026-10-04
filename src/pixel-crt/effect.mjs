// crt(scanlines, mask, glow): an old screen. Darkened alternate rows, a
// red/green/blue stripe mask, and a little glow to make up the light.
import { gpuShader } from "../gpu.mjs";
import { number } from "../effects.mjs";

export const params = ["scanlines", "mask", "glow"];

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const { width, height, data } = image;
  const scanlines = number(p.scanlines, 0.35, { min: 0, max: 1 });
  const mask = number(p.mask, 0.25, { min: 0, max: 1 });
  const glow = number(p.glow, 1.15, { min: 0 });
  for (let y = 0; y < height; y++) {
    const row = y % 2 ? 1 - scanlines : 1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const stripe = x % 3; // which channel this column's phosphor favors
      for (let c = 0; c < 3; c++) {
        const phosphor = c === stripe ? 1 : 1 - mask;
        data[i + c] = data[i + c] * row * phosphor * glow;
      }
    }
  }
  return image;
}

export const gpu = {
  fragment: gpuShader(`uniform float u_scanlines;
uniform float u_mask;
uniform float u_glow;
void main() {
  vec2 p = pixelAt();
  vec4 c = sampleAt(p);
  float row = mod(p.y, 2.0) >= 1.0 ? 1.0 - u_scanlines : 1.0;
  float stripe = mod(p.x, 3.0);
  vec3 phosphor = vec3(stripe < 0.5 ? 1.0 : 1.0 - u_mask, stripe >= 0.5 && stripe < 1.5 ? 1.0 : 1.0 - u_mask, stripe >= 1.5 ? 1.0 : 1.0 - u_mask);
  color = vec4(clamp(c.rgb * row * phosphor * u_glow, 0.0, 1.0), c.a);
}`),
  uniforms: (p) => ({
    u_scanlines: number(p.scanlines, 0.35, { min: 0, max: 1 }),
    u_mask: number(p.mask, 0.25, { min: 0, max: 1 }),
    u_glow: number(p.glow, 1.15, { min: 0 }),
  }),
};
