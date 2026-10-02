// mosaic(size): pixelate. Each size×size block becomes its average color.
import { number } from "../effects.mjs";

export const params = ["size"];

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const { width, height, data } = image;
  const size = Math.floor(number(p.size, 8, { min: 1 }));
  if (size === 1) return image;
  for (let top = 0; top < height; top += size) {
    for (let left = 0; left < width; left += size) {
      const bottom = Math.min(top + size, height);
      const right = Math.min(left + size, width);
      const sum = [0, 0, 0, 0];
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 4; c++) sum[c] += data[i + c];
        }
      }
      const count = (bottom - top) * (right - left);
      const average = sum.map((total) => Math.round(total / count));
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) data.set(average, (y * width + x) * 4);
      }
    }
  }
  return image;
}
