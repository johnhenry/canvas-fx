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
 * @typedef {{ time: number, frame: number, pointer?: { x: number, y: number, inside: boolean, down: boolean } | null }} EffectContext
 *   When the effect is running: `time` is seconds on the <pixel-canvas>
 *   clock (which stops while it's paused), `frame` counts its redraws, and
 *   `pointer` is where the pointer is, in the image's pixels (0,0 at the
 *   top left; null before it's been over the canvas). Effects that change
 *   over time or follow the pointer use these; most ignore them.
 * @typedef {{
 *   fragment: string,
 *   uniforms?: (params: EffectParams, size: { width: number, height: number }, context: EffectContext) => Record<string, unknown>,
 *   supports?: (params: EffectParams) => boolean,
 * }} GpuEffect
 *   The same effect as a GLSL fragment shader, for <pixel-canvas gpu> (see
 *   gpu.mjs). `supports` says when it can't (some parameters need the CPU).
 * @typedef {{ name: string, params: string[], apply: (image: ImageData, params: EffectParams, context: EffectContext) => ImageData | void, gpu?: GpuEffect, pointer?: boolean }} Effect
 */

/**
 * Register an effect under `name`: usable as `name(…)` in an `effects`
 * attribute and as a `<pixel-name>` element (unless that tag is taken).
 * `params` lists the parameter names, in the order positional values fill
 * them. `apply` gets the ImageData and the parameter values (strings), and
 * returns an ImageData (or changes the one it got). A third argument,
 * `{ time, frame, pointer }`, is there for effects that change over time or
 * follow the pointer. `gpu` is the same effect in GLSL, for `<pixel-canvas
 * gpu>`; `pointer: true` redraws the canvas as the pointer moves.
 * @param {string} name
 * @param {(image: ImageData, params: EffectParams, context: EffectContext) => ImageData | void} apply
 * @param {{ params?: string[], element?: boolean, gpu?: GpuEffect, pointer?: boolean }} [options]
 * @returns {Effect}
 */
export function definePixelEffect(name, apply, { params = [], element = true, gpu, pointer = false } = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new SyntaxError(`"${name}" isn't a valid effect name (lowercase, digits, hyphens)`);
  const effect = { name, params, apply, gpu, pointer };
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
 * An argument in quotes (`'…'` or `"…"`) is taken as written, commas,
 * parentheses, and spaces included; `unquote()` strips the quotes.
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
      let quote = null;
      for (i++; i < source.length; i++) {
        const c = source[i];
        if (quote) {
          current += c;
          if (c === quote) quote = null;
          continue;
        }
        if (c === "'" || c === '"') {
          quote = c;
          current += c;
          continue;
        }
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
   * This effect as a GPU pass (a fragment shader and its uniforms), or null
   * if it can only run on the CPU.
   * @param {{ width: number, height: number }} size
   * @param {EffectContext} context
   * @returns {{ fragment: string, uniforms: Record<string, unknown> } | null}
   */
  gpuPass(size, context) {
    const effect = /** @type {typeof PixelEffect} */ (this.constructor).effect;
    return effect ? gpuPass(effect, this.params, size, context) : null;
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

/**
 * An effect with these parameters as a GPU pass, or null if it has no GPU
 * version or this use of it needs the CPU.
 * @param {Effect} effect
 * @param {EffectParams} params
 * @param {{ width: number, height: number }} size
 * @param {EffectContext} context
 * @returns {{ fragment: string, uniforms: Record<string, unknown> } | null}
 */
export function gpuPass(effect, params, size, context) {
  const gpu = effect.gpu;
  if (!gpu || (gpu.supports && !gpu.supports(params))) return null;
  return { fragment: gpu.fragment, uniforms: gpu.uniforms ? gpu.uniforms(params, size, context) : {} };
}

/**
 * The calls part of the way from one `effects` list to another, for
 * transitions: when both name the same effects in the same order, every
 * number that's in both (with the same unit) is interpolated, and anything
 * else takes the new value. When the effects differ, returns null (the
 * caller cross-fades instead).
 * @param {string} from
 * @param {string} to
 * @param {number} t 0 (from) to 1 (to)
 * @returns {{ name: string, args: string[] }[] | null}
 */
export function interpolateEffects(from, to, t) {
  const a = parseEffects(from);
  const b = parseEffects(to);
  if (a.length !== b.length || a.some((call, i) => call.name !== b[i].name)) return null;
  const NUMBER = /^(-?\d*\.?\d+)([a-z%]*)$/i;
  const mix = (x, y) => {
    const m = NUMBER.exec(x.trim());
    const n = NUMBER.exec(y.trim());
    if (!m || !n || m[2] !== n[2]) return y;
    const value = Number(m[1]) + (Number(n[1]) - Number(m[1])) * t;
    return `${Math.round(value * 1e4) / 1e4}${n[2]}`;
  };
  return b.map((call, i) => ({
    name: call.name,
    args: call.args.map((arg, j) => {
      const old = a[i].args[j];
      if (old === undefined) return arg;
      // A named argument ("contrast 1.3") interpolates its value when the name matches.
      const named = /^([a-z][a-z0-9-]*)\s+(.+)$/i;
      const [on, nn] = [named.exec(old), named.exec(arg)];
      if (on && nn && on[1] === nn[1] && !NUMBER.test(on[1])) return `${nn[1]} ${mix(on[2], nn[2])}`;
      return mix(old, arg);
    }),
  }));
}

/**
 * A parameter without its surrounding quotes, if it has them: `' .:#'` ->
 * ` .:#` (spaces kept). Unquoted values come back trimmed.
 * @param {string | undefined | null} value
 * @returns {string}
 */
export function unquote(value) {
  const text = value ?? "";
  const match = /^\s*(['"])([\s\S]*)\1\s*$/.exec(text);
  return match ? match[2] : text.trim();
}
