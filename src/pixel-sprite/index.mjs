// <pixel-sprite>: pixel art written as text, one character per pixel.
//
//   <pixel-sprite colors=". transparent; # #222; o gold" alt="A coin">
//     .##.
//     #oo#
//     .##.
//   </pixel-sprite>
//
// Blank lines separate animation frames, played at `fps`. It draws itself
// on a canvas in its shadow root (the text isn't displayed), scaled up
// crisply, and it's also a source for <pixel-canvas>. See readme.md.
import { parseColor } from "../effects.mjs";
import PALETTES from "../pixel-palette/palettes.mjs";

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// "pico-8" -> { 0: [r,g,b,a], …, f: … }; ". transparent; # black" -> { ".": …, "#": … }
function parseKey(text) {
  const key = { ".": [0, 0, 0, 0] };
  const named = PALETTES[(text ?? "pico-8").trim().toLowerCase() || "pico-8"];
  if (named) {
    named.forEach((color, i) => (key[DIGITS[i]] = parseColor(color)));
    return key;
  }
  for (const entry of text.split(";")) {
    const match = /^\s*(\S)\s+(.+?)\s*$/.exec(entry);
    if (!match) continue;
    const color = parseColor(match[2]);
    if (color) key[match[1]] = color;
  }
  return key;
}

// Text -> frames of rows, ignoring indentation and blank edges.
function parseFrames(text) {
  const frames = [];
  let current = [];
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (line) current.push([...line]);
    else if (current.length) {
      frames.push(current);
      current = [];
    }
  }
  if (current.length) frames.push(current);
  return frames;
}

/**
 * Pixel art written as text: one character per pixel, one line per row,
 * and a blank line between animation frames.
 *
 * @tag pixel-sprite
 * @summary Pixel art written as text, with animation frames.
 *
 * @attr {string} colors - What each character means: `char color` pairs separated by `;` (`. transparent; # black; o gold`), or a named palette whose colors are numbered `0`–`9` then `a`–`z` (`pico-8`, the default; `gameboy`; `1bit`; …). `.` is transparent unless you say otherwise.
 * @attr {number} fps - Play the frames at this rate. Without it (or with one frame), it's still.
 * @attr {boolean} paused - Whether the animation is paused. Reflects; write it in markup to start paused.
 * @attr {string} alt - A text alternative, as on `<img>`. An empty `alt` marks it decorative.
 *
 * @fires play - The animation started or resumed.
 * @fires pause - The animation paused.
 * @fires framechange - It was redrawn: the frame advanced, or its pixels or colors changed.
 *
 * @cssprop --domkit-sprite-scale - How many screen pixels each sprite pixel takes. Default 8.
 * @csspart canvas - The `<canvas>` it's drawn on.
 *
 * Invoker commands: `--play`, `--pause`, `--toggle`.
 */
export default class PixelSprite extends HTMLElement {
  static observedAttributes = ["colors", "fps", "paused", "alt"];

  #canvas;
  #sizing;
  #frames = [];
  #key = {};
  #frame = 0;
  #raf = 0;
  #last = 0;
  #reflecting = false;
  #observer = new MutationObserver(() => this.#parse());

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.append(
      ":host(:not([hidden])) { display: inline-block; vertical-align: middle; line-height: 0; }",
      " canvas { inline-size: 100%; block-size: auto; image-rendering: pixelated; }",
    );
    // Sized from the pixel count; page CSS on the element overrides it.
    this.#sizing = document.createElement("style");
    this.#canvas = document.createElement("canvas");
    this.#canvas.setAttribute("part", "canvas");
    this.#canvas.width = 0;
    this.#canvas.height = 0;
    shadow.append(style, this.#sizing, this.#canvas);
    this.addEventListener("command", (event) => {
      if (event.command === "--play") this.play();
      else if (event.command === "--pause") this.pause();
      else if (event.command === "--toggle") this.paused ? this.play() : this.pause();
    });
  }

  connectedCallback() {
    this.#observer.observe(this, { childList: true, subtree: true, characterData: true });
    this.#parse();
    this.#start();
  }

  disconnectedCallback() {
    this.#observer.disconnect();
    this.#stop();
  }

