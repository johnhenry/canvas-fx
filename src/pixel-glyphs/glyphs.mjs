// The heart of glyphs(): a font atlas measured from the actual font, and
// choosing a character for each cell of an image. Shared by the CPU
// effect, its GPU version, and <pixel-canvas>.toText().
//
// Each character is drawn, white on transparent, into a tile exactly one
// cell in size, and measured: its ink coverage (for brightness mode), and
// its ink in each of a 2 × 3 grid of regions (for shape mode, where a cell
// gets the character whose ink is laid out most like the cell's light). The
// measurements are rounded to 8 bits, the precision the GPU version reads
// them at, so both pick the same characters.
import { effectRegistry, luminance } from "../effects.mjs";

/** Character sets by name. */
export const SETS = {
  ramp: " .:-=+*#%@",
  ascii: Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(""),
  blocks: " ░▒▓█",
  binary: " 01",
};

export const REGIONS = [2, 3]; // columns × rows for shape matching

/**
 * "8x12" -> [8, 12]; "10" -> [10, 10]. Cells are 2–32 pixels a side.
 * @param {string | undefined | null} text
 * @returns {[number, number]}
 */
export function parseCell(text) {
  const match = /^\s*(\d+)\s*(?:[x×]\s*(\d+))?\s*$/i.exec(text ?? "");
  const clamp = (n) => Math.min(32, Math.max(2, n));
  if (!match) return [8, 12];
  return [clamp(Number(match[1])), clamp(Number(match[2] ?? match[1]))];
}

/**
 * The characters to choose from: a named set, or the characters given.
 * Defaults: `ramp` for brightness mode, `ascii` for shape mode.
 * @param {string} chars
 * @param {string} mode
 * @returns {string[]}
 */
export function resolveChars(chars, mode) {
  const text = chars || (mode === "shape" ? SETS.ascii : SETS.ramp);
  const list = [...new Set([...(SETS[text] ?? text)])];
  return list.length >= 2 ? list.slice(0, 256) : [...SETS.ramp];
}

const atlases = new Map(); // key -> atlas
let version = 0;

/**
 * The atlas for these characters in this font at this cell size.
 * @param {string[]} chars
 * @param {string} family a CSS font-family list
 * @param {number} width cell width
 * @param {number} height cell height
 * @returns {{ chars: string[], width: number, height: number, alpha: Uint8ClampedArray, image: ImageData,
 *   brightness: Uint8Array, regions: Uint8Array, regionScale: number, features: ImageData, key: string }}
 */
