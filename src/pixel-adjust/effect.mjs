// adjust(brightness, contrast, saturation, hue): tone and color, like the
// CSS filter functions of the same names. Run it before palette() for
// cleaner dithering.
import { number } from "../effects.mjs";

export const params = ["brightness", "contrast", "saturation", "hue"];

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const brightness = number(p.brightness, 1, { min: 0 });
  const contrast = number(p.contrast, 1, { min: 0 });
  const saturation = number(p.saturation, 1, { min: 0 });
  const hue = (number(p.hue, 0) * Math.PI) / 180;
  // The hue-rotate and saturate matrices from the Filter Effects spec.
  const cos = Math.cos(hue);
  const sin = Math.sin(hue);
  const h = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
  const s = saturation;
  const m = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * brightness;
    let g = data[i + 1] * brightness;
    let b = data[i + 2] * brightness;
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    if (saturation !== 1) [r, g, b] = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
    if (hue) [r, g, b] = [h[0] * r + h[1] * g + h[2] * b, h[3] * r + h[4] * g + h[5] * b, h[6] * r + h[7] * g + h[8] * b];
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return image;
}
