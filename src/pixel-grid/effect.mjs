// grid(size, color, line): grid lines every `size` pixels.
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
      data[i] = data[i] * (1 - alpha) + r * alpha;
      data[i + 1] = data[i + 1] * (1 - alpha) + g * alpha;
      data[i + 2] = data[i + 2] * (1 - alpha) + b * alpha;
      data[i + 3] = Math.max(data[i + 3], a);
    }
  }
  return image;
}
