// <pixel-canvas>: run an image, video, or canvas through pixel effects,
// and show the result. Effects are listed in the `effects` attribute, like
// CSS `filter`, and/or wrapped around the source as elements:
//
//   <pixel-canvas width="160" effects="mosaic(4) palette(gameboy, ordered)">
//     <img src="photo.jpg" alt="Our cat" />
//   </pixel-canvas>
//
//   <pixel-canvas width="160">                       <- draws the result
//     <pixel-palette colors="gameboy" dither="ordered"> <- 2. then this
//       <pixel-mosaic size="4">                      <- 1. this first
//         <img src="photo.jpg" alt="Our cat" />      <- the source
//       </pixel-mosaic>
//     </pixel-palette>
//   </pixel-canvas>
//
// Effect elements apply from the inside out, then the attribute's list,
// left to right.
//
// With `html` (experimental), its own HTML is the source, live: forms,
// text, anything, drawn through the effects and still clickable, where
// the browser has HTML-in-canvas (`<canvas layoutsubtree>`,
// `drawElementImage()`); elsewhere the HTML just shows as it is.
//
//   <pixel-canvas html effects="mosaic(3) palette(gameboy)">
//     <form>…</form>
//   </pixel-canvas>
//
// The
// light-DOM content stays in the document (so the image loads and stays
// the source of truth) but isn't displayed: a canvas in this element's
// shadow root is. Before this element is defined, or if the source can't
// be read, the original content shows instead. See readme.md.

import "../builtins.mjs";
import { effectRegistry, getPixelEffect, parseEffects, resolveParams } from "../effects.mjs";
import { dominantColors, toHex } from "../quantize.mjs";

const NATIVE_SOURCES = ["img", "video", "canvas"];
// HTML-in-canvas (WICG; in Chromium behind a flag or an origin trial).
const HTML_IN_CANVAS = typeof CanvasRenderingContext2D !== "undefined" && "drawElementImage" in CanvasRenderingContext2D.prototype;
// Any element that draws itself on a canvas it exposes as `canvas` (and
// fires `framechange` when it redraws) is a source too: <pixel-sprite>,
// or your own game or visualization.
const hasCanvas = (element) =>
  element.canvas instanceof HTMLCanvasElement || (globalThis.OffscreenCanvas && element.canvas instanceof OffscreenCanvas);
const isSource = (element) => NATIVE_SOURCES.includes(element.localName) || hasCanvas(element);
const setAttr = (element, name, value) => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};

/**
 * Draws its source image, video, or canvas through the pixel effects
 * wrapped around it.
 *
 * @tag pixel-canvas
 * @summary Pixel effects on any image, video, canvas, or pixel sprite.
 *
 * @attr {number} width - Working width in pixels: the source is scaled to it (keeping its aspect ratio) before the effects run. Smaller is faster and chunkier. Default: the source's own width.
 * @attr {number} height - Working height, if `width` isn't given.
 * @attr {string} effects - Effects to apply, in order, like CSS `filter`: `mosaic(4) palette(gameboy, ordered) adjust(contrast 1.3)`. They run after any effect elements inside.
 * @attr {number} swatches - Publish the result's N most common colors as `--pixel-swatch-1` … `--pixel-swatch-N` custom properties (and the `palette` property). Default: none.
 * @attr {string} swatches-target - A selector for more elements to set those custom properties on (for example `html`, to theme the page). They're always set on the `<pixel-canvas>` itself.
 * @attr {number} fps - Redraw at this rate, so effects that change over time (`glitch`, `wave`, your own) animate even on a still image. Without it, it redraws only when something changes (or every frame of a playing video).
 * @attr {boolean} paused - Stops the clock effects animate by, and the `fps` redraws. Reflects; write it in markup to start paused.
 * @attr {boolean} html - Experimental: draw its own HTML content (live, and still interactive) through the effects, where the browser supports HTML-in-canvas; elsewhere the content shows as it is. Without `width`/`height`, one working pixel is one CSS pixel.
 *
 * @fires load - The first frame of a source was drawn.
 * @fires play - The clock started or resumed.
 * @fires pause - The clock paused.
 * @fires palettechange - With `swatches`: the published colors changed.
 * @fires error - The source can't be read (for example, a cross-origin image without CORS) or an effect threw: an `ErrorEvent`, and the original content is shown instead. Also fired, once per name, for an unknown effect in `effects`, which is skipped.
 *
 * @csspart canvas - The `<canvas>` showing the result.
 * @csspart html-canvas - With `html`, where supported: the `<canvas layoutsubtree>` its content is laid out in and the result is drawn on.
 *
 * Invoker commands: `--play`, `--pause`, `--toggle`.
 */
