// <pixel-canvas>: run an image, video, or canvas through the pixel effects
// wrapped around it, and show the result.
//
//   <pixel-canvas width="160">                       <- draws the result
//     <pixel-palette colors="gameboy" dither="ordered"> <- 2. then this
//       <pixel-mosaic size="4">                      <- 1. this first
//         <img src="photo.jpg" alt="Our cat" />      <- the source
//       </pixel-mosaic>
//     </pixel-palette>
//   </pixel-canvas>
//
// Effects apply from the inside out, the way the markup reads. The
// light-DOM content stays in the document (so the image loads and stays
// the source of truth) but isn't displayed: a canvas in this element's
// shadow root is. Before this element is defined, or if the source can't
// be read, the original content shows instead. See readme.md.

const SOURCES = "img, video, canvas";
const setAttr = (element, name, value) => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};

/**
 * Draws its source image, video, or canvas through the pixel effects
 * wrapped around it.
 *
 * @tag pixel-canvas
 * @summary Pixel effects on any image, video, or canvas, by wrapping it in effect elements.
 *
 * @attr {number} width - Working width in pixels: the source is scaled to it (keeping its aspect ratio) before the effects run. Smaller is faster and chunkier. Default: the source's own width.
 * @attr {number} height - Working height, if `width` isn't given.
 *
 * @fires load - The first frame of a source was drawn.
 * @fires error - The source can't be read (for example, a cross-origin image without CORS) or an effect threw. An `ErrorEvent`; the original content is shown instead.
 *
 * @csspart canvas - The `<canvas>` showing the result.
 */
export default class PixelCanvas extends HTMLElement {
  static observedAttributes = ["width", "height"];

