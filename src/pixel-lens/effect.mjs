// lens(radius, zoom): a magnifying glass that follows the pointer. Inside a
// circle around it, the image is enlarged `zoom` times about the pointer;
// elsewhere, and while the pointer is away, it's unchanged.
import { gpuShader } from "../gpu.mjs";
import { number } from "../effects.mjs";

export const params = ["radius", "zoom"];
export const pointer = true;

/** @param {ImageData} image @param {Record<string, string>} p @param {import("../effects.mjs").EffectContext} context */
export function apply(image, p, { pointer: at = null } = {}) {
  if (!at?.inside) return image;
  const { width, height, data } = image;
  const radius = number(p.radius, 24, { min: 1 });
  const zoom = number(p.zoom, 2, { min: 0.1 });
  const source = Uint8ClampedArray.from(data);
  const top = Math.max(0, Math.floor(at.y - radius));
  const bottom = Math.min(height - 1, Math.ceil(at.y + radius));
  const left = Math.max(0, Math.floor(at.x - radius));
  const right = Math.min(width - 1, Math.ceil(at.x + radius));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const dx = x - at.x;
      const dy = y - at.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      const sx = Math.min(width - 1, Math.max(0, Math.floor(at.x + dx / zoom)));
      const sy = Math.min(height - 1, Math.max(0, Math.floor(at.y + dy / zoom)));
      data.set(source.subarray((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (y * width + x) * 4);
    }
  }
  return image;
}

export const gpu = {
  fragment: gpuShader(`uniform float u_radius;
uniform float u_zoom;
void main() {
  vec2 p = pixelAt();
  vec2 d = p - u_pointer.xy;
  if (u_pointer.z < 0.5 || dot(d, d) > u_radius * u_radius) { color = sampleAt(p); return; }
  color = sampleAt(floor(u_pointer.xy + d / u_zoom));
}`),
  uniforms: (p) => ({ u_radius: number(p.radius, 24, { min: 1 }), u_zoom: number(p.zoom, 2, { min: 0.1 }) }),
};
