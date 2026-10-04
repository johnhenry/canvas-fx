// glyphs(cell, chars, font, mode, color, background): the image as text
// characters. Each cell (8x12 working pixels by default) becomes the
// character that best matches it, drawn from a font atlas measured from
// the real font: by brightness (how much ink), or by shape (where the ink
// is, so diagonals get / and \). See glyphs.mjs.
import { gpuShader } from "../gpu.mjs";
import { luminance, parseColor, unquote } from "../effects.mjs";
import { chooseGlyphs, glyphAtlas, glyphText, parseCell, resolveChars } from "./glyphs.mjs";

export const params = ["cell", "chars", "font", "mode", "color", "background"];

// Everything an application of the effect needs, from its parameters.
export function settings(p) {
  const [cellWidth, cellHeight] = parseCell(unquote(p.cell));
  const mode = unquote(p.mode) === "shape" ? "shape" : "brightness";
  const chars = resolveChars(unquote(p.chars), mode);
  const family = unquote(p.font) || "monospace";
  const colorText = unquote(p.color);
  const color = !colorText || colorText === "source" ? null : (parseColor(colorText) ?? null);
  const backgroundText = unquote(p.background);
  const background = !backgroundText || backgroundText === "none" ? [0, 0, 0, 0] : (parseColor(backgroundText) ?? [0, 0, 0, 0]);
  // On a light background, darkness is what's inked.
  const invert = background[3] > 0 && luminance(background[0], background[1], background[2]) > 127.5;
  return { cellWidth, cellHeight, mode, chars, family, color, background, invert, atlas: glyphAtlas(chars, family, cellWidth, cellHeight) };
}

/** @param {ImageData} image @param {Record<string, string>} p @param {Record<string, unknown>} [context] */
export function apply(image, p, context = {}) {
  const s = settings(p);
  const { atlas } = s;
  const choice = chooseGlyphs(image, atlas, { mode: s.mode, invert: s.invert });
  if (context && typeof context === "object") context.text = glyphText(choice, s.chars);
  const { width, height, data } = image;
  const tileRow = atlas.width * atlas.chars.length;
  const [br, bg, bb, ba] = s.background;
  for (let y = 0; y < height; y++) {
    const cy = Math.floor(y / atlas.height);
    const ly = y - cy * atlas.height;
    for (let x = 0; x < width; x++) {
      const cx = Math.floor(x / atlas.width);
      const cell = cy * choice.columns + cx;
      const glyph = choice.indices[cell];
      const ink = atlas.alpha[ly * tileRow + glyph * atlas.width + (x - cx * atlas.width)] / 255;
      const fg = s.color ?? [choice.colors[cell * 4], choice.colors[cell * 4 + 1], choice.colors[cell * 4 + 2], 255];
      // Ink over background ("over" compositing, unpremultiplied).
      const fa = (fg[3] / 255) * ink;
      const bgA = (ba / 255) * (1 - fa);
      const alpha = fa + bgA;
      const i = (y * width + x) * 4;
      data[i] = alpha ? (fg[0] * fa + br * bgA) / alpha : 0;
      data[i + 1] = alpha ? (fg[1] * fa + bg * bgA) / alpha : 0;
      data[i + 2] = alpha ? (fg[2] * fa + bb * bgA) / alpha : 0;
      data[i + 3] = alpha * 255;
    }
  }
  return image;
}

// On the GPU: the same measuring, choosing, and compositing, per pixel,
// with the atlas and the characters' measurements as textures.
export const gpu = {
  fragment: gpuShader(`uniform sampler2D u_atlas;
uniform sampler2D u_features;
uniform vec2 u_cell;
uniform int u_count;
uniform float u_shape;
uniform float u_regionScale;
uniform float u_invert;
uniform vec4 u_fg;
uniform float u_fgSource;
uniform vec4 u_bg;
float lum(vec3 c) { return dot(c * 255.0, vec3(0.299, 0.587, 0.114)) / 255.0; }
void main() {
  vec2 p = pixelAt();
  vec2 origin = floor(p / u_cell) * u_cell;
  float regions[6];
  float total = 0.0, samples = 0.0;
  vec4 rgba = vec4(0.0);
  for (int r = 0; r < 6; r++) {
    float col = float(r % 2), row = float(r / 2);
    float x0 = floor(col * u_cell.x / 2.0), x1 = floor((col + 1.0) * u_cell.x / 2.0);
    float y0 = floor(row * u_cell.y / 3.0), y1 = floor((row + 1.0) * u_cell.y / 3.0);
    float sum = 0.0, n = 0.0;
    for (int y = 0; y < 32; y++) {
      float py = origin.y + y0 + float(y);
      if (y0 + float(y) >= y1 || py >= u_resolution.y) break;
      for (int x = 0; x < 32; x++) {
        float px = origin.x + x0 + float(x);
        if (x0 + float(x) >= x1 || px >= u_resolution.x) break;
        vec4 c = texelFetch(u_image, ivec2(px, py), 0);
        float l = lum(c.rgb);
        sum += u_invert > 0.5 ? c.a * (1.0 - l) : l * c.a;
        n += 1.0;
        rgba += vec4(c.rgb * 255.0 * c.a, c.a * 255.0);
      }
    }
    regions[r] = n > 0.0 ? min(1.0, sum / n / u_regionScale) : 0.0;
    total += sum;
    samples += n;
  }
  float target = samples > 0.0 ? total / samples : 0.0;
  int best = 0;
  float bestDistance = 1e20;
  for (int g = 0; g < 256; g++) {
    if (g >= u_count) break;
    vec4 f0 = texelFetch(u_features, ivec2(g, 0), 0);
    vec4 f1 = texelFetch(u_features, ivec2(g, 1), 0);
    float d;
    if (u_shape > 0.5) {
      vec3 a = vec3(regions[0], regions[1], regions[2]) - f0.gba;
      vec3 b = vec3(regions[3], regions[4], regions[5]) - f1.rgb;
      d = dot(a, a) + dot(b, b);
    } else d = abs(target - f0.r);
    if (d < bestDistance) { bestDistance = d; best = g; }
  }
  vec2 local = p - origin;
  float ink = texelFetch(u_atlas, ivec2(float(best) * u_cell.x + local.x, local.y), 0).a;
  float weight = rgba.a / 255.0;
  vec4 fg = u_fgSource > 0.5 ? vec4(weight > 0.0 ? rgba.rgb / weight / 255.0 : vec3(0.0), 1.0) : u_fg;
  float fa = fg.a * ink;
  float ba = u_bg.a * (1.0 - fa);
  float alpha = fa + ba;
  color = alpha > 0.0 ? vec4((fg.rgb * fa + u_bg.rgb * ba) / alpha, alpha) : vec4(0.0);
}`),
  uniforms: (p) => {
    const s = settings(p);
    return {
      u_atlas: { texture: s.atlas.image, key: `atlas|${s.atlas.key}` },
      u_features: { texture: s.atlas.features, key: `features|${s.atlas.key}` },
      u_cell: [s.cellWidth, s.cellHeight],
      u_count: { int: s.chars.length },
      u_shape: s.mode === "shape" ? 1 : 0,
      u_regionScale: s.atlas.regionScale,
      u_invert: s.invert ? 1 : 0,
      u_fg: s.color ? s.color.map((v) => v / 255) : [0, 0, 0, 1],
      u_fgSource: s.color ? 0 : 1,
      u_bg: s.background.map((v) => v / 255),
    };
  },
};
