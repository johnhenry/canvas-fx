// <pixel-mosaic size="8">: pixelate. Each size×size block becomes its
// average color. See readme.md.
import { PixelFilter } from "../pixel-filter.mjs";

/**
 * Pixelates the image: each `size`×`size` block becomes its average color.
 *
 * @tag pixel-mosaic
 * @summary A pixel effect: pixelate into blocks of one color.
 *
 * @attr {number} size - Block size, in the working image's pixels. Default 8.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelMosaic extends PixelFilter {
  /**
   * Block size. Mirrors the `size` attribute.
   * @type {number}
   */
  get size() {
    const size = Math.floor(Number(this.getAttribute("size") ?? 8));
    return size >= 1 ? size : 8;
  }
  set size(value) {
    this.setAttribute("size", String(value));
  }

  /**
   * @param {ImageData} image
   * @returns {ImageData}
   */
  apply(image) {
    const { width, height, data } = image;
    const size = this.size;
    if (size === 1) return image;
    for (let top = 0; top < height; top += size) {
      for (let left = 0; left < width; left += size) {
        const bottom = Math.min(top + size, height);
        const right = Math.min(left + size, width);
        const sum = [0, 0, 0, 0];
        for (let y = top; y < bottom; y++) {
          for (let x = left; x < right; x++) {
            const i = (y * width + x) * 4;
            for (let c = 0; c < 4; c++) sum[c] += data[i + c];
          }
        }
        const count = (bottom - top) * (right - left);
        const average = sum.map((total) => Math.round(total / count));
        for (let y = top; y < bottom; y++) {
          for (let x = left; x < right; x++) data.set(average, (y * width + x) * 4);
        }
      }
    }
    return image;
  }
}
