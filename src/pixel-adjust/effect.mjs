// adjust(brightness, contrast, saturation, hue): tone and color, like the
// CSS filter functions of the same names. Run it before palette() for
// cleaner dithering.
import { gpuShader } from "../gpu.mjs";
import { number } from "../effects.mjs";

export const params = ["brightness", "contrast", "saturation", "hue"];

// The hue-rotate and saturate matrices from the Filter Effects spec (row-major).
function matrices(p) {
  const saturation = number(p.saturation, 1, { min: 0 });
  const hue = (number(p.hue, 0) * Math.PI) / 180;
  const cos = Math.cos(hue);
  const sin = Math.sin(hue);
  const h = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
  const s = saturation;
  const m = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  return { h, m, saturation, hue };
}

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const brightness = number(p.brightness, 1, { min: 0 });
  const contrast = number(p.contrast, 1, { min: 0 });
  const { h, m, saturation, hue } = matrices(p);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * brightness;
    let g = data[i + 1] * brightness;
    let b = data[i + 2] * brightness;
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    if (saturation !== 1) [r, g, b] = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
    if (hue) [r, g, b] = [h[0] * r + h[1] * g + h[2] * b, h[3] * r + h[4] * g + h[5] * b, h[6] * r + h[7] * g + h[8] * b];
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return image;
}

// On the GPU: the same arithmetic, on 0–1 values (128 is 128/255).
export const gpu = {
  fragment: gpuShader(`uniform float u_brightness;
uniform float u_contrast;
uniform mat3 u_saturate;
uniform mat3 u_rotate;
void main() {
  vec4 c = sampleAt(pixelAt());
  vec3 rgb = c.rgb * u_brightness;
  rgb = (rgb - 128.0 / 255.0) * u_contrast + 128.0 / 255.0;
  rgb = u_saturate * rgb;
  rgb = u_rotate * rgb;
  color = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`),
  uniforms: (p) => {
    const { h, m, saturation, hue } = matrices(p);
    const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    // GLSL matrices are column-major: transpose the row-major ones.
    const columns = (r) => [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
    return {
      u_brightness: number(p.brightness, 1, { min: 0 }),
      u_contrast: number(p.contrast, 1, { min: 0 }),
      u_saturate: { mat3: columns(saturation !== 1 ? m : identity) },
      u_rotate: { mat3: columns(hue ? h : identity) },
    };
  },
};
