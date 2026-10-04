// The GPU path, pointer effects, transitions, chaining, and recording.
import { test, expect } from "@playwright/test";
import { mount } from "./helpers.mjs";

const MODULES = ["src/global.mjs"];

// A busy test image: gradients, a disc, stripes, and a transparent corner.
const SCENE = `
  window.scene = (canvas, width = 64, height = 48) => {
    canvas.width = width;
    canvas.height = height;
    const c = canvas.getContext("2d");
    const g = c.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#ff3366");
    g.addColorStop(0.5, "#33ccff");
    g.addColorStop(1, "#ffee55");
    c.fillStyle = g;
    c.fillRect(0, 0, width, height);
    c.fillStyle = "#00ff00";
    c.beginPath();
    c.arc(width * 0.6, height * 0.5, height * 0.3, 0, Math.PI * 2);
    c.fill();
    for (let x = 0; x < width; x += 6) {
      c.fillStyle = x % 12 ? "#111" : "#eee";
      c.fillRect(x, height - 8, 3, 8);
    }
    c.clearRect(0, 0, 8, 8);
  };
`;

// Draw `effects` (or markup inside) with and without `gpu`, and compare.
const both = (page, effects, { inner = "", pointer = null } = {}) =>
  page.evaluate(
    async ({ effects, inner, pointer }) => {
      const make = async (gpu) => {
        const host = document.createElement("pixel-canvas");
        if (gpu) host.setAttribute("gpu", "");
        host.setAttribute("effects", effects);
        host.style.width = "256px";
        const source = document.createElement("canvas");
        window.scene(source);
        if (inner) {
          host.innerHTML = inner;
          host.querySelector("[data-slot]").append(source);
        } else host.append(source);
        document.body.append(host);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (pointer) {
          const box = host.canvas.getBoundingClientRect();
          const at = { clientX: box.left + (pointer.x / host.canvas.width) * box.width, clientY: box.top + (pointer.y / host.canvas.height) * box.height };
          host.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, ...at }));
        }
        host.render();
        const { width, height } = host.canvas;
        const data = host.canvas.getContext("2d").getImageData(0, 0, width, height).data;
        const result = { renderer: host.renderer, width, height, data: [...data] };
        host.remove();
        return result;
      };
      const cpu = await make(false);
      const gpu = await make(true);
      let worst = 0;
      let off = 0;
      for (let i = 0; i < cpu.data.length; i++) {
        const d = Math.abs(cpu.data[i] - gpu.data[i]);
        worst = Math.max(worst, d);
        if (d > 3) off++;
      }
      return { cpu: cpu.renderer, gpu: gpu.renderer, size: [gpu.width, gpu.height], worst, offFraction: off / cpu.data.length };
    },
    { effects, inner, pointer },
  );

