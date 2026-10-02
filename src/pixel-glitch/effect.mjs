// glitch(amount, rate): digital breakup. Bands of rows slide sideways and
// the red and blue channels split apart, differently each step. `rate`
// steps per second on the <pixel-canvas> clock (with `fps` or a playing
// video, it animates); `amount` from 0 (none) to 1 (wrecked).
import { number, random } from "../effects.mjs";

export const params = ["amount", "rate"];

/** @param {ImageData} image @param {Record<string, string>} p @param {{ time: number }} context */
export function apply(image, p, { time = 0 } = {}) {
  const { width, height, data } = image;
  const amount = number(p.amount, 0.3, { min: 0, max: 1 });
  if (!amount) return image;
  const rate = number(p.rate, 8, { min: 0 });
  const next = random(Math.floor(time * rate) + 1);
  const source = Uint8ClampedArray.from(data);
  // Channel split: red one way, blue the other.
  const split = Math.round((next() - 0.5) * amount * width * 0.08);
  // A few bands of rows, shifted sideways.
  const shift = new Int32Array(height);
  const bands = Math.ceil(amount * 8);
  for (let b = 0; b < bands; b++) {
    if (next() > amount + 0.2) continue;
    const top = Math.floor(next() * height);
    const size = Math.max(1, Math.floor(next() * height * 0.15 * amount));
    const offset = Math.round((next() - 0.5) * width * 0.3 * amount);
    for (let y = top; y < Math.min(height, top + size); y++) shift[y] = offset;
  }
  const at = (x, y) => ((y * width + ((x % width) + width) % width) * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const sx = x - shift[y];
      data[i] = source[at(sx + split, y)];
      data[i + 1] = source[at(sx, y) + 1];
      data[i + 2] = source[at(sx - split, y) + 2];
      data[i + 3] = source[at(sx, y) + 3];
    }
  }
  return image;
}
