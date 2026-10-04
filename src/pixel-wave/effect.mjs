// wave(amplitude, wavelength, speed): each row slides sideways along a
// sine wave, which travels at `speed` waves per second on the
// <pixel-canvas> clock. Water, heat haze, a flag.
import { gpuShader } from "../gpu.mjs";
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

export const gpu = {
  fragment: gpuShader(`uniform float u_amplitude;
uniform float u_wavelength;
uniform float u_speed;
void main() {
  vec2 p = pixelAt();
  float offset = floor(u_amplitude * sin(6.283185307179586 * (p.y / u_wavelength + u_speed * u_time)) + 0.5);
  color = sampleAt(vec2(clamp(p.x - offset, 0.0, u_resolution.x - 1.0), p.y));
}`),
  uniforms: (p) => ({ u_amplitude: number(p.amplitude, 4), u_wavelength: number(p.wavelength, 32, { min: 1 }), u_speed: number(p.speed, 0.5) }),
};
