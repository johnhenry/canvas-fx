// Pixel effects, and the one registry both ways of using them share.
//
// An effect is a named function from an ImageData to an ImageData, with
// named parameters. Each can be used two ways:
//
//   as a function in <pixel-canvas effects="…">, like CSS `filter`:
//     effects="mosaic(4) palette(gameboy, ordered) adjust(contrast 1.3)"
//
//   as an element wrapped around the source, like SVG filter primitives:
//     <pixel-mosaic size="4"><img …></pixel-mosaic>
//
// definePixelEffect() registers a new effect for both. Any element with an
// `apply(image)` method also works as an effect element; PixelEffect is a
// base class for those.

const registry = new Map(); // name -> { name, params, apply }

/**
 * Fires "define" (with the effect's `name` in `detail`) when an effect is
 * registered, so a <pixel-canvas> waiting on it can redraw.
 */
export const effectRegistry = new EventTarget();

/**
 * @typedef {Record<string, string> & { args: string[] }} EffectParams
 *   Parameter values as written (strings), by name. `args` holds
 *   positional values beyond the declared parameters.
 * @typedef {{ time: number, frame: number }} EffectContext
 *   When the effect is running: `time` is seconds on the <pixel-canvas>
 *   clock (which stops while it's paused), `frame` counts its redraws.
 *   Effects that change over time use these; most ignore them.
 * @typedef {{ name: string, params: string[], apply: (image: ImageData, params: EffectParams, context: EffectContext) => ImageData | void }} Effect
 */

/**
 * Register an effect under `name`: usable as `name(…)` in an `effects`
 * attribute and as a `<pixel-name>` element (unless that tag is taken).
 * `params` lists the parameter names, in the order positional values fill
 * them. `apply` gets the ImageData and the parameter values (strings), and
 * returns an ImageData (or changes the one it got). A third argument,
 * `{ time, frame }`, is there for effects that change over time.
 * @param {string} name
 * @param {(image: ImageData, params: EffectParams, context: EffectContext) => ImageData | void} apply
 * @param {{ params?: string[], element?: boolean }} [options]
 * @returns {Effect}
 */
export function definePixelEffect(name, apply, { params = [], element = true } = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new SyntaxError(`"${name}" isn't a valid effect name (lowercase, digits, hyphens)`);
  const effect = { name, params, apply };
  registry.set(name, effect);
  const tag = `pixel-${name}`;
  if (element && globalThis.customElements && !customElements.get(tag)) {
    customElements.define(tag, class extends PixelEffect {
      static effect = effect;
    });
  }
  effectRegistry.dispatchEvent(new CustomEvent("define", { detail: name }));
  return effect;
}

/**
 * The registered effect called `name`, if any.
 * @param {string} name
 * @returns {Effect | undefined}
 */
export const getPixelEffect = (name) => registry.get(name);

/**
 * Parse an `effects` attribute into calls, in order:
 * `"mosaic(4) palette(gameboy, ordered)"` ->
 * `[{ name: "mosaic", args: ["4"] }, { name: "palette", args: ["gameboy", "ordered"] }]`.
 * Parentheses are optional for an effect with no arguments (`outline`).
 * @param {string} text
 * @returns {{ name: string, args: string[] }[]}
 */
export function parseEffects(text) {
  const calls = [];
  let i = 0;
  const source = text ?? "";
  while (i < source.length) {
    const match = /^\s*([a-z][a-z0-9-]*)\s*/i.exec(source.slice(i));
    if (!match) {
      i++; // skip anything unexpected
      continue;
    }
    i += match[0].length;
    const call = { name: match[1].toLowerCase(), args: [] };
    if (source[i] === "(") {
      let depth = 0;
      let current = "";
      for (i++; i < source.length; i++) {
        const c = source[i];
        if (c === "(") depth++;
        if (c === ")" && depth-- === 0) {
          i++;
          break;
        }
        if (c === "," && depth === 0) {
          call.args.push(current.trim());
          current = "";
        } else current += c;
      }
      if (current.trim() || call.args.length) call.args.push(current.trim());
    }
    calls.push(call);
  }
  return calls;
}

/**
 * Turn a call's arguments into named parameters. An argument whose first
 * word is a parameter name is named (`contrast 1.3`); the rest fill the
 * unnamed parameters in order (`palette(gameboy, ordered)`).
 * @param {Effect} effect
 * @param {string[]} args
 * @returns {EffectParams}
 */
export function resolveParams(effect, args) {
  const params = { args: [] };
  const unnamed = [...effect.params];
  for (const arg of args) {
    const named = /^([a-z][a-z0-9-]*)\s+(.+)$/i.exec(arg);
    if (named && effect.params.includes(named[1].toLowerCase())) {
      params[named[1].toLowerCase()] = named[2].trim();
      unnamed.splice(unnamed.indexOf(named[1].toLowerCase()), 1);
    } else if (unnamed.length) {
      params[unnamed.shift()] = arg;
    } else {
      params.args.push(arg);
    }
  }
  return params;
}

/**
 * Base class for effect elements. With a static `effect` (as
 * definePixelEffect makes), it applies that effect with its attributes as
 * the parameters; otherwise override `apply()`.
 */
export class PixelEffect extends HTMLElement {
  /** @type {Effect | undefined} */
  static effect;

  /**
   * The effect's parameters, read from this element's attributes.
   * @type {EffectParams}
   */
  get params() {
    const params = { args: [] };
    for (const name of this.getAttributeNames()) params[name] = this.getAttribute(name);
    return params;
  }

  /**
   * Transform the image (by default, with this element's effect).
   * @param {ImageData} image
   * @param {EffectContext} [context]
   * @returns {ImageData}
   */
  apply(image, context = { time: 0, frame: 0 }) {
    const effect = /** @type {typeof PixelEffect} */ (this.constructor).effect;
    return (effect && effect.apply(image, this.params, context)) || image;
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

// --- helpers for writing effects -------------------------------------------

/**
 * A parameter as a number, clamped, or `fallback` if it isn't one.
 * @param {string | undefined | null} value
 * @param {number} fallback
 * @param {{ min?: number, max?: number }} [range]
 * @returns {number}
 */
export function number(value, fallback, { min = -Infinity, max = Infinity } = {}) {
  const parsed = value === undefined || value === null || String(value).trim() === "" ? NaN : Number(String(value).replace(/deg$|%$/, ""));
  const result = Number.isFinite(parsed) ? (String(value).trim().endsWith("%") ? parsed / 100 : parsed) : fallback;
  return Math.min(max, Math.max(min, result));
}

// Resolve any CSS color ("teal", "#0f380f", "rgb(…)", "oklch(…)") to
// [r, g, b, a] (0–255), with the browser's own parser.
let probe;
/**
 * @param {string | undefined | null} color
 * @returns {[number, number, number, number] | null} null if it isn't a color
 */
export function parseColor(color) {
  if (!color || !CSS.supports("color", color)) return null;
  probe ??= new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  return /** @type {[number, number, number, number]} */ ([...probe.getImageData(0, 0, 1, 1).data]);
}

/**
 * A repeatable random-number generator: the same seed gives the same
 * sequence (mulberry32). For effects that should look random but not
 * flicker between redraws of the same frame.
 * @param {number} seed
 * @returns {() => number} numbers in [0, 1)
 */
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Perceived brightness of an RGB color, 0–255.
 * @param {number} r @param {number} g @param {number} b
 * @returns {number}
 */
export const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
