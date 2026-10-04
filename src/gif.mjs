// A small GIF89a encoder, for <pixel-canvas>.toGIF(): frames of ImageData
// in, an animated GIF out. Each frame gets its own color table: exact when
// it has 255 colors or fewer (pixel art usually does), otherwise its
// dominant colors (quantize.mjs). Pixels under half opacity become the
// transparent color. No dependencies.
import { dominantColors } from "./quantize.mjs";

/**
 * Encode frames as an animated GIF.
 * @param {ImageData[]} frames all the same size
 * @param {{ delay?: number, loop?: number }} [options] `delay`: milliseconds
 *   per frame (GIF stores hundredths; default 100); `loop`: 0 repeats
 *   forever (the default), n repeats n more times, -1 plays once
 * @returns {Uint8Array}
 */
export function encodeGIF(frames, { delay = 100, loop = 0 } = {}) {
  if (!frames.length) throw new RangeError("A GIF needs at least one frame");
  const { width, height } = frames[0];
  const out = new ByteWriter();
  out.string("GIF89a");
  out.u16(width);
  out.u16(height);
  out.bytes([0x00, 0, 0]); // no global color table
  if (loop >= 0) {
    // NETSCAPE2.0 application extension: repeat count.
    out.bytes([0x21, 0xff, 0x0b]);
    out.string("NETSCAPE2.0");
    out.bytes([0x03, 0x01]);
    out.u16(loop);
    out.bytes([0x00]);
  }
  const centiseconds = Math.max(2, Math.round(delay / 10));
  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) throw new RangeError("Every frame must be the same size");
    const { palette, indices } = indexFrame(frame);
    // Graphic control extension: delay, and index 255 is transparent.
    out.bytes([0x21, 0xf9, 0x04, 0b00001001]); // dispose: restore to background; transparent flag
    out.u16(centiseconds);
    out.bytes([TRANSPARENT, 0x00]);
    // Image descriptor, with a 256-entry local color table.
    out.bytes([0x2c]);
    out.u16(0);
    out.u16(0);
    out.u16(width);
    out.u16(height);
    out.bytes([0x80 | 0x07]);
    for (let i = 0; i < 256; i++) {
      const color = palette[i] ?? [0, 0, 0];
      out.bytes([color[0], color[1], color[2]]);
    }
    out.bytes([8]); // LZW minimum code size
    const data = lzw(indices, 8);
    for (let i = 0; i < data.length; i += 255) {
      const block = data.subarray(i, i + 255);
      out.bytes([block.length]);
      out.bytes(block);
    }
    out.bytes([0x00]);
  }
  out.bytes([0x3b]);
  return out.result();
}

const TRANSPARENT = 255;

// A frame as color-table indices: exact colors when there are few enough.
function indexFrame({ data, width, height }) {
  const indices = new Uint8Array(width * height);
  const exact = new Map(); // 0xRRGGBB -> index
  let tooMany = false;
  for (let i = 0; i < indices.length && !tooMany; i++) {
    if (data[i * 4 + 3] < 128) continue;
    const key = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
    if (!exact.has(key)) {
      if (exact.size === 255) tooMany = true;
      else exact.set(key, exact.size);
    }
  }
  let palette;
  let nearest;
  if (!tooMany) {
    palette = [...exact.keys()].map((key) => [(key >> 16) & 255, (key >> 8) & 255, key & 255]);
    nearest = (r, g, b) => exact.get((r << 16) | (g << 8) | b);
  } else {
    palette = dominantColors(new ImageData(data, width, height), 255).slice(0, 255);
    const cache = new Map();
    nearest = (r, g, b) => {
      const key = (r << 16) | (g << 8) | b;
      let index = cache.get(key);
      if (index === undefined) {
        let best = Infinity;
        palette.forEach(([pr, pg, pb], i) => {
          const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
          if (distance < best) [best, index] = [distance, i];
        });
        cache.set(key, index);
      }
      return index;
    };
  }
  for (let i = 0; i < indices.length; i++) {
    indices[i] = data[i * 4 + 3] < 128 ? TRANSPARENT : nearest(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  return { palette, indices };
}

// GIF's variable-width LZW, packed least-significant bit first.
function lzw(indices, minimumCodeSize) {
  const clear = 1 << minimumCodeSize;
  const end = clear + 1;
  const out = [];
  let buffer = 0;
  let bits = 0;
  let size = minimumCodeSize + 1;
  const write = (code) => {
    buffer |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(buffer & 0xff);
      buffer >>>= 8;
      bits -= 8;
    }
  };
  let table = new Map();
  let next = end + 1;
  const reset = () => {
    table = new Map();
    next = end + 1;
    size = minimumCodeSize + 1;
  };
  write(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const code = table.get(key);
    if (code !== undefined) {
      prefix = code;
      continue;
    }
    write(prefix);
    if (next < 4096) {
      table.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      write(clear);
      reset();
    }
    prefix = k;
  }
  write(prefix);
  write(end);
  if (bits > 0) out.push(buffer & 0xff);
  return Uint8Array.from(out);
}

class ByteWriter {
  #chunks = [];
  bytes(values) {
    this.#chunks.push(Uint8Array.from(values));
  }
  u16(value) {
    this.bytes([value & 0xff, (value >> 8) & 0xff]);
  }
  string(text) {
    this.bytes([...text].map((c) => c.charCodeAt(0)));
  }
  result() {
    const length = this.#chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    for (const chunk of this.#chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}