export function glyphAtlas(chars, family, width, height) {
  const key = `${version}|${width}x${height}|${family}|${chars.join("")}`;
  const cached = atlases.get(key);
  if (cached) return cached;
  const count = chars.length;
  const canvas = new OffscreenCanvas(width * count, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  // Fit the font to the cell: the tallest that's no wider than a cell.
  context.font = `100px ${family}`;
  const widest = Math.max(...chars.map((c) => context.measureText(c).width), 1) / 100;
  const size = Math.max(1, Math.min(height * 0.95, width / widest));
  const font = `${size}px ${family}`;
  context.font = font;
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  chars.forEach((c, i) => context.fillText(c, i * width + width / 2, height / 2));
  const image = context.getImageData(0, 0, width * count, height);
  const alpha = new Uint8ClampedArray(width * count * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = image.data[i * 4 + 3];

  // Measure: coverage, and ink per region, normalized across the set so
  // the emptiest character is 0 and the inkiest (or inkiest region) is 1.
  const [columns, rows] = REGIONS;
  const coverage = new Float64Array(count);
  const regions = new Float64Array(count * columns * rows);
  for (let g = 0; g < count; g++) {
    let total = 0;
    for (let r = 0; r < columns * rows; r++) {
      const [x0, x1, y0, y1] = regionBounds(r, width, height);
      let sum = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += alpha[y * width * count + g * width + x];
      regions[g * columns * rows + r] = sum / ((x1 - x0) * (y1 - y0) * 255);
      total += sum;
    }
    coverage[g] = total / (width * height * 255);
  }
  const [low, high] = [Math.min(...coverage), Math.max(...coverage)];
  const highest = Math.max(...regions, 1e-6);
  const brightness = Uint8Array.from(coverage, (c) => Math.round(((c - low) / (high - low || 1)) * 255));
  const quantized = Uint8Array.from(regions, (v) => Math.round((v / highest) * 255));
  // For the GPU: one column per character; row 0 = brightness and the
  // first three regions, row 1 = the last three.
  const features = new ImageData(count, 2);
  for (let g = 0; g < count; g++) {
    const f = quantized.subarray(g * 6, g * 6 + 6);
    features.data.set([brightness[g], f[0], f[1], f[2]], g * 4);
    features.data.set([f[3], f[4], f[5], 255], (count + g) * 4);
  }
  // A cell's regions are scaled the same way before comparing, so a cell
  // holding exactly a character matches that character.
  const atlas = { chars, width, height, alpha, image, brightness, regions: quantized, regionScale: highest, features, key };
  atlases.set(key, atlas);

  // Drawn with a fallback font? Start again once the real one loads.
  if (globalThis.document?.fonts && !document.fonts.check(font)) {
    document.fonts.load(font).then(
      (faces) => {
        if (!faces.length) return;
        version++;
        atlases.clear();
        effectRegistry.dispatchEvent(new CustomEvent("define", { detail: "glyphs" }));
      },
      () => {},
    );
  }
  return atlas;
}

// The pixel bounds [x0, x1, y0, y1] of region r of a cell.
export function regionBounds(r, width, height) {
  const [columns, rows] = REGIONS;
  const col = r % columns;
  const row = Math.floor(r / columns);
  return [Math.floor((col * width) / columns), Math.floor(((col + 1) * width) / columns), Math.floor((row * height) / rows), Math.floor(((row + 1) * height) / rows)];
}

/**
 * Choose a character for every cell of `image`. Light is ink: a bright
 * cell gets an inky character (light on dark). With `invert` (a light
 * background), darkness is ink instead. Transparent pixels count as dark.
 * @param {ImageData} image
 * @param {ReturnType<typeof glyphAtlas>} atlas
 * @param {{ mode?: "brightness" | "shape", invert?: boolean }} [options]
 * @returns {{ columns: number, rows: number, indices: Uint16Array, colors: Uint8ClampedArray }}
 *   `colors`: each cell's average color (RGBA), weighted by alpha
 */
export function chooseGlyphs(image, atlas, { mode = "brightness", invert = false } = {}) {
  const { width: w, height: h, data } = image;
  const { width: cw, height: ch } = atlas;
  const columns = Math.ceil(w / cw);
  const rows = Math.ceil(h / ch);
  const indices = new Uint16Array(columns * rows);
  const colors = new Uint8ClampedArray(columns * rows * 4);
  const count = atlas.chars.length;
  const regionCount = REGIONS[0] * REGIONS[1];
  const cellRegion = new Float64Array(regionCount);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < columns; cx++) {
      const ox = cx * cw;
      const oy = cy * ch;
      let total = 0;
      let samples = 0;
      const rgba = [0, 0, 0, 0];
      for (let r = 0; r < regionCount; r++) {
        const [x0, x1, y0, y1] = regionBounds(r, cw, ch);
        let sum = 0;
        let n = 0;
        for (let y = oy + y0; y < Math.min(h, oy + y1); y++) {
          for (let x = ox + x0; x < Math.min(w, ox + x1); x++) {
            const i = (y * w + x) * 4;
            const a = data[i + 3] / 255;
            const light = (luminance(data[i], data[i + 1], data[i + 2]) / 255) * a;
            sum += invert ? a * (1 - luminance(data[i], data[i + 1], data[i + 2]) / 255) : light;
            n++;
            rgba[0] += data[i] * a;
            rgba[1] += data[i + 1] * a;
            rgba[2] += data[i + 2] * a;
            rgba[3] += data[i + 3];
          }
        }
        cellRegion[r] = n ? Math.min(1, sum / n / atlas.regionScale) : 0;
        total += sum;
        samples += n;
      }
      const cell = cy * columns + cx;
      const weight = rgba[3] / 255;
      colors.set(weight ? [rgba[0] / weight, rgba[1] / weight, rgba[2] / weight, rgba[3] / samples] : [0, 0, 0, 0], cell * 4);
      const target = samples ? total / samples : 0;
      let best = 0;
      let bestDistance = Infinity;
      for (let g = 0; g < count; g++) {
        let distance;
        if (mode === "shape") {
          distance = 0;
          for (let r = 0; r < regionCount; r++) {
            const d = cellRegion[r] - atlas.regions[g * regionCount + r] / 255;
            distance += d * d;
          }
        } else distance = Math.abs(target - atlas.brightness[g] / 255);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = g;
        }
      }
      indices[cell] = best;
    }
  }
  return { columns, rows, indices, colors };
}

/**
 * The chosen characters as text, one line per row (trailing spaces trimmed).
 * @param {ReturnType<typeof chooseGlyphs>} choice
 * @param {string[]} chars
 * @returns {string}
 */
export function glyphText({ columns, rows, indices }, chars) {
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < columns; x++) line += chars[indices[y * columns + x]];
    lines.push(line.trimEnd());
  }
  return lines.join("\n");
}
