// outline(threshold, ink, paper): line art from edges (a Sobel filter on
// brightness). paper="none" draws the lines over the image instead.
import { gpuShader } from "../gpu.mjs";
import { number, parseColor, luminance } from "../effects.mjs";

export const params = ["threshold", "ink", "paper"];

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const { width, height, data } = image;
  const threshold = number(p.threshold, 0.2, { min: 0, max: 1 }) * 1443; // the largest Sobel magnitude
  const ink = parseColor(p.ink) ?? [0, 0, 0, 255];
  const keep = (p.paper ?? "").trim() === "none";
  const paper = parseColor(p.paper) ?? [255, 255, 255, 255];
  const light = new Float32Array(width * height);
  for (let i = 0; i < light.length; i++) light[i] = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const at = (x, y) => light[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const edge = Math.hypot(gx, gy) > threshold;
      if (!edge && keep) continue;
      const color = edge ? ink : paper;
      data.set(color, (y * width + x) * 4);
    }
  }
  return image;
}

export const gpu = {
  fragment: gpuShader(`uniform float u_threshold;
uniform vec4 u_ink;
uniform vec4 u_paper;
uniform float u_keep;
float light(vec2 p) { vec3 c = sampleAt(p).rgb * 255.0; return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; }
void main() {
  vec2 p = pixelAt();
  float gx = light(p + vec2(1, -1)) + 2.0 * light(p + vec2(1, 0)) + light(p + vec2(1, 1)) - light(p + vec2(-1, -1)) - 2.0 * light(p + vec2(-1, 0)) - light(p + vec2(-1, 1));
  float gy = light(p + vec2(-1, 1)) + 2.0 * light(p + vec2(0, 1)) + light(p + vec2(1, 1)) - light(p + vec2(-1, -1)) - 2.0 * light(p + vec2(0, -1)) - light(p + vec2(1, -1));
  bool edge = length(vec2(gx, gy)) > u_threshold;
  if (!edge && u_keep > 0.5) { color = sampleAt(p); return; }
  color = edge ? u_ink : u_paper;
}`),
  uniforms: (p) => {
    const ink = parseColor(p.ink) ?? [0, 0, 0, 255];
    const paper = parseColor(p.paper) ?? [255, 255, 255, 255];
    return {
      u_threshold: number(p.threshold, 0.2, { min: 0, max: 1 }) * 1443,
      u_ink: ink.map((v) => v / 255),
      u_paper: paper.map((v) => v / 255),
      u_keep: (p.paper ?? "").trim() === "none" ? 1 : 0,
    };
  },
};