  #canvas;
  #slot;
  #scheduled = 0;
  #frame = 0;
  #video = null;
  #source = null;
  #loadedSource = null;
  #failed = false;
  // Changes inside (an effect's attributes, a new source) redraw; changes
  // to this element's own attributes are its own labelling, except for
  // width/height, which attributeChangedCallback handles.
  #observer = new MutationObserver((records) => {
    if (records.some((record) => record.target !== this || record.type === "childList")) this.#schedule();
  });
  #onSourceEvent = (event) => {
    if (event.type === "play") this.#watchVideo();
    this.#schedule();
  };
  #onPixelChange = () => this.#schedule();

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.append(
      ":host(:not([hidden])) { display: inline-block; vertical-align: middle; }",
      " canvas { display: block; inline-size: 100%; block-size: auto; image-rendering: pixelated; }",
      " :host(:not([data-failed])) slot { display: none; }",
      " :host([data-failed]) canvas { display: none; }",
    );
    this.#canvas = document.createElement("canvas");
    this.#canvas.setAttribute("part", "canvas");
    this.#canvas.width = 0;
    this.#canvas.height = 0;
    this.#slot = document.createElement("slot");
    shadow.append(style, this.#canvas, this.#slot);
  }

  connectedCallback() {
    this.addEventListener("pixelchange", this.#onPixelChange);
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true });
    this.#schedule();
  }

  disconnectedCallback() {
    this.removeEventListener("pixelchange", this.#onPixelChange);
    this.#observer.disconnect();
    cancelAnimationFrame(this.#scheduled);
    this.#scheduled = 0;
    this.#stopVideo();
    this.#bindSource(null);
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#schedule();
  }

  /**
   * The image, video, or canvas being drawn: the first one inside.
   * @type {HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null}
   * @readonly
   */
  get source() {
    return this.querySelector(SOURCES);
  }

  /**
   * The effect elements applied to the source, in the order they run
   * (innermost first). Disabled ones are included.
   * @type {Element[]}
   * @readonly
   */
  get effects() {
    const effects = [];
    for (let element = this.source?.parentElement; element && element !== this; element = element.parentElement) {
      if (typeof element.apply === "function") effects.push(element);
    }
    return effects;
  }

  /**
   * The canvas showing the result (in the shadow root).
   * @type {HTMLCanvasElement}
   * @readonly
   */
  get canvas() {
    return this.#canvas;
  }

  /**
   * Draw now, instead of on the next frame. Returns whether it drew.
   * @returns {boolean}
   */
  render() {
    cancelAnimationFrame(this.#scheduled);
    this.#scheduled = 0;
    return this.#draw();
  }

  /**
   * The result as an image file, like `HTMLCanvasElement.toBlob()`.
   * @param {string} [type] e.g. "image/png" (the default)
   * @param {number} [quality]
   * @returns {Promise<Blob | null>}
   */
  toBlob(type, quality) {
    return new Promise((resolve) => this.#canvas.toBlob(resolve, type, quality));
  }

  /**
   * The result as a data: URL, like `HTMLCanvasElement.toDataURL()`.
   * @param {string} [type]
   * @param {number} [quality]
   * @returns {string}
   */
  toDataURL(type, quality) {
    return this.#canvas.toDataURL(type, quality);
  }

  #schedule() {
    if (this.#scheduled || !this.isConnected) return;
    this.#scheduled = requestAnimationFrame(() => {
      this.#scheduled = 0;
      this.#draw();
    });
  }

  #bindSource(source) {
    if (source === this.#source) return;
    const events = ["load", "loadeddata", "seeked", "play", "resize"];
    for (const type of events) this.#source?.removeEventListener(type, this.#onSourceEvent);
    this.#stopVideo();
    this.#source = source;
    for (const type of events) source?.addEventListener(type, this.#onSourceEvent);
    if (source instanceof HTMLVideoElement && !source.paused) this.#watchVideo();
  }

  // Redraw on every new video frame while it plays.
  #watchVideo() {
    const video = this.#source;
    if (!(video instanceof HTMLVideoElement) || this.#video === video) return;
    this.#video = video;
    const next = () => {
      if (this.#video !== video || video.paused || video.ended) {
        if (this.#video === video) this.#video = null;
        return;
      }
      this.#draw();
      this.#frame = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(next) : requestAnimationFrame(next);
    };
    next();
  }

  #stopVideo() {
    const video = this.#video;
    this.#video = null;
    if (!video) return;
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(this.#frame);
    cancelAnimationFrame(this.#frame);
  }

  #size(source) {
    const natural =
      source instanceof HTMLImageElement
        ? [source.naturalWidth, source.naturalHeight]
        : source instanceof HTMLVideoElement
          ? [source.videoWidth, source.videoHeight]
          : [source.width, source.height];
    const [w, h] = natural;
    if (!w || !h) return null;
    const width = Math.floor(Number(this.getAttribute("width")));
    const height = Math.floor(Number(this.getAttribute("height")));
    if (width > 0) return [width, Math.max(1, Math.round((h / w) * width))];
    if (height > 0) return [Math.max(1, Math.round((w / h) * height)), height];
    return [w, h];
  }

  #draw() {
    const source = this.source;
    this.#bindSource(source);
    this.#label(source);
    if (!source) return false;
    if (source instanceof HTMLImageElement && !source.complete) return false;
    const size = this.#size(source);
    if (!size) return false;
    const [width, height] = size;
    try {
      const work = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
      work.imageSmoothingEnabled = true;
      work.drawImage(source, 0, 0, width, height);
      let image = work.getImageData(0, 0, width, height);
      for (const effect of this.effects) {
        if (effect.hasAttribute("disabled")) continue;
        const result = effect.apply(image);
        if (result instanceof ImageData) image = result;
      }
      if (this.#canvas.width !== image.width) this.#canvas.width = image.width;
      if (this.#canvas.height !== image.height) this.#canvas.height = image.height;
      this.#canvas.getContext("2d").putImageData(image, 0, 0);
    } catch (error) {
      this.#fail(error);
      return false;
    }
    this.#failed = false;
    if (this.hasAttribute("data-failed")) this.removeAttribute("data-failed");
    if (this.#loadedSource !== source || (source instanceof HTMLImageElement && this.#loadedSrc !== source.currentSrc)) {
      this.#loadedSource = source;
      this.#loadedSrc = source instanceof HTMLImageElement ? source.currentSrc : null;
      this.dispatchEvent(new Event("load"));
    }
    return true;
  }
  #loadedSrc = null;

  // Show the original content, and say why, once per failure.
  #fail(error) {
    setAttr(this, "data-failed", "");
    if (this.#failed) return;
    this.#failed = true;
    this.dispatchEvent(new ErrorEvent("error", { error, message: String(error?.message ?? error) }));
  }

  // The result is an image: name it after the source, unless the author
  // has. An empty alt means decorative.
  #label(source) {
    if (this.hasAttribute("aria-label") && this.getAttribute("aria-label") !== this.#generatedLabel) return;
    if (this.hasAttribute("aria-labelledby")) return;
    const text = source?.getAttribute("alt") ?? source?.getAttribute("aria-label") ?? source?.getAttribute("title") ?? null;
    if (text === "") {
      setAttr(this, "role", "presentation");
      if (this.#generatedLabel !== null) this.removeAttribute("aria-label");
      this.#generatedLabel = null;
      return;
    }
    setAttr(this, "role", "img");
    if (text) {
      this.#generatedLabel = text;
      setAttr(this, "aria-label", text);
    } else if (this.#generatedLabel !== null) {
      this.removeAttribute("aria-label");
      this.#generatedLabel = null;
    }
  }
  #generatedLabel = null;
}