export default class PixelCanvas extends HTMLElement {
  static observedAttributes = ["width", "height", "effects", "swatches", "swatches-target", "fps", "paused", "html"];

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
  #reportedUnknown = new Set();
  // An effect defined after this element drew may be one it's waiting on.
  #onDefine = () => this.#schedule();

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.append(
      ":host(:not([hidden])) { display: inline-block; vertical-align: middle; }",
      " canvas { display: block; inline-size: 100%; block-size: auto; image-rendering: pixelated; }",
      " :host(:not([data-failed])) slot { display: none; }",
      " :host([data-failed]) canvas { display: none; }",
      // With `html`: the content is laid out inside the html canvas, which
      // shows the result; without support, the content shows as it is.
      " :host([data-html]), :host([data-html-unsupported]) { display: block; }",
      " :host([data-html]) canvas[part=canvas], :host([data-html-unsupported]) canvas { display: none; }",
      " :host([data-html]) slot, :host([data-html-unsupported]) slot { display: contents; }",
      " canvas[part=html-canvas] { display: block; inline-size: 100%; }",
      // A canvas's children shrink to fit; stretch them like blocks
      // elsewhere (the author's own width still wins).
      " :host([data-html]) ::slotted(*) { box-sizing: border-box; inline-size: 100%; }",
    );
    this.#canvas = document.createElement("canvas");
    this.#canvas.setAttribute("part", "canvas");
    this.#canvas.width = 0;
    this.#canvas.height = 0;
    this.#slot = document.createElement("slot");
    shadow.append(style, this.#canvas, this.#slot);
    this.addEventListener("command", (event) => {
      if (event.command === "--play") this.play();
      else if (event.command === "--pause") this.pause();
      else if (event.command === "--toggle") this.paused ? this.play() : this.pause();
    });
  }

