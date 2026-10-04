// glyphs(): the image as text characters, on the CPU and the GPU, and
// <pixel-canvas>.toText().
import { test, expect } from "@playwright/test";
import { mount } from "./helpers.mjs";

const MODULES = ["src/global.mjs"];

const SCENE = `
  window.scene = (canvas, width = 96, height = 72) => {
    canvas.width = width;
    canvas.height = height;
    const c = canvas.getContext("2d");
    const g = c.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#000");
    g.addColorStop(0.5, "#ff8800");
    g.addColorStop(1, "#ffffff");
    c.fillStyle = g;
    c.fillRect(0, 0, width, height);
    c.strokeStyle = "#00ffff";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, height);
    c.lineTo(width, 0);
    c.stroke();
    c.clearRect(0, 0, 10, 10);
  };
  // Characters drawn the way the atlas draws them: white, centered, one per
  // cell, on black.
  window.writeText = (canvas, lines, cellWidth, cellHeight, family = "monospace") => {
    const columns = Math.max(...lines.map((l) => l.length));
    canvas.width = columns * cellWidth;
    canvas.height = lines.length * cellHeight;
    const c = canvas.getContext("2d");
    c.fillStyle = "#000";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.font = "100px " + family;
    const chars = [...new Set(lines.join(""))];
    const widest = Math.max(...chars.map((ch) => c.measureText(ch).width), 1) / 100;
    c.font = Math.max(1, Math.min(cellHeight * 0.95, cellWidth / widest)) + "px " + family;
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    lines.forEach((line, row) => [...line].forEach((ch, col) => c.fillText(ch, col * cellWidth + cellWidth / 2, row * cellHeight + cellHeight / 2)));
  };
`;

test.beforeEach(async ({ page }) => {
  await mount(page, "", MODULES);
  await page.evaluate(SCENE);
});

// Draw with and without gpu, and compare.
const both = (page, effects) =>
  page.evaluate(async (effects) => {
    const make = async (gpu) => {
      const host = document.createElement("pixel-canvas");
      host.toggleAttribute("gpu", gpu);
      host.setAttribute("effects", effects);
      const source = document.createElement("canvas");
      window.scene(source);
      host.append(source);
      document.body.append(host);
      host.render();
      const { width, height } = host.canvas;
      const data = [...host.canvas.getContext("2d").getImageData(0, 0, width, height).data];
      const renderer = host.renderer;
      host.remove();
      return { renderer, data };
    };
    const cpu = await make(false);
    const gpu = await make(true);
    let off = 0;
    for (let i = 0; i < cpu.data.length; i++) if (Math.abs(cpu.data[i] - gpu.data[i]) > 3) off++;
    return { renderers: [cpu.renderer, gpu.renderer], offFraction: off / cpu.data.length };
  }, effects);

test.describe("on the GPU, the same as on the CPU", () => {
  test.beforeEach(async ({ page }) => {
    const available = await page.evaluate(async () => (await import("/src/gpu.mjs")).gpuAvailable());
    test.skip(!available, "no WebGL2 in this browser");
  });
  // Near-ties between two characters can fall either way in float32 versus
  // float64, so a cell or two may differ.
  for (const effects of [
    "glyphs()",
    "glyphs(6x10, ramp, monospace, brightness, #33ff66, black)",
    "glyphs(8x12, ascii, monospace, shape)",
    "glyphs(8x12, blocks, monospace, brightness, source, white)",
    "glyphs(4)",
    "palette(gameboy) glyphs(8x12, ' .oO@', monospace, brightness, source, #0f380f) crt()",
  ]) {
    test(effects, async ({ page }) => {
      const result = await both(page, effects);
      expect(result.renderers).toEqual(["cpu", "gpu"]);
      expect(result.offFraction).toBeLessThan(0.02);
    });
  }
});

test("toText() reads back characters drawn in the same font, in shape mode", async ({ page }) => {
  const lines = ["/\\|-_", "=+:#O", "xX.,'"];
  const text = await page.evaluate(async (lines) => {
    const host = document.createElement("pixel-canvas");
    const source = document.createElement("canvas");
    window.writeText(source, lines, 16, 24);
    host.append(source);
    document.body.append(host);
    return host.toText({ cell: "16x24", chars: lines.join(""), mode: "shape" });
  }, lines);
  expect(text.split("\n")).toEqual(lines.map((l) => l.trimEnd()));
});

