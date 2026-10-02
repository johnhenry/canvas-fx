// crt(scanlines, mask, glow): an old screen. Darkened alternate rows, a
// red/green/blue stripe mask, and a little glow to make up the light.
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
