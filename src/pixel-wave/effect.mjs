// wave(amplitude, wavelength, speed): each row slides sideways along a
// sine wave, which travels at `speed` waves per second on the
// <pixel-canvas> clock. Water, heat haze, a flag.
import { number } from "../effects.mjs";

export const params = ["amplitude", "wavelength", "speed"];

/** @param {ImageData} image @param {Record<string, string>} p @param {{ time: number }} context */
export function apply(image, p, { time = 0 } = {}) {
  const { width, height, data } = image;
  const amplitude = number(p.amplitude, 4);
  const wavelength = number(p.wavelength, 32, { min: 1 });
  const speed = number(p.speed, 0.5);
  const source = Uint8ClampedArray.from(data);
  for (let y = 0; y < height; y++) {
    const offset = Math.round(amplitude * Math.sin(2 * Math.PI * (y / wavelength + speed * time)));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(width - 1, Math.max(0, x - offset)); // edges stretch rather than wrap
      data.set(source.subarray((y * width + sx) * 4, (y * width + sx) * 4 + 4), (y * width + x) * 4);
    }
  }
  return image;
}
