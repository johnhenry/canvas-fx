// outline(threshold, ink, paper): line art from edges (a Sobel filter on
// brightness). paper="none" draws the lines over the image instead.
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
