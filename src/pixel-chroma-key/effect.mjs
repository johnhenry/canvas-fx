// chroma-key(color, tolerance, softness): make one color transparent, like
// a green screen. Put a background behind the <pixel-canvas> with CSS.
import { gpuShader } from "../gpu.mjs";
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

export const gpu = {
  fragment: gpuShader(`uniform vec3 u_key;
uniform float u_tolerance;
uniform float u_softness;
void main() {
  vec4 c = sampleAt(pixelAt());
  float d = length(c.rgb - u_key) / sqrt(3.0);
  float a = c.a;
  if (d <= u_tolerance) a = 0.0;
  else if (u_softness > 0.0 && d < u_tolerance + u_softness) a *= (d - u_tolerance) / u_softness;
  color = vec4(c.rgb, a);
}`),
  uniforms: (p) => {
    const [r, g, b] = parseColor(p.color) ?? [0, 255, 0, 255];
    return { u_key: [r / 255, g / 255, b / 255], u_tolerance: number(p.tolerance, 0.3, { min: 0, max: 1 }), u_softness: number(p.softness, 0.1, { min: 0, max: 1 }) };
  },
};
