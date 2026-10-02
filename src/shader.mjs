// GPU pixel effects: run an ImageData through a GLSL fragment shader, on a
// WebGL2 canvas shared by every shader on the page, and read the result
// back, so shaders chain with every other effect.
//
// Shaders get, without declaring them:
//   uniform sampler2D u_image;   the image so far
//   uniform vec2 u_resolution;   its size in pixels
//   uniform float u_time;        seconds on the <pixel-canvas> clock
//   uniform float u_frame;       its redraw count
//   in vec2 v_uv;                this pixel, 0–1, with 0,0 at the top left
//   out vec4 color;              what to write
// and any other `u_name` they use is declared as a float, set from the
// effect's `name` parameter (or attribute). Without a main(), the code is
// the body of one, with `vec4 pixel` already read from the image.
import { definePixelEffect, number } from "./effects.mjs";

const BUILT_IN = ["u_image", "u_resolution", "u_time", "u_frame"];
const VERTEX = `#version 300 es
in vec2 position;
out vec2 v_uv;
void main() {
  v_uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

let gl = null;
let triangle = null;
const programs = new Map(); // full source -> { program, uniforms } or Error

function context() {
  if (gl) return gl;
  const canvas = new OffscreenCanvas(1, 1);
  gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error("WebGL2 isn't available, so shader effects can't run");
  triangle = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  return gl;
}

/**
 * The `u_name` uniforms a shader uses beyond the built-in ones, as
 * parameter names (`u_line_width` -> `line-width`).
 * @param {string} source
 * @returns {string[]}
 */
export function shaderParams(source) {
  const names = new Set();
  for (const [, name] of (source ?? "").matchAll(/\bu_([A-Za-z0-9_]+)\b/g)) {
    if (!BUILT_IN.includes(`u_${name}`)) names.add(name);
  }
  return [...names].map((name) => name.replace(/_/g, "-"));
}

// The author's code -> a complete fragment shader.
function complete(source) {
  if (/^\s*#version/.test(source)) return source;
  const declared = (name) => new RegExp(`uniform\\s+\\w+\\s+u_${name}\\b`).test(source);
  const extras = shaderParams(source)
    .map((param) => param.replace(/-/g, "_"))
    .filter((name) => !declared(name))
    .map((name) => `uniform float u_${name};`);
  const body = /\bmain\s*\(/.test(source) ? source : `void main() {\n  vec4 pixel = texture(u_image, v_uv);\n  color = pixel;\n${source}\n}`;
  return [
    "#version 300 es",
    "precision highp float;",
    ...BUILT_IN.filter((name) => !declared(name.slice(2))).map((name) =>
      name === "u_image" ? "uniform sampler2D u_image;" : name === "u_resolution" ? "uniform vec2 u_resolution;" : `uniform float ${name};`,
    ),
    ...extras,
    "in vec2 v_uv;",
    "out vec4 color;",
    body,
  ].join("\n");
}

function compile(fragment) {
  const cached = programs.get(fragment);
  if (cached) {
    if (cached instanceof Error) throw cached;
    return cached;
  }
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
    const result = { program, uniforms: new Map() };
    programs.set(fragment, result);
    return result;
  } catch (error) {
    programs.set(fragment, error);
    throw error;
  }
}

/**
 * Run `image` through the shader `source`, with `params` for its uniforms.
 * Throws if WebGL2 isn't available or the shader doesn't compile.
 * @param {ImageData} image
 * @param {string} source
 * @param {Record<string, string>} [params]
 * @param {{ time?: number, frame?: number }} [clock]
 * @returns {ImageData}
 */
export function runShader(image, source, params = {}, { time = 0, frame = 0 } = {}) {
  context();
  const { program, uniforms } = compile(complete(source));
  const { width, height } = image;
  const canvas = gl.canvas;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.useProgram(program);
  const location = (name) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
    return uniforms.get(name);
  };

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
  for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) {
    gl.texParameteri(gl.TEXTURE_2D, key, value);
  }

  gl.uniform1i(location("u_image"), 0);
  gl.uniform2f(location("u_resolution"), width, height);
  gl.uniform1f(location("u_time"), time);
  gl.uniform1f(location("u_frame"), frame);
  for (const param of shaderParams(source)) {
    gl.uniform1f(location(`u_${param.replace(/-/g, "_")}`), number(params[param] ?? params[param.replace(/-/g, "_")], 0));
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const result = new ImageData(width, height);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, result.data);
  gl.deleteTexture(texture);
  return result;
}

/**
 * Register a shader as an effect: usable as `name(…)` in an `effects`
 * attribute and as a `<pixel-name>` element, with its `u_` uniforms as
 * parameters (in the order given, or the order they appear).
 * @param {string} name
 * @param {string} source GLSL (see the top of shader.mjs for what's provided)
 * @param {{ params?: string[] }} [options]
 */
export function definePixelShader(name, source, { params } = {}) {
  return definePixelEffect(name, (image, values, clock) => runShader(image, source, values, clock), {
    params: params ?? shaderParams(source),
  });
}