test.describe("the GPU path", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, "", MODULES);
    await page.evaluate(SCENE);
    const available = await page.evaluate(async () => (await import("/src/gpu.mjs")).gpuAvailable());
    test.skip(!available, "no WebGL2 in this browser");
  });

  // Each GPU effect against its CPU original. Thresholds and edges (outline,
  // halftone dots) may flip a few pixels on float rounding; everything else
  // matches to within rounding.
  for (const [effects, allowed] of [
    ["mosaic(4)", 0],
    ["grid(8, rgb(0 0 0 / 0.5), 2)", 0],
    ["grid(8, transparent, 3)", 0],
    ["adjust(brightness 1.2, contrast 1.4, saturation 0.5, hue 90)", 0],
    ["crt()", 0],
    // Its soft edge has fractional alpha, which the 2D canvas stores
    // premultiplied: float versus 8-bit rounding nudges a few edge pixels.
    ["chroma-key(lime, 0.3, 0.1)", 0.002],
    ["wave(3, 16, 0)", 0],
    ["outline(0.2)", 0.01],
    ["outline(0.15, red, none)", 0.01],
    ["halftone(6, 45)", 0.02],
    ["halftone(5, 30, auto)", 0.02],
    ["palette(gameboy)", 0.005],
    ["palette(pico-8, ordered)", 0.005],
    ["adjust(contrast 1.3) mosaic(3) palette(gameboy, ordered) grid(3, transparent)", 0.005],
  ]) {
    test(`${effects}: the GPU draws what the CPU draws`, async ({ page }) => {
      const result = await both(page, effects);
      expect([result.cpu, result.gpu]).toEqual(["cpu", "gpu"]);
      expect(result.offFraction, `worst channel difference ${result.worst}`).toBeLessThanOrEqual(allowed);
    });
  }

  test("effect elements and <pixel-shader> run on the GPU too", async ({ page }) => {
    const elements = await both(page, "", { inner: `<pixel-palette colors="gameboy"><pixel-mosaic size="3"><span data-slot></span></pixel-mosaic></pixel-palette>` });
    expect([elements.cpu, elements.gpu]).toEqual(["cpu", "gpu"]);
    expect(elements.offFraction).toBeLessThanOrEqual(0.005);
    const shader = await both(page, "", {
      inner: `<pixel-shader amount="0.5"><script type="x-shader/x-fragment">color = vec4(pixel.rgb * u_amount, pixel.a);</script><span data-slot></span></pixel-shader>`,
    });
    expect(shader.gpu).toBe("gpu");
    expect(shader.offFraction).toBe(0);
  });

  test("a chain with a CPU-only step runs on the CPU, and says so", async ({ page }) => {
    for (const effects of ["glitch(0.5)", "palette(auto)", "palette(gameboy, floyd-steinberg)", "mosaic(80)"]) {
      expect((await both(page, effects)).gpu, effects).toBe("cpu");
    }
  });

  test("swatches come from the GPU's result", async ({ page }) => {
    const swatches = await page.evaluate(async () => {
      const run = async (gpu) => {
        const host = document.createElement("pixel-canvas");
        host.toggleAttribute("gpu", gpu);
        host.setAttribute("effects", "palette(gameboy)");
        host.setAttribute("swatches", "3");
        const source = document.createElement("canvas");
        window.scene(source);
        host.append(source);
        document.body.append(host);
        host.render();
        const result = host.palette.toSorted();
        host.remove();
        return result;
      };
      return [await run(false), await run(true)];
    });
    expect(swatches[1]).toEqual(swatches[0]);
  });
});

test.describe("pointer effects", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, "", MODULES);
    await page.evaluate(SCENE);
  });

  const setup = (page, effects, gpu = false) =>
    page.evaluate(
      async ({ effects, gpu }) => {
        const host = document.createElement("pixel-canvas");
        host.id = "p";
        host.toggleAttribute("gpu", gpu);
        host.setAttribute("effects", effects);
        host.style.width = "256px";
        const source = document.createElement("canvas");
        window.scene(source);
        host.append(source);
        document.body.append(host);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        window.at = (x, y) => [...host.canvas.getContext("2d").getImageData(x, y, 1, 1).data];
        return host.renderer;
      },
      { effects, gpu },
    );
  // Move the real mouse to working pixel (x, y).
  const moveTo = async (page, x, y) => {
    const box = await page.locator("#p").boundingBox();
    await page.mouse.move(box.x + ((x + 0.5) / 64) * box.width, box.y + ((y + 0.5) / 48) * box.height);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  };

  for (const gpu of [false, true]) {
    test(`spotlight follows the pointer, and lets go when it leaves${gpu ? " (GPU)" : ""}`, async ({ page }) => {
      await setup(page, "spotlight(8, 4, 0.8)", gpu);
      const plain = await page.evaluate(() => [window.at(10, 24), window.at(54, 24)]);
      await moveTo(page, 10, 24);
      const lit = await page.evaluate(() => [window.at(10, 24), window.at(54, 24)]);
      expect(lit[0]).toEqual(plain[0]); // under the light: unchanged
      expect(lit[1][0] + lit[1][1] + lit[1][2]).toBeLessThan((plain[1][0] + plain[1][1] + plain[1][2]) * 0.35); // far away: dimmed
      await page.mouse.move(600, 600); // off the canvas
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      expect(await page.evaluate(() => window.at(54, 24))).toEqual(plain[1]);
    });

    test(`lens magnifies around the pointer${gpu ? " (GPU)" : ""}`, async ({ page }) => {
      await setup(page, "lens(10, 4)", gpu);
      // Across the stripes at the bottom, count how often the color changes
      // along a row: magnified 4×, a quarter as often.
      const changes = () =>
        page.evaluate(() => {
          const row = Array.from({ length: 17 }, (_, i) => window.at(23 + i, 44).join());
          return row.filter((color, i) => i && color !== row[i - 1]).length;
        });
      const plain = await changes();
      await moveTo(page, 31, 44);
      const lensed = await changes();
      expect(plain).toBeGreaterThanOrEqual(6);
      expect(lensed).toBeLessThanOrEqual(Math.ceil(plain / 2));
    });
  }
});

