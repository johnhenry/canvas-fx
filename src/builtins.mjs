// Registers the built-in effects as functions for <pixel-canvas effects>.
// (Their elements are registered by each module's global.mjs.)
import { definePixelEffect } from "./effects.mjs";
import * as mosaic from "./pixel-mosaic/effect.mjs";
import * as palette from "./pixel-palette/effect.mjs";
import * as grid from "./pixel-grid/effect.mjs";
import * as adjust from "./pixel-adjust/effect.mjs";
import * as halftone from "./pixel-halftone/effect.mjs";
import * as outline from "./pixel-outline/effect.mjs";
import * as crt from "./pixel-crt/effect.mjs";
import * as chromaKey from "./pixel-chroma-key/effect.mjs";

const BUILT_IN = { mosaic, palette, grid, adjust, halftone, outline, crt, "chroma-key": chromaKey };
for (const [name, effect] of Object.entries(BUILT_IN)) {
  definePixelEffect(name, effect.apply, { params: effect.params, element: false });
}
