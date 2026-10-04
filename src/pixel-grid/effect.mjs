// grid(size, color, line): grid lines every `size` pixels. A fully
// transparent color (`transparent`) cuts the lines out instead, leaving
// separate tiles with gaps the background shows through.
import { gpuShader } from "../gpu.mjs";
import { number, parseColor } from "../effects.mjs";

export const params = ["size", "color", "line"];

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const { width, height, data } = image;
  const size = Math.floor(number(p.size, 8, { min: 2 }));
  const line = Math.floor(number(p.line, 1, { min: 1, max: size - 1 }));
  const [r, g, b, a] = parseColor(p.color) ?? [0, 0, 0, 89];
  const alpha = a / 255;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x % size >= line && y % size >= line) continue;
      const i = (y * width + x) * 4;
      if (a === 0) {
        data[i + 3] = 0; // cut
        continue;
      }
      data[i] = data[i] * (1 - alpha) + r * alpha;
      data[i + 1] = data[i + 1] * (1 - alpha) + g * alpha;
      data[i + 2] = data[i + 2] * (1 - alpha) + b * alpha;
      data[i + 3] = Math.max(data[i + 3], a);
    }
  }
  return image;
}

export const gpu = {
  fragment: gpuShader(`uniform float u_size;
uniform float u_line;
uniform vec4 u_color;
void main() {
  vec2 p = pixelAt();
  vec4 c = sampleAt(p);
  if (mod(p.x, u_size) >= u_line && mod(p.y, u_size) >= u_line) { color = c; return; }
  if (u_color.a == 0.0) { color = vec4(c.rgb, 0.0); return; }
  color = vec4(mix(c.rgb, u_color.rgb, u_color.a), max(c.a, u_color.a));
}`),
  uniforms: (p) => {
    const size = Math.floor(number(p.size, 8, { min: 2 }));
    const [r, g, b, a] = parseColor(p.color) ?? [0, 0, 0, 89];
    return { u_size: size, u_line: Math.floor(number(p.line, 1, { min: 1, max: size - 1 })), u_color: [r / 255, g / 255, b / 255, a / 255] };
  },
};
