// The protocol between <pixel-canvas> and the effects nested inside it.
// An effect is any element with an `apply(image)` method that takes an
// ImageData and returns one (the same one, changed, or a new one).
// <pixel-canvas> finds the source image, then applies every effect element
// between the source and itself, innermost first.
//
// PixelFilter is a convenient base class: subclasses only write apply(),
// and get `disabled` (pass the image through untouched) and invalidate()
// (ask the canvas to redraw after a change that isn't an attribute).

/**
 * Base class for pixel effects: override `apply(image)`.
 */
export class PixelFilter extends HTMLElement {
  /**
   * Transform the image. The default passes it through.
   * @param {ImageData} image
   * @returns {ImageData}
   */
  apply(image) {
    return image;
  }

  /**
   * Whether the effect is switched off (the image passes through).
   * Mirrors the `disabled` attribute.
   * @type {boolean}
   */
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(value) {
    this.toggleAttribute("disabled", Boolean(value));
  }

  /**
   * Ask the enclosing <pixel-canvas> to redraw, after a change it can't
   * see (attribute changes are seen already).
   */
  invalidate() {
    this.dispatchEvent(new Event("pixelchange", { bubbles: true }));
  }
}

/**
 * Define an effect from a function, with no class to write:
 * `definePixelFilter("pixel-invert", (image, element) => image)`.
 * The function receives the ImageData and the effect element (to read
 * its attributes), and returns an ImageData.
 * @param {string} name the tag name
 * @param {(image: ImageData, element: PixelFilter) => ImageData} transform
 * @returns {CustomElementConstructor}
 */
export function definePixelFilter(name, transform) {
  const Filter = class extends PixelFilter {
    apply(image) {
      return transform(image, this) ?? image;
    }
  };
  customElements.define(name, Filter);
  return Filter;
}

// Resolve any CSS color ("teal", "#0f380f", "rgb(…)", "oklch(…)") to
// [r, g, b, a] (0–255), with the browser's own parser.
let probe;
/**
 * @param {string} color
 * @returns {[number, number, number, number] | null} null if it isn't a color
 */
export function parseColor(color) {
  if (!CSS.supports("color", color)) return null;
  probe ??= new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data];
}
