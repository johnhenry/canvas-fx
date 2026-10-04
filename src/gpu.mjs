// The GPU path: a whole chain of effects on one WebGL2 context. The source
// is uploaded once (an image, video, or canvas with texImage2D; live HTML
// with texElementImage2D), scaled to the working size, run through each
// effect's fragment shader (ping-ponging between two textures), and drawn
// to the screen, without reading pixels back to the CPU unless asked to
// (for swatches).
//
// An effect runs here when it has a `gpu` version (see definePixelEffect):
//   { fragment, uniforms?(params, size, context), supports?(params) }
// `fragment` is a complete GLSL ES 3.0 fragment shader; gpuShader() adds the
// standard declarations:
//   uniform sampler2D u_image;   the image so far (0,0 is the top left)
//   uniform vec2 u_resolution;   its size in pixels
//   uniform float u_time;        seconds on the <pixel-canvas> clock
//   uniform float u_frame;       its redraw count
//   uniform vec3 u_pointer;      the pointer in pixels (x, y), and z = 1 when it's over the canvas
//   in vec2 v_uv;                this pixel, 0–1, with 0,0 at the top left
//   out vec4 color;              what to write
// The same conventions as <pixel-shader> (shader.mjs), whose shaders run
// here too.

export const PRELUDE = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_frame;
uniform vec3 u_pointer;
in vec2 v_uv;
out vec4 color;
// This pixel's coordinates (0,0 at the top left), and the color at another.
vec2 pixelAt() { return floor(v_uv * u_resolution); }
vec4 sampleAt(vec2 p) { return texture(u_image, (clamp(p, vec2(0.0), u_resolution - 1.0) + 0.5) / u_resolution); }
`;

/**
 * A complete fragment shader from an effect's declarations and main().
 * @param {string} body
 * @returns {string}
 */
export const gpuShader = (body) => `${PRELUDE}\n${body}`;

const VERTEX = `#version 300 es
in vec2 position;
out vec2 v_uv;
void main() {
  v_uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;
const COPY = gpuShader("void main() { color = texture(u_image, v_uv); }");
// The last pass, to the screen: framebuffer rows run bottom to top.
const PRESENT = gpuShader("void main() { color = texture(u_image, vec2(v_uv.x, 1.0 - v_uv.y)); }");

const pipelines = new WeakMap(); // WebGL2RenderingContext -> Pipeline

/**
 * The pipeline for a WebGL2 context (made on first use).
 * @param {WebGL2RenderingContext} gl
 */
export function pipelineFor(gl) {
  let pipeline = pipelines.get(gl);
  if (!pipeline) pipelines.set(gl, (pipeline = new Pipeline(gl)));
  return pipeline;
}

let shared = null;
/** A WebGL2 context shared by every <pixel-canvas> drawing an ordinary source. */
export function sharedContext() {
  if (shared) return shared;
  const canvas = new OffscreenCanvas(1, 1);
  shared = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if (!shared) throw new Error("WebGL2 isn't available, so effects can't run on the GPU");
  return shared;
}

/** Whether this browser can run the GPU path at all. */
export function gpuAvailable() {
  try {
    sharedContext();
    return true;
  } catch {
    return false;
  }
}

class Pipeline {
  #programs = new Map(); // fragment -> { program, uniforms } | Error
  #triangle;
  #targets = []; // two { texture, framebuffer, width, height }
  #source;

  constructor(gl) {
    this.gl = gl;
    this.#triangle = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#triangle);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.#source = gl.createTexture();
  }

  #program(fragment) {
    const { gl } = this;
    const cached = this.#programs.get(fragment);
    if (cached instanceof Error) throw cached;
    if (cached) return cached;
    const shader = (type, text) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, text);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new SyntaxError(`Shader didn't compile: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    try {
      const program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
      gl.bindAttribLocation(program, 0, "position");
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new SyntaxError(`Shader didn't link: ${gl.getProgramInfoLog(program)}`);
      const result = { program, locations: new Map() };
      this.#programs.set(fragment, result);
      return result;
    } catch (error) {
      this.#programs.set(fragment, error);
      throw error;
    }
  }

  #target(i, width, height) {
    const { gl } = this;
    let target = this.#targets[i];
    if (!target) {
      target = { texture: gl.createTexture(), framebuffer: gl.createFramebuffer(), width: 0, height: 0 };
      this.#targets[i] = target;
    }
    if (target.width !== width || target.height !== height) {
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.#filter(gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
      target.width = width;
      target.height = height;
    }
    return target;
  }

  // A texture an effect brings along (a font atlas, a lookup table):
  // `{ texture: ImageData | canvas, key }`, uploaded once per key.
  #textures = new Map();
  #texture({ texture, key }) {
    const { gl } = this;
    let entry = this.#textures.get(key);
    if (!entry) {
      entry = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, entry);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
      this.#filter(gl.NEAREST);
      this.#textures.set(key, entry);
    }
    return entry;
  }

  #filter(filter) {
    const { gl } = this;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // One full-screen pass: `input` texture -> `framebuffer` (null: the canvas).
  #pass(fragment, input, framebuffer, width, height, uniforms, context) {
    const { gl } = this;
    const { program, locations } = this.#program(fragment);
    const location = (name) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
      return locations.get(name);
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input);
    gl.uniform1i(location("u_image"), 0);
    gl.uniform2f(location("u_resolution"), context.resolution[0], context.resolution[1]);
    gl.uniform1f(location("u_time"), context.time);
    gl.uniform1f(location("u_frame"), context.frame);
    const pointer = context.pointer;
    gl.uniform3f(location("u_pointer"), pointer?.x ?? -1, pointer?.y ?? -1, pointer?.inside ? 1 : 0);
    let unit = 1; // 0 is the image
    for (const [name, value] of Object.entries(uniforms ?? {})) {
      const at = location(name);
      if (at === null) continue;
      if (typeof value === "number") gl.uniform1f(at, value);
      else if (value?.int !== undefined) gl.uniform1i(at, value.int);
      else if (value?.mat3) gl.uniformMatrix3fv(at, false, value.mat3);
      else if (value?.texture) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, this.#texture(value));
        gl.uniform1i(at, unit++);
        gl.activeTexture(gl.TEXTURE0);
      }
      else if (value instanceof Float32Array) gl.uniform3fv(at, value);
      else if (Array.isArray(value)) gl[`uniform${value.length}f`](at, ...value);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#triangle);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Run a chain. `upload(gl)` fills the bound TEXTURE_2D with the source
   * (sourceWidth × sourceHeight); it's scaled to width × height (smoothed
   * when shrinking, crisp when enlarging), run through `steps`, and drawn to
   * the context's canvas at present.width × present.height, scaled crisply.
   * With `read`, the result at the working size is returned as ImageData.
   * @param {{
   *   upload: (gl: WebGL2RenderingContext) => void,
   *   sourceWidth: number, sourceHeight: number, width: number, height: number,
   *   steps: { fragment: string, uniforms?: Record<string, unknown> }[],
   *   present: { width: number, height: number },
   *   context: { time: number, frame: number, pointer?: { x: number, y: number, inside: boolean } | null },
   *   read?: boolean,
   * }} job
   * @returns {ImageData | null}
   */
  run({ upload, sourceWidth, sourceHeight, width, height, steps, present, context, read = false }) {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#source);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    upload(gl);
    this.#filter(width < sourceWidth || height < sourceHeight ? gl.LINEAR : gl.NEAREST);
    const working = { ...context, resolution: [width, height] };
    let input = this.#source;
    let next = 0;
    const run = (fragment, uniforms) => {
      const target = this.#target(next, width, height);
      this.#pass(fragment, input, target.framebuffer, width, height, uniforms, working);
      input = target.texture;
      next = 1 - next;
    };
    run(COPY);
    for (const step of steps) run(step.fragment, step.uniforms);
    let image = null;
    if (read) {
      image = new ImageData(width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.#targets[1 - next].framebuffer);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
    }
    const canvas = gl.canvas;
    if (canvas.width !== present.width) canvas.width = present.width;
    if (canvas.height !== present.height) canvas.height = present.height;
    this.#pass(PRESENT, input, null, present.width, present.height, null, working);
    return image;
  }
}
