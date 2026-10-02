// <pixel-grid size="8">: draw grid lines every `size` pixels, like the
// seams between tiles or the cells of an LED panel. Pairs with a
// <pixel-mosaic> of the same size. See readme.md.
import { PixelFilter, parseColor } from "../pixel-filter.mjs";

/**
 * Draws grid lines every `size` pixels.
 *
 * @tag pixel-grid
 * @summary A pixel effect: grid lines between cells.
 *
 * @attr {number} size - Cell size, in the working image's pixels. Default 8.
 * @attr {string} color - Line color, any CSS color (transparency blends). Default `rgb(0 0 0 / 0.35)`.
 * @attr {number} line - Line thickness in pixels. Default 1.
 * @attr {boolean} disabled - Pass the image through unchanged.
 */
export default class PixelGrid extends PixelFilter {
  /**
   * Cell size. Mirrors the `size` attribute.
   * @type {number}
   */
  get size() {
    const size = Math.floor(Number(this.getAttribute("size") ?? 8));
    return size >= 2 ? size : 8;
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
    const line = Math.max(1, Math.min(size - 1, Math.floor(Number(this.getAttribute("line") ?? 1)) || 1));
    const [r, g, b, a] = parseColor(this.getAttribute("color") ?? "") ?? [0, 0, 0, 89];
    const alpha = a / 255;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x % size >= line && y % size >= line) continue;
        const i = (y * width + x) * 4;
        data[i] = data[i] * (1 - alpha) + r * alpha;
        data[i + 1] = data[i + 1] * (1 - alpha) + g * alpha;
        data[i + 2] = data[i + 2] * (1 - alpha) + b * alpha;
        data[i + 3] = Math.max(data[i + 3], a);
      }
    }
    return image;
  }
}
