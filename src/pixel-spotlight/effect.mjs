// spotlight(radius, softness, dim): light around the pointer, the rest
// dimmed. Pixels within `radius` of the pointer are unchanged; beyond
// radius + softness they're darkened by `dim` (0–1); between, a smooth
// falloff. While the pointer is away, the image is unchanged.
import { gpuShader } from "../gpu.mjs";
import { number } from "../effects.mjs";

export const params = ["radius", "softness", "dim"];
export const pointer = true;

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
};

/** @param {ImageData} image @param {Record<string, string>} p @param {import("../effects.mjs").EffectContext} context */
export function apply(image, p, { pointer: at = null } = {}) {
  if (!at?.inside) return image;
  const { width, height, data } = image;
  const radius = number(p.radius, 32, { min: 0 });
  const softness = number(p.softness, 16, { min: 0 });
  const dim = number(p.dim, 0.7, { min: 0, max: 1 });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot(x - at.x, y - at.y);
      const factor = 1 - dim * smoothstep(radius, radius + softness, distance);
      if (factor === 1) continue;
      const i = (y * width + x) * 4;
      data[i] *= factor;
      data[i + 1] *= factor;
      data[i + 2] *= factor;
    }
  }
  return image;
}

export const gpu = {
  fragment: gpuShader(`uniform float u_radius;
uniform float u_softness;
uniform float u_dim;
void main() {
  vec2 p = pixelAt();
  vec4 c = sampleAt(p);
  if (u_pointer.z < 0.5) { color = c; return; }
  float factor = 1.0 - u_dim * smoothstep(u_radius, u_radius + max(u_softness, 1e-6), distance(p, u_pointer.xy));
  color = vec4(c.rgb * factor, c.a);
}`),
  uniforms: (p) => ({
    u_radius: number(p.radius, 32, { min: 0 }),
    u_softness: number(p.softness, 16, { min: 0 }),
    u_dim: number(p.dim, 0.7, { min: 0, max: 1 }),
  }),
};
