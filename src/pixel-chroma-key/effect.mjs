// chroma-key(color, tolerance, softness): make one color transparent, like
// a green screen. Put a background behind the <pixel-canvas> with CSS.
import { number, parseColor } from "../effects.mjs";

export const params = ["color", "tolerance", "softness"];

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const [kr, kg, kb] = parseColor(p.color) ?? [0, 255, 0, 255];
  const tolerance = number(p.tolerance, 0.3, { min: 0, max: 1 });
  const softness = number(p.softness, 0.1, { min: 0, max: 1 });
  const data = image.data;
  const max = Math.sqrt(3) * 255;
  for (let i = 0; i < data.length; i += 4) {
    const distance = Math.hypot(data[i] - kr, data[i + 1] - kg, data[i + 2] - kb) / max;
    if (distance <= tolerance) data[i + 3] = 0;
    else if (softness && distance < tolerance + softness) data[i + 3] *= (distance - tolerance) / softness;
  }
  return image;
}
