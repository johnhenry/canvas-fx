// Type-checked (never run) by `npm test`: consumes the generated
// declarations through the package's own export paths, the way a user would.
import PixelCanvas from "@johnhenry/pixelable/pixel-canvas";
import "@johnhenry/pixelable/global.mjs";
import { definePixelEffect } from "@johnhenry/pixelable/effects.mjs";
import { PixelSprite, PixelLens } from "@johnhenry/pixelable";
import { encodeGIF } from "@johnhenry/pixelable/gif.mjs";
import { gpuShader, gpuAvailable } from "@johnhenry/pixelable/gpu.mjs";
import { interpolateEffects } from "@johnhenry/pixelable/effects.mjs";

const canvas = document.querySelector("pixel-canvas");
if (canvas) {
  const effects: string = canvas.effects;
  canvas.effects = `${effects} mosaic(4)`;
  const palette: string[] = canvas.palette;
  const drew: boolean = canvas.render();
  canvas.gpu = true;
  const renderer: string = canvas.renderer;
  const gif: Promise<Blob> = canvas.toGIF({ frames: 4, fps: 10 });
  const video: Promise<Blob> = canvas.record({ duration: 1 });
  const stream: MediaStream = canvas.captureStream(30);
  void renderer, gif, video, stream;
  // @ts-expect-error -- source is read-only
  canvas.source = null;
  void palette;
  void drew;
}
definePixelEffect("invert", (image: ImageData) => image);
customElements.define("my-pixel-canvas", PixelCanvas);
const sprite: PixelSprite = new PixelSprite();
void sprite;
const bytes: Uint8Array = encodeGIF([new ImageData(1, 1)], { delay: 100 });
const shader: string = gpuShader("void main() { color = vec4(1.0); }");
const available: boolean = gpuAvailable();
const between = interpolateEffects("mosaic(2)", "mosaic(8)", 0.5);
const lens: PixelLens = new PixelLens();
void bytes, shader, available, between, lens;