test.describe("transitions", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, "", MODULES);
    await page.evaluate(SCENE);
    await page.evaluate(async () => {
      const { definePixelEffect } = await import("/src/effects.mjs");
      window.seen = [];
      definePixelEffect("probe", (image, p) => (window.seen.push(Number(p.level)), image), { params: ["level"] });
    });
  });

  test("numbers in the same effects are interpolated over the transition", async ({ page }) => {
    const seen = await page.evaluate(async () => {
      const host = document.createElement("pixel-canvas");
      host.setAttribute("effects", "probe(0)");
      host.setAttribute("transition", "300ms");
      const source = document.createElement("canvas");
      window.scene(source);
      host.append(source);
      document.body.append(host);
      host.render();
      window.seen = [];
      host.setAttribute("effects", "probe(100)");
      await new Promise((r) => setTimeout(r, 500));
      return window.seen;
    });
    const between = seen.filter((v) => v > 0 && v < 100);
    expect(between.length).toBeGreaterThan(3);
    expect(between).toEqual([...between].sort((a, b) => a - b)); // only ever forward
    expect(seen.at(-1)).toBe(100);
  });

  test("a different list of effects cross-fades", async ({ page }) => {
    const levels = await page.evaluate(async () => {
      const host = document.createElement("pixel-canvas");
      host.setAttribute("effects", "adjust(brightness 1)");
      host.setAttribute("transition", "400ms");
      const source = document.createElement("canvas");
      source.width = source.height = 4;
      const c = source.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, 4, 4);
      host.append(source);
      document.body.append(host);
      host.render();
      host.setAttribute("effects", "palette(#000000 #010101)");
      const levels = [];
      const start = performance.now();
      while (performance.now() - start < 600) {
        await new Promise((r) => requestAnimationFrame(r));
        levels.push(host.canvas.getContext("2d").getImageData(1, 1, 1, 1).data[0]);
      }
      return levels;
    });
    expect(levels.some((v) => v > 20 && v < 235)).toBe(true); // part way
    expect(levels.at(-1)).toBeLessThan(5); // ends at the new look
  });

  test("no transition for visitors who prefer reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const seen = await page.evaluate(async () => {
      const host = document.createElement("pixel-canvas");
      host.setAttribute("effects", "probe(0)");
      host.setAttribute("transition", "300ms");
      const source = document.createElement("canvas");
      window.scene(source);
      host.append(source);
      document.body.append(host);
      host.render();
      window.seen = [];
      host.setAttribute("effects", "probe(100)");
      await new Promise((r) => setTimeout(r, 200));
      return window.seen;
    });
    expect(seen.every((v) => v === 100)).toBe(true);
  });
});

