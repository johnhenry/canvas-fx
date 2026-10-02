// palette(colors, dither): reduce the image to a palette, optionally dithered.
import { parseColor } from "../effects.mjs";
import PALETTES from "./palettes.mjs";

export const params = ["colors", "dither"];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16 - 0.5);

/**
 * A palette as [r, g, b] triples: a named one, or space-separated CSS colors.
 * @param {string | undefined | null} colors
 * @returns {number[][]}
 */
export function resolvePalette(colors) {
  const text = (colors ?? "").trim() || "1bit";
  const named = PALETTES[text.toLowerCase()];
  // Split on spaces outside parentheses, so "rgb(0 0 0)" stays whole.
  const list = named ?? text.match(/[^\s(]+(\([^)]*\))?/g) ?? [];
  const parsed = list.map((color) => parseColor(color)).filter(Boolean).map(([r, g, b]) => [r, g, b]);
  return parsed.length ? parsed : PALETTES["1bit"].map((color) => parseColor(color).slice(0, 3));
}

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const { width, height, data } = image;
  const palette = resolvePalette(p.colors);
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
