// halftone(size, angle, ink, paper): printed dots. Each cell of a grid
// rotated by `angle` becomes one dot, larger where the image is darker.
// ink="auto" colors each dot with its cell's color.
import { gpuShader } from "../gpu.mjs";
import { number, parseColor, luminance } from "../effects.mjs";

export const params = ["size", "angle", "ink", "paper"];

/** @param {ImageData} image @param {Record<string, string>} p */
export function apply(image, p) {
  const { width, height, data } = image;
  const size = number(p.size, 6, { min: 2 });
  const angle = (number(p.angle, 45) * Math.PI) / 180;
  const auto = (p.ink ?? "").trim() === "auto";
  const ink = auto ? null : (parseColor(p.ink) ?? [0, 0, 0, 255]);
  const paper = parseColor(p.paper) ?? [255, 255, 255, 255];
  const source = Uint8ClampedArray.from(data);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const sample = (x, y) => {
    const cx = Math.min(width - 1, Math.max(0, Math.round(x)));
    const cy = Math.min(height - 1, Math.max(0, Math.round(y)));
    return (cy * width + cx) * 4;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Into the rotated grid, find this pixel's cell center, and back.
      const u = x * cos + y * sin;
      const v = -x * sin + y * cos;
      const cu = (Math.floor(u / size) + 0.5) * size;
      const cv = (Math.floor(v / size) + 0.5) * size;
      const centre = sample(cu * cos - cv * sin, cu * sin + cv * cos);
      const darkness = 1 - luminance(source[centre], source[centre + 1], source[centre + 2]) / 255;
      // Area-true dots: radius grows with the square root of darkness.
      const radius = (size / 2) * Math.SQRT2 * Math.sqrt(darkness);
      const inside = (u - cu) ** 2 + (v - cv) ** 2 <= radius * radius;
      const color = inside ? (ink ?? [source[centre], source[centre + 1], source[centre + 2], 255]) : paper;
      const i = (y * width + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  }
  return image;
}

export const gpu = {
  fragment: gpuShader(`uniform float u_size;
uniform float u_angle;
uniform vec4 u_ink;
uniform float u_auto;
uniform vec4 u_paper;
void main() {
  vec2 p = pixelAt();
  float c = cos(u_angle), s = sin(u_angle);
  float u = p.x * c + p.y * s;
  float v = -p.x * s + p.y * c;
  float cu = (floor(u / u_size) + 0.5) * u_size;
  float cv = (floor(v / u_size) + 0.5) * u_size;
  vec2 centre = floor(vec2(cu * c - cv * s, cu * s + cv * c) + 0.5);
  vec4 cell = sampleAt(centre);
  float darkness = 1.0 - (0.299 * cell.r + 0.587 * cell.g + 0.114 * cell.b);
  float radius = (u_size / 2.0) * 1.4142135623730951 * sqrt(darkness);
  bool inside = (u - cu) * (u - cu) + (v - cv) * (v - cv) <= radius * radius;
  color = inside ? (u_auto > 0.5 ? vec4(cell.rgb, 1.0) : u_ink) : u_paper;
}`),
  uniforms: (p) => {
    const auto = (p.ink ?? "").trim() === "auto";
    const ink = auto ? [0, 0, 0, 255] : (parseColor(p.ink) ?? [0, 0, 0, 255]);
    const paper = parseColor(p.paper) ?? [255, 255, 255, 255];
    return {
      u_size: number(p.size, 6, { min: 2 }),
      u_angle: (number(p.angle, 45) * Math.PI) / 180,
      u_ink: ink.map((v) => v / 255),
      u_auto: auto ? 1 : 0,
      u_paper: paper.map((v) => v / 255),
    };
  },
};
