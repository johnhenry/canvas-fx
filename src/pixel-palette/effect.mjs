// palette(colors, dither): reduce the image to a palette, optionally dithered.
import { gpuShader } from "../gpu.mjs";
import { number, parseColor } from "../effects.mjs";
import { dominantColors } from "../quantize.mjs";
import PALETTES from "./palettes.mjs";

export const params = ["colors", "dither", "count"];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16 - 0.5);

/**
 * A palette as [r, g, b] triples: a named one, or space-separated CSS
 * colors. `auto` needs an image to pick from; without one it's empty.
 * @param {string | undefined | null} colors
 * @param {{ image?: ImageData, count?: number }} [options]
 * @returns {number[][]}
 */
export function resolvePalette(colors, { image, count = 8 } = {}) {
  const text = (colors ?? "").trim() || "1bit";
  if (text.toLowerCase() === "auto") return image ? dominantColors(image, count) : [];
  const named = PALETTES[text.toLowerCase()];
  // Split on spaces outside parentheses, so "rgb(0 0 0)" stays whole.
  const list = named ?? text.match(/[^\s(]+(\([^)]*\))?/g) ?? [];
  const parsed = list.map((color) => parseColor(color)).filter(Boolean).map(([r, g, b]) => [r, g, b]);
  return parsed.length ? parsed : PALETTES["1bit"].map((color) => parseColor(color).slice(0, 3));
}

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const { width, height, data } = image;
  const palette = resolvePalette(p.colors, { image, count: Math.floor(number(p.count, 8, { min: 2, max: 256 })) });
  if (!palette.length) return image;
  const dither = (p.dither ?? "none").trim();
  const nearest = (r, g, b) => {
    let best = palette[0];
    let bestDistance = Infinity;
    for (const color of palette) {
      // Weighted for how eyes see brightness.
      const distance = 0.3 * (r - color[0]) ** 2 + 0.59 * (g - color[1]) ** 2 + 0.11 * (b - color[2]) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = color;
      }
    }
    return best;
  };
  if (dither === "floyd-steinberg") {
    const work = Float32Array.from(data);
    const spread = (x, y, error, weight) => {
      if (x < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) work[i + c] += error[c] * weight;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const old = [work[i], work[i + 1], work[i + 2]];
        const color = nearest(...old);
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        const error = old.map((value, c) => value - color[c]);
        spread(x + 1, y, error, 7 / 16);
        spread(x - 1, y + 1, error, 3 / 16);
        spread(x, y + 1, error, 5 / 16);
        spread(x + 1, y + 1, error, 1 / 16);
      }
    }
    return image;
  }
  // A step size that suits the palette: wider gaps need more noise.
  const step = 255 / Math.max(1, Math.cbrt(palette.length) * 1.5);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const offset = dither === "ordered" ? BAYER[(y % 4) * 4 + (x % 4)] * step : 0;
      const color = nearest(data[i] + offset, data[i + 1] + offset, data[i + 2] + offset);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
    }
  }
  return image;
}

export { PALETTES };

// On the GPU: named or listed palettes of up to 64 colors, undithered or
// with ordered dithering. `auto` and Floyd–Steinberg (which spreads error
// pixel by pixel, in order) run on the CPU.
const BAYER_GLSL = BAYER.map((n) => n.toFixed(6)).join(", ");
export const gpu = {
  fragment: gpuShader(`uniform vec3 u_palette[64];
uniform int u_count;
uniform float u_step;
uniform float u_ordered;
const float BAYER[16] = float[16](${BAYER_GLSL});
void main() {
  vec2 p = pixelAt();
  vec4 c = sampleAt(p);
  vec3 rgb = c.rgb * 255.0;
  if (u_ordered > 0.5) rgb += BAYER[int(mod(p.y, 4.0)) * 4 + int(mod(p.x, 4.0))] * u_step;
  vec3 best = u_palette[0];
  float bestDistance = 1e20;
  for (int i = 0; i < 64; i++) {
    if (i >= u_count) break;
    vec3 d = rgb - u_palette[i];
    float distance = 0.3 * d.r * d.r + 0.59 * d.g * d.g + 0.11 * d.b * d.b;
    if (distance < bestDistance) { bestDistance = distance; best = u_palette[i]; }
  }
  color = vec4(best / 255.0, c.a);
}`),
  uniforms: (p) => {
    const palette = resolvePalette(p.colors);
    const data = new Float32Array(64 * 3);
    palette.slice(0, 64).forEach(([r, g, b], i) => data.set([r, g, b], i * 3));
    return {
      u_palette: data,
      u_count: { int: Math.min(64, palette.length) },
      u_step: 255 / Math.max(1, Math.cbrt(palette.length) * 1.5),
      u_ordered: (p.dither ?? "none").trim() === "ordered" ? 1 : 0,
    };
  },
  supports: (p) => {
    const dither = (p.dither ?? "none").trim();
    return (p.colors ?? "").trim().toLowerCase() !== "auto" && (dither === "none" || dither === "ordered") && resolvePalette(p.colors).length <= 64;
  },
};