  connectedCallback() {
    this.addEventListener("pixelchange", this.#onPixelChange);
    effectRegistry.addEventListener("define", this.#onDefine);
    // characterData too: editing a <pixel-shader>'s code or a sprite's text.
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, characterData: true });
    this.#runClock();
    this.#setHTMLMode();
    this.#schedule();
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.removeEventListener("pixelchange", this.#onPixelChange);
    effectRegistry.removeEventListener("define", this.#onDefine);
    this.#observer.disconnect();
    cancelAnimationFrame(this.#scheduled);
    this.#scheduled = 0;
    this.#stopVideo();
    this.#bindSource(null);
    this.#publish([]); // take our custom properties back off the targets
    this.#stopClock();
  }

  attributeChangedCallback(name, previous, current) {
    if (!this.isConnected) return;
    if (name === "paused") {
      if (this.#reflecting) return;
      // The attribute already changed, so act on it here.
      if (current === null && previous !== null) {
        this.#runClock({ force: true });
        this.dispatchEvent(new Event("play", { bubbles: true }));
      } else if (current !== null && previous === null) {
        this.#stopClock();
        this.dispatchEvent(new Event("pause", { bubbles: true }));
      }
      return;
    }
    if (name === "fps") this.#runClock();
    if (name === "html") this.#setHTMLMode();
    this.#schedule();
  }

  /**
   * Seconds on the clock that effects animate by. It runs while the
   * element is connected and not paused (and, for visitors who prefer
   * reduced motion, only once `play()` is called).
   * @type {number}
   * @readonly
   */
  get time() {
    return (this.#elapsed + (this.#startedAt === null ? 0 : performance.now() - this.#startedAt)) / 1000;
  }

  /**
   * Whether the clock is paused.
   * @type {boolean}
   * @readonly
   */
  get paused() {
    return this.hasAttribute("paused");
  }

  /** Start or resume the clock (and the `fps` redraws). */
  play() {
    const wasPaused = this.paused;
    this.#setPaused(false);
    this.#runClock({ force: true });
    if (wasPaused) this.dispatchEvent(new Event("play", { bubbles: true }));
  }

  /** Pause the clock where it is. */
  pause() {
    const wasPaused = this.paused;
    this.#setPaused(true);
    this.#stopClock();
    if (!wasPaused) this.dispatchEvent(new Event("pause", { bubbles: true }));
  }

  #setPaused(paused) {
    this.#reflecting = true;
    this.toggleAttribute("paused", paused);
    this.#reflecting = false;
  }

  // The clock: elapsed time, plus a redraw loop at `fps`.
  #runClock({ force = false } = {}) {
    if (!this.isConnected || this.paused) return;
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (force) this.#forced = true;
    if (reduced && !this.#forced) return;
    this.#startedAt ??= performance.now();
    cancelAnimationFrame(this.#ticker);
    this.#ticker = 0;
    const fps = Number(this.getAttribute("fps"));
    if (!(fps > 0)) return;
    const period = 1000 / fps;
    let last = 0;
    const tick = (now) => {
      if (now - last >= period - 8) {
        last = now;
        this.#draw();
      }
      this.#ticker = requestAnimationFrame(tick);
    };
    this.#ticker = requestAnimationFrame(tick);
  }

  #stopClock() {
    cancelAnimationFrame(this.#ticker);
    this.#ticker = 0;
    if (this.#startedAt !== null) this.#elapsed += performance.now() - this.#startedAt;
    this.#startedAt = null;
  }
  #elapsed = 0;
  #startedAt = null;
  #ticker = 0;
  #forced = false;
  #reflecting = false;
  #draws = 0;

  /**
   * What's being drawn: the first element inside that's an `<img>`,
   * `<video>`, or `<canvas>`, or that exposes a `canvas` property (like
   * `<pixel-sprite>`).
   * @type {Element | null}
   * @readonly
   */
  get source() {
    if (this.hasAttribute("html")) return null; // the content itself is the source (or, unsupported, just shows)
    const walker = document.createTreeWalker(this, NodeFilter.SHOW_ELEMENT);
    for (let element = walker.nextNode(); element; element = walker.nextNode()) {
      if (isSource(element)) return element;
    }
    return null;
  }

  /**
   * The effect elements wrapped around the source, in the order they run
   * (innermost first). Disabled ones are included.
   * @type {Element[]}
   * @readonly
   */
  get effectElements() {
    const effects = [];
    for (let element = this.source?.parentElement; element && element !== this; element = element.parentElement) {
      if (typeof element.apply === "function") effects.push(element);
    }
    return effects;
  }

  /**
   * Mirrors the `effects` attribute.
   * @type {string}
   */
  get effects() {
    return this.getAttribute("effects") ?? "";
  }
  set effects(value) {
    this.setAttribute("effects", value);
  }

  /**
   * How many swatches to publish. Mirrors the `swatches` attribute.
   * @type {number}
   */
  get swatches() {
    return Math.max(0, Math.floor(Number(this.getAttribute("swatches")) || 0));
  }
  set swatches(value) {
    this.setAttribute("swatches", String(value));
  }

  /**
   * Mirrors the `swatches-target` attribute.
   * @type {string}
   */
  get swatchesTarget() {
    return this.getAttribute("swatches-target") ?? "";
  }
  set swatchesTarget(value) {
    this.setAttribute("swatches-target", value);
  }

  /**
   * With `swatches`: the result's most common colors, as `#rrggbb`, most
   * common first. Empty otherwise.
   * @type {string[]}
   * @readonly
   */
  get palette() {
    return [...this.#palette];
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
    const events = ["load", "loadeddata", "seeked", "play", "resize", "framechange"];
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

  // What drawImage draws: a sprite's own canvas, or the source itself.
  #drawable(source) {
    return NATIVE_SOURCES.includes(source.localName) ? source : source.canvas;
  }

  #size(source) {
    source = this.#drawable(source);
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
    if (this.#htmlCanvas) {
      this.#htmlCanvas.requestPaint(); // drawn in its paint event (#paintHTML)
      return true;
    }
    if (this.hasAttribute("html")) {
      this.#label(null); // the content shows as it is: it isn't an image
      return false;
    }
    const source = this.source;
    this.#bindSource(source);
    this.#label(source);
    if (!source) {
      this.#awaitDefinitions();
      return false;
    }
    if (source instanceof HTMLImageElement && !source.complete) return false;
    const size = this.#size(source);
    if (!size) return false;
    const [width, height] = size;
    try {
      const work = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
      const drawable = this.#drawable(source);
      // Shrinking smooths (averaging); enlarging doesn't, so pixel art and
      // small sources stay crisp.
      work.imageSmoothingEnabled = width < (drawable.naturalWidth || drawable.videoWidth || drawable.width);
      work.drawImage(drawable, 0, 0, width, height);
      const image = this.#applyEffects(work.getImageData(0, 0, width, height));
      if (this.#canvas.width !== image.width) this.#canvas.width = image.width;
      if (this.#canvas.height !== image.height) this.#canvas.height = image.height;
      this.#canvas.getContext("2d").putImageData(image, 0, 0);
      this.#publishSwatches(image);
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

  // The effect elements around the source, then the `effects` list.
  #applyEffects(image) {
    const context = { time: this.time, frame: this.#draws++ };
    for (const effect of this.effectElements) {
      if (effect.hasAttribute("disabled")) continue;
      const result = effect.apply(image, context);
      if (result instanceof ImageData) image = result;
    }
    for (const { name, args } of parseEffects(this.getAttribute("effects"))) {
      const effect = getPixelEffect(name);
      if (!effect) {
        this.#unknown(name);
        continue;
      }
      const result = effect.apply(image, resolveParams(effect, args), context);
      if (result instanceof ImageData) image = result;
    }
    return image;
  }

  #publishSwatches(image) {
    const count = this.swatches;
    // Cluster into at least 8 colors and keep the most common: with fewer
    // clusters, a swatch would be an average of unlike colors.
    this.#publish(count ? dominantColors(image, Math.max(count, 8)).slice(0, count).map(toHex) : []);
  }

  // --- html: its own HTML as the source (HTML-in-canvas) --------------------
  //
  // The content is slotted into a <canvas layoutsubtree> in the shadow root,
  // so it's laid out (and hit-tested, and in the accessibility tree) where
  // the canvas is, but not painted by the page: on each `paint` event, the
  // canvas draws it (drawElementImage), the effects run on that, and the
  // result is drawn back onto the same canvas. The author's markup never
  // moves.
  #htmlCanvas = null;
  #htmlFailed = false; // it threw once: show the content as it is from then on
  #resizeObserver = null;
  #onPaint = () => this.#paintHTML();

  #setHTMLMode() {
    const wanted = this.hasAttribute("html") && this.isConnected && !this.#htmlFailed;
    this.toggleAttribute("data-html-unsupported", wanted && !HTML_IN_CANVAS);
    if (wanted && HTML_IN_CANVAS && !this.#htmlCanvas) {
      const canvas = document.createElement("canvas");
      canvas.setAttribute("layoutsubtree", "");
      canvas.setAttribute("part", "html-canvas");
      canvas.addEventListener("paint", this.#onPaint);
      canvas.append(this.#slot);
      this.shadowRoot.append(canvas);
      this.#htmlCanvas = canvas;
      setAttr(this, "data-html", "");
      this.#label(null);
      this.#resizeObserver = new ResizeObserver(() => this.#fitHTML());
      this.#slot.addEventListener("slotchange", this.#observeContent);
      this.#observeContent();
    } else if (!(wanted && HTML_IN_CANVAS) && this.#htmlCanvas) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
      this.#slot.removeEventListener("slotchange", this.#observeContent);
      this.shadowRoot.append(this.#slot);
      this.#htmlCanvas.remove();
      this.#htmlCanvas = null;
      this.removeAttribute("data-html");
    } else if (this.#htmlCanvas && this.isConnected) {
      this.#observeContent(); // reconnected
    }
  }

  #observeContent = () => {
    if (!this.#resizeObserver) return;
    this.#resizeObserver.disconnect();
    this.#resizeObserver.observe(this);
    for (const element of this.#slot.assignedElements()) this.#resizeObserver.observe(element);
    this.#fitHTML();
  };

  // The canvas is as wide as this element and as tall as its content; its
  // bitmap matches the device pixels, so the content is drawn sharp before
  // the effects run.
  #fitHTML() {
    const canvas = this.#htmlCanvas;
    if (!canvas) return;
    const top = canvas.getBoundingClientRect().top;
    let bottom = top;
    for (const element of this.#slot.assignedElements()) bottom = Math.max(bottom, element.getBoundingClientRect().bottom);
    const height = Math.ceil(bottom - top);
    if (canvas.style.blockSize !== `${height}px`) canvas.style.blockSize = `${height}px`;
    const ratio = globalThis.devicePixelRatio || 1;
    const width = Math.round(canvas.getBoundingClientRect().width * ratio);
    const deviceHeight = Math.round(height * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== deviceHeight) canvas.height = deviceHeight;
    canvas.requestPaint();
  }

  #paintHTML() {
    const canvas = this.#htmlCanvas;
    if (!canvas || !canvas.width || !canvas.height) return;
    try {
      const box = canvas.getBoundingClientRect();
      const scale = canvas.width / box.width;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.reset();
      // 1. The content, as laid out, at device resolution.
      for (const element of this.#slot.assignedElements()) {
        const rect = element.getBoundingClientRect();
        context.drawElementImage(element, (rect.left - box.left) * scale, (rect.top - box.top) * scale, rect.width * scale, rect.height * scale);
      }
      // 2. Scaled to the working size (CSS pixels unless width/height say
      // otherwise), through the effects.
      let [width, height] = [Math.max(1, Math.round(box.width)), Math.max(1, Math.round(box.height))];
      const w = Math.floor(Number(this.getAttribute("width")));
      const h = Math.floor(Number(this.getAttribute("height")));
      if (w > 0) [width, height] = [w, Math.max(1, Math.round((box.height / box.width) * w))];
      else if (h > 0) [width, height] = [Math.max(1, Math.round((box.width / box.height) * h)), h];
      const work = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
      work.drawImage(canvas, 0, 0, width, height);
      const image = this.#applyEffects(work.getImageData(0, 0, width, height));
      work.canvas.width = image.width;
      work.canvas.height = image.height;
      work.putImageData(image, 0, 0);
      // 3. Back onto the canvas, scaled up crisply.
      context.reset();
      context.imageSmoothingEnabled = false;
      context.drawImage(work.canvas, 0, 0, canvas.width, canvas.height);
      this.#publishSwatches(image);
    } catch (error) {
      // Show the content as it is, and say why.
      this.#htmlFailed = true;
      this.#setHTMLMode();
      this.#fail(error);
      return;
    }
    if (this.#loadedSource !== this) {
      this.#loadedSource = this;
      this.dispatchEvent(new Event("load"));
    }
  }

  // Set --pixel-swatch-N on this element and the swatches-target ones,
  // remove them from elements no longer targeted, and say when they change.
  #publish(colors) {
    let targets = [this];
    try {
      if (this.swatchesTarget && this.isConnected) targets = [this, ...document.querySelectorAll(this.swatchesTarget)];
    } catch {
      // an invalid selector: just this element
    }
    if (!colors.length) targets = [];
    for (const element of this.#swatched) {
      if (targets.includes(element) && this.#palette.length <= colors.length) continue;
      for (let i = 1; i <= this.#palette.length; i++) element.style.removeProperty(`--pixel-swatch-${i}`);
    }
    for (const element of targets) colors.forEach((color, i) => element.style.setProperty(`--pixel-swatch-${i + 1}`, color));
    this.#swatched = new Set(targets);
    const changed = colors.length !== this.#palette.length || colors.some((color, i) => color !== this.#palette[i]);
    this.#palette = colors;
    if (changed && this.isConnected) this.dispatchEvent(new Event("palettechange", { bubbles: true }));
  }
  #palette = [];
  #swatched = new Set();

  // A custom source isn't one until it's defined (no `canvas` yet): redraw
  // when any undefined element inside is.
  #awaitDefinitions() {
    for (const element of this.querySelectorAll(":not(:defined)")) {
      const tag = element.localName;
      if (this.#awaiting.has(tag)) continue;
      this.#awaiting.add(tag);
      customElements.whenDefined(tag).then(() => {
        this.#awaiting.delete(tag);
        this.#schedule();
      });
    }
  }
  #awaiting = new Set();

  #unknown(name) {
    if (this.#reportedUnknown.has(name)) return;
    this.#reportedUnknown.add(name);
    const error = new ReferenceError(`No pixel effect named "${name}" (define it with definePixelEffect)`);
    queueMicrotask(() => this.dispatchEvent(new ErrorEvent("error", { error, message: error.message })));
  }

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
    if (this.hasAttribute("html")) {
      // Its role is its content's, not an image's.
      if (this.getAttribute("role") === "img") this.removeAttribute("role");
      if (this.#generatedLabel !== null) this.removeAttribute("aria-label");
      this.#generatedLabel = null;
      return;
    }
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