test("toText() gives the characters glyphs() drew, and they're what's on screen", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const host = document.createElement("pixel-canvas");
    host.setAttribute("effects", "glyphs(8x12, ' #', monospace, brightness, white, black)");
    const source = document.createElement("canvas");
    source.width = 32;
    source.height = 24;
    const c = source.getContext("2d");
    c.fillStyle = "#000";
    c.fillRect(0, 0, 32, 24);
    c.fillStyle = "#fff";
    c.fillRect(8, 0, 8, 12); // row 0, column 1
    c.fillRect(24, 12, 8, 12); // row 1, column 3
    host.append(source);
    document.body.append(host);
    const text = await host.toText();
    // The cell with "#" has white ink; the one with " " is all background.
    const ink = (x, y) => {
      const d = host.canvas.getContext("2d").getImageData(x, y, 8, 12).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 128) lit++;
      return lit;
    };
    return { text, hashInk: ink(8, 0), spaceInk: ink(0, 0) };
  });
  expect(result.text).toBe(" #\n   #");
  expect(result.hashInk).toBeGreaterThan(5);
  expect(result.spaceInk).toBe(0);
});

test("toText() without glyphs() converts the result; brightness picks denser characters for brighter cells", async ({ page }) => {
  const text = await page.evaluate(async () => {
    const host = document.createElement("pixel-canvas");
    const source = document.createElement("canvas");
    source.width = 80;
    source.height = 12;
    const c = source.getContext("2d");
    for (let i = 0; i < 10; i++) {
      const v = Math.round((i / 9) * 255);
      c.fillStyle = `rgb(${v}, ${v}, ${v})`;
      c.fillRect(i * 8, 0, 8, 12);
    }
    host.append(source);
    document.body.append(host);
    return host.toText();
  });
  // Measured in the font itself (not the ramp's nominal order, which no
  // font follows exactly): brighter cells never get less ink.
  const coverage = await page.evaluate(async (text) => {
    const { glyphAtlas, SETS } = await import("/src/pixel-glyphs/glyphs.mjs");
    const atlas = glyphAtlas([...SETS.ramp], "monospace", 8, 12);
    return { ink: [...text].map((ch) => atlas.brightness[atlas.chars.indexOf(ch)]), densest: Math.max(...atlas.brightness) };
  }, text.padEnd(10));
  expect(text[0]).toBe(" ");
  expect(coverage.ink).toEqual([...coverage.ink].sort((a, b) => a - b));
  expect(coverage.ink.at(-1)).toBe(coverage.densest);
});

test("on a light background, darkness is inked", async ({ page }) => {
  const text = await page.evaluate(async () => {
    const host = document.createElement("pixel-canvas");
    host.setAttribute("effects", "glyphs(8x12, ' #', monospace, brightness, black, white)");
    const source = document.createElement("canvas");
    source.width = 16;
    source.height = 12;
    const c = source.getContext("2d");
    c.fillStyle = "#000";
    c.fillRect(0, 0, 8, 12);
    c.fillStyle = "#fff";
    c.fillRect(8, 0, 8, 12);
    host.append(source);
    document.body.append(host);
    return host.toText();
  });
  expect(text).toBe("#");
});

test("quoted characters keep spaces and commas; the element form works; gpu comes back after toText()", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { parseEffects, unquote } = await import("/src/effects.mjs");
    const args = parseEffects("glyphs(8, ' ,.', monospace)")[0].args;
    document.body.innerHTML = `<pixel-canvas id="p" gpu><pixel-glyphs cell="8x12" chars="ramp"><canvas id="s"></canvas></pixel-glyphs></pixel-canvas>`;
    window.scene(document.getElementById("s"));
    const host = document.getElementById("p");
    host.render();
    const before = host.renderer;
    const text = await host.toText();
    const during = host.renderer;
    host.render();
    return { chars: unquote(args[1]), before, text: text.split("\n").length, during, after: host.renderer };
  });
  expect(result.chars).toBe(" ,.");
  expect(result.text).toBe(6); // 72 / 12 rows
  expect(result.during).toBe("cpu");
  const gpu = await page.evaluate(async () => (await import("/src/gpu.mjs")).gpuAvailable());
  if (gpu) expect([result.before, result.after]).toEqual(["gpu", "gpu"]);
});