test.describe("chaining and recording", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, "", MODULES);
    await page.evaluate(SCENE);
  });

  test("a <pixel-canvas> is another's source, and the outer one follows the inner one", async ({ page }) => {
    const result = await page.evaluate(async () => {
      document.body.innerHTML = `<pixel-canvas id="outer" effects="palette(1bit)"><pixel-canvas id="inner" effects="mosaic(4)"><canvas id="src"></canvas></pixel-canvas></pixel-canvas>`;
      window.scene(document.getElementById("src"));
      const [outer, inner] = [document.getElementById("outer"), document.getElementById("inner")];
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const read = (el) => [...el.canvas.getContext("2d").getImageData(0, 0, el.canvas.width, el.canvas.height).data];
      const first = read(outer);
      let changes = 0;
      outer.addEventListener("framechange", () => changes++);
      inner.setAttribute("effects", "mosaic(8)");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
      const second = read(outer);
      // Every 1-bit pixel in an 8-block of the outer result is the same.
      const w = outer.canvas.width;
      let blocky = true;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (second[(y * w + x) * 4] !== second[(Math.floor(y / 8) * 8 * w + Math.floor(x / 8) * 8) * 4]) blocky = false;
      return { source: outer.source === inner, changed: first.join() !== second.join(), changes, blocky, onlyBlackWhite: second.every((v, i) => i % 4 === 3 || v === 0 || v === 255) };
    });
    expect(result).toEqual({ source: true, changed: true, changes: 1, blocky: true, onlyBlackWhite: true });
  });

  test("toGIF() makes an animated GIF of the result, at the working size", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const host = document.createElement("pixel-canvas");
      host.setAttribute("effects", "palette(gameboy) glitch(0.6, 30)");
      host.setAttribute("fps", "30");
      const source = document.createElement("canvas");
      window.scene(source);
      host.append(source);
      document.body.append(host);
      host.play();
      const blob = await host.toGIF({ frames: 4, fps: 20 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const bitmap = await createImageBitmap(blob);
      // The first frame, decoded by the browser, uses only Game Boy colors.
      const check = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d");
      check.drawImage(bitmap, 0, 0);
      const pixels = check.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const gameboy = new Set(["15,56,15", "48,98,48", "139,172,15", "155,188,15"]);
      let foreign = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 0 && !gameboy.has(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)) foreign++;
      // Frames: count image descriptors (0x2C after a graphic control block).
      let frames = 0;
      for (let i = 0; i < bytes.length - 8; i++) if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9) frames++;
      return { type: blob.type, magic: String.fromCharCode(...bytes.slice(0, 6)), size: [bitmap.width, bitmap.height], working: [host.canvas.width, host.canvas.height], foreign, frames };
    });
    expect(result.type).toBe("image/gif");
    expect(result.magic).toBe("GIF89a");
    expect(result.size).toEqual(result.working);
    expect(result.foreign).toBe(0);
    expect(result.frames).toBe(4);
  });

  test("toGIF() handles images with more than 255 colors", async ({ page }) => {
    const ok = await page.evaluate(async () => {
      const host = document.createElement("pixel-canvas");
      const source = document.createElement("canvas");
      window.scene(source, 96, 64); // gradients: many colors
      host.append(source);
      document.body.append(host);
      const blob = await host.toGIF({ frames: 1 });
      const bitmap = await createImageBitmap(blob);
      return [bitmap.width, bitmap.height];
    });
    expect(ok).toEqual([96, 64]);
  });

  test("record() makes a video, and captureStream() is the canvas's stream", async ({ page }) => {
    const supported = await page.evaluate(() => typeof MediaRecorder !== "undefined" && ["video/webm", "video/mp4"].some((t) => MediaRecorder.isTypeSupported(t)));
    test.skip(!supported, "no MediaRecorder video type here");
    const result = await page.evaluate(async () => {
      const host = document.createElement("pixel-canvas");
      host.setAttribute("effects", "wave(3, 12, 2)");
      host.setAttribute("fps", "30");
      const source = document.createElement("canvas");
      window.scene(source);
      host.append(source);
      document.body.append(host);
      host.play();
      const stream = host.captureStream(30);
      const blob = await host.record({ duration: 0.6 });
      return { tracks: stream.getVideoTracks().length, type: blob.type, size: blob.size };
    });
    expect(result.tracks).toBe(1);
    expect(result.type).toMatch(/^video\//);
    expect(result.size).toBeGreaterThan(100);
  });
});
