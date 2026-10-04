// Type-checked (never run) by `npm test`: consumes the generated
// declarations through the package's own export paths, the way a user would.
import PixelCanvas from "@johnhenry/pixelable/pixel-canvas";
import "@johnhenry/pixelable/global.mjs";
import { definePixelEffect } from "@johnhenry/pixelable/effects.mjs";
import { PixelSprite } from "@johnhenry/pixelable";

const canvas = document.querySelector("pixel-canvas");
if (canvas) {
  const effects: string = canvas.effects;
  canvas.effects = `${effects} mosaic(4)`;
  const palette: string[] = canvas.palette;
  const drew: boolean = canvas.render();
  // @ts-expect-error -- source is read-only
  canvas.source = null;
  void palette;
  void drew;
}
definePixelEffect("invert", (image: ImageData) => image);
customElements.define("my-pixel-canvas", PixelCanvas);
const sprite: PixelSprite = new PixelSprite();
void sprite;