  attributeChangedCallback(name, previous, current) {
    if (!this.isConnected) return;
    if (name === "colors") this.#parse();
    else if (name === "alt") this.#label();
    else if (name === "fps") this.#start();
    else if (name === "paused" && !this.#reflecting) {
      if (current === null && previous !== null) {
        this.#start();
        this.dispatchEvent(new Event("play", { bubbles: true }));
      } else if (current !== null && previous === null) {
        this.#stop();
        this.dispatchEvent(new Event("pause", { bubbles: true }));
      }
    }
  }

  /**
   * The canvas it's drawn on (in the shadow root), at one pixel per
   * character.
   * @type {HTMLCanvasElement}
   * @readonly
   */
  get canvas() {
    return this.#canvas;
  }

  /**
   * How many frames there are.
   * @type {number}
   * @readonly
   */
  get frames() {
    return this.#frames.length;
  }

  /**
   * The frame showing, from 0. Setting it shows that frame (wrapping).
   * @type {number}
   */
  get frame() {
    return this.#frame;
  }
  set frame(value) {
    const count = this.#frames.length || 1;
    this.#frame = ((Math.trunc(Number(value) || 0) % count) + count) % count;
    this.#draw();
  }

  /**
   * Whether the animation is paused.
   * @type {boolean}
   * @readonly
   */
  get paused() {
    return this.hasAttribute("paused");
  }

  /** Play the frames (at `fps`). */
  play() {
    const wasPaused = this.paused;
    this.#setPaused(false);
    this.#start({ force: true });
    if (wasPaused) this.dispatchEvent(new Event("play", { bubbles: true }));
  }

  /** Pause on the current frame. */
  pause() {
    const wasPaused = this.paused;
    this.#setPaused(true);
    this.#stop();
    if (!wasPaused) this.dispatchEvent(new Event("pause", { bubbles: true }));
  }

  #setPaused(paused) {
    this.#reflecting = true;
    this.toggleAttribute("paused", paused);
    this.#reflecting = false;
  }

  #parse() {
    this.#key = parseKey(this.getAttribute("colors"));
    this.#frames = parseFrames(this.textContent);
    if (this.#frame >= this.#frames.length) this.#frame = 0;
    const width = Math.max(0, ...this.#frames.flatMap((rows) => rows.map((row) => row.length)));
    const height = Math.max(0, ...this.#frames.map((rows) => rows.length));
    this.#canvas.width = width;
    this.#canvas.height = height;
    this.#sizing.textContent = `:host { inline-size: calc(${width}px * var(--domkit-sprite-scale, 8)); }`;
    this.#label();
    this.#draw();
    this.#start();
  }

  #draw() {
    const rows = this.#frames[this.#frame] ?? [];
    const { width, height } = this.#canvas;
    if (!width || !height) return;
    const image = new ImageData(width, height);
    rows.forEach((row, y) =>
      row.forEach((char, x) => {
        const color = this.#key[char] ?? this.#key[char.toLowerCase()];
        if (color) image.data.set(color, (y * width + x) * 4);
      }),
    );
    this.#canvas.getContext("2d").putImageData(image, 0, 0);
    this.dispatchEvent(new Event("framechange", { bubbles: true }));
  }

  #start({ force = false } = {}) {
    this.#stop();
    const fps = Number(this.getAttribute("fps"));
    if (!this.isConnected || this.paused || !(fps > 0) || this.#frames.length < 2) return;
    if (reducedMotion() && !force) return; // still, unless asked to play
    const period = 1000 / fps;
    this.#last = 0;
    const tick = (now) => {
      this.#last ||= now;
      if (now - this.#last >= period - 8) {
        // Skip the backlog after a hidden tab rather than racing through it.
        this.#last = now - ((now - this.#last) % period);
        this.frame = this.#frame + 1;
      }
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }

  #stop() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  // Like an <img>: `alt` names it; an empty alt is decorative.
  #label() {
    const alt = this.getAttribute("alt");
    if (this.hasAttribute("aria-label") && this.getAttribute("aria-label") !== this.#generatedLabel) return;
    if (alt === null || alt === "") {
      if (this.#generatedLabel !== null) this.removeAttribute("aria-label");
      this.#generatedLabel = null;
      if (this.getAttribute("role") !== "presentation" && !this.hasAttribute("aria-label")) this.setAttribute("role", "presentation");
      return;
    }
    this.#generatedLabel = alt;
    if (this.getAttribute("aria-label") !== alt) this.setAttribute("aria-label", alt);
    if (this.getAttribute("role") !== "img") this.setAttribute("role", "img");
  }
  #generatedLabel = null;
}
