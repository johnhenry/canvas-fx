import { test, expect } from "@playwright/test";
import { mount } from "./helpers.mjs";

const MODULES = ["src/pixelable/global.mjs"];

// Paint a canvas from rows of CSS colors, one per pixel.
const PAINT = `
  window.paint = (canvas, rows) => {
    canvas.width = rows[0].length;
    canvas.height = rows.length;
    const context = canvas.getContext("2d");
    rows.forEach((row, y) => row.forEach((color, x) => { context.fillStyle = color; context.fillRect(x, y, 1, 1); }));
  };
  window.pixels = (pixelCanvas) => {
    const { width, height } = pixelCanvas.canvas;
    const data = pixelCanvas.canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const out = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) row.push([...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)].join(","));
      out.push(row);
    }
    return out;
  };`;

const setup = async (page, html, rows) => {
  await mount(page, html, MODULES);
  await page.evaluate(
    ({ paint, rows }) => {
      new Function(paint)();
      for (const canvas of document.querySelectorAll("canvas[data-source]")) window.paint(canvas, rows);
      for (const pc of document.querySelectorAll("pixel-canvas")) pc.render();
    },
    { paint: PAINT, rows },
  );
};

const CHECKER = [
  ["#fff", "#000"],
  ["#000", "#fff"],
];

test("draws its source through no effects unchanged, at the source's size", async ({ page }) => {
  await setup(page, `<pixel-canvas id="p"><canvas data-source></canvas></pixel-canvas>`, CHECKER);
  expect(await page.evaluate(() => window.pixels(document.getElementById("p")))).toEqual([
    ["255,255,255", "0,0,0"],
    ["0,0,0", "255,255,255"],
  ]);
});

test("effects run from the inside out, the way the markup nests", async ({ page }) => {
  // Averaging the checkerboard gives mid-gray (128); 1-bit rounds that to white.
  await setup(
    page,
    `<pixel-canvas id="mosaic-first"><pixel-palette colors="1bit"><pixel-mosaic size="2"><canvas data-source></canvas></pixel-mosaic></pixel-palette></pixel-canvas>
     <pixel-canvas id="palette-first"><pixel-mosaic size="2"><pixel-palette colors="1bit"><canvas data-source></canvas></pixel-palette></pixel-mosaic></pixel-canvas>`,
    CHECKER,
  );
  const result = await page.evaluate(() => ({
    mosaicFirst: window.pixels(document.getElementById("mosaic-first")).flat(),
    paletteFirst: window.pixels(document.getElementById("palette-first")).flat(),
    order: document.getElementById("mosaic-first").effects.map((e) => e.localName),
  }));
  expect(result.order).toEqual(["pixel-mosaic", "pixel-palette"]);
  expect(new Set(result.mosaicFirst)).toEqual(new Set(["255,255,255"]));
  expect(new Set(result.paletteFirst)).toEqual(new Set(["128,128,128"]));
});

test("a disabled effect passes the image through; toggling it redraws", async ({ page }) => {
  await setup(page, `<pixel-canvas id="p"><pixel-mosaic id="m" size="2" disabled><canvas data-source></canvas></pixel-mosaic></pixel-canvas>`, CHECKER);
  const read = () => page.evaluate(() => window.pixels(document.getElementById("p")).flat()[0]);
  expect(await read()).toBe("255,255,255");
  await page.evaluate(() => (document.getElementById("m").disabled = false));
  await expect.poll(read).toBe("128,128,128");
  await page.evaluate(() => document.getElementById("m").setAttribute("size", "1"));
  await expect.poll(read, "attribute changes redraw too").toBe("255,255,255");
});

test("width sets a working resolution, keeping the aspect ratio", async ({ page }) => {
  const rows = Array.from({ length: 4 }, () => Array(8).fill("#f00"));
  await setup(page, `<pixel-canvas id="p" width="4"><canvas data-source></canvas></pixel-canvas>`, rows);
  expect(await page.evaluate(() => [document.getElementById("p").canvas.width, document.getElementById("p").canvas.height])).toEqual([4, 2]);
});

test("pixel-palette: named palettes, any CSS colors, and both dithers", async ({ page }) => {
  const gray = Array.from({ length: 8 }, () => Array(8).fill("rgb(128 128 128)"));
  await setup(
    page,
    `<pixel-canvas id="fs"><pixel-palette colors="1bit" dither="floyd-steinberg"><canvas data-source></canvas></pixel-palette></pixel-canvas>
     <pixel-canvas id="ordered"><pixel-palette colors="#000 white" dither="ordered"><canvas data-source></canvas></pixel-palette></pixel-canvas>
     <pixel-palette id="custom" colors="rgb(255 0 0) teal not-a-color"></pixel-palette>
     <pixel-palette id="gb" colors="gameboy"></pixel-palette>`,
    gray,
  );
  const result = await page.evaluate(() => {
    const share = (id) => {
      const flat = window.pixels(document.getElementById(id)).flat();
      return flat.filter((p) => p === "255,255,255").length / flat.length;
    };
    return {
      fs: share("fs"),
      ordered: share("ordered"),
      onlyBlackAndWhite: [...new Set(window.pixels(document.getElementById("fs")).flat())].sort(),
      custom: document.getElementById("custom").palette,
      gb: document.getElementById("gb").palette.length,
    };
  });
  expect(result.fs).toBeGreaterThan(0.35);
  expect(result.fs).toBeLessThan(0.65);
  expect(result.ordered).toBeGreaterThan(0.35);
  expect(result.ordered).toBeLessThan(0.65);
  expect(result.onlyBlackAndWhite).toEqual(["0,0,0", "255,255,255"]);
  expect(result.custom).toEqual([[255, 0, 0], [0, 128, 128]]);
  expect(result.gb).toBe(4);
});

test("pixel-grid draws lines every size pixels", async ({ page }) => {
  const white = Array.from({ length: 4 }, () => Array(4).fill("#fff"));
  await setup(page, `<pixel-canvas id="p"><pixel-grid size="2" color="red"><canvas data-source></canvas></pixel-grid></pixel-canvas>`, white);
  const red = "255,0,0";
  const w = "255,255,255";
  expect(await page.evaluate(() => window.pixels(document.getElementById("p")))).toEqual([
    [red, red, red, red],
    [red, w, red, w],
    [red, red, red, red],
    [red, w, red, w],
  ]);
});

test("custom effects: definePixelFilter, and invalidate() redraws", async ({ page }) => {
  // Defined after the markup is in the page: it upgrades in place.
  await setup(page, `<pixel-canvas id="p"><pixel-tint id="t"><canvas data-source></canvas></pixel-tint></pixel-canvas>`, [["#000"]]);
  await page.evaluate(async () => {
    const { definePixelFilter } = await import("/src/pixelable/pixel-filter.mjs");
    definePixelFilter("pixel-tint", (image, element) => {
      const amount = element.amount ?? 0;
      for (let i = 0; i < image.data.length; i += 4) image.data[i] = amount;
      return image;
    });
    document.getElementById("p").render();
  });
  const read = () => page.evaluate(() => window.pixels(document.getElementById("p"))[0][0]);
  expect(await read()).toBe("0,0,0");
  await page.evaluate(() => {
    const t = document.getElementById("t");
    t.amount = 200; // a property: the canvas can't see it...
    t.invalidate(); // ...until asked
  });
  await expect.poll(read).toBe("200,0,0");
});

test("an <img> source draws when it loads, fires load, and names the result from alt", async ({ page }) => {
  await mount(page, "", MODULES);
  const result = await page.evaluate(async () => {
    const holder = document.createElement("div");
    holder.innerHTML = `<pixel-canvas id="p"><pixel-mosaic size="4"><img src="/src/pixelable/pixel-canvas/scene.svg" alt="A sunset"></pixel-mosaic></pixel-canvas>
      <pixel-canvas id="decorative"><img src="/src/pixelable/pixel-canvas/scene.svg" alt=""></pixel-canvas>
      <pixel-canvas id="authored" aria-label="Mine"><img src="/src/pixelable/pixel-canvas/scene.svg" alt="theirs"></pixel-canvas>`;
    const loaded = new Promise((r) => holder.querySelector("#p").addEventListener("load", r, { once: true }));
    document.body.append(holder);
    await loaded;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const p = document.getElementById("p");
    return {
      size: [p.canvas.width, p.canvas.height],
      role: p.getAttribute("role"),
      label: p.getAttribute("aria-label"),
      decorative: document.getElementById("decorative").getAttribute("role"),
      authored: document.getElementById("authored").getAttribute("aria-label"),
      sourceHidden: !p.querySelector("img").checkVisibility(),
    };
  });
  expect(result).toEqual({ size: [320, 200], role: "img", label: "A sunset", decorative: "presentation", authored: "Mine", sourceHidden: true });
});

test("an unreadable (cross-origin) source fires error and shows the original instead", async ({ page }) => {
  await mount(page, "", MODULES);
  const result = await page.evaluate(async () => {
    const other = `http://127.0.0.1:${location.port}/src/pixelable/pixel-canvas/scene.svg`;
    document.body.innerHTML = `<pixel-canvas id="p"><img src="${other}" alt="elsewhere"></pixel-canvas>`;
    const p = document.getElementById("p");
    const error = await new Promise((r) => p.addEventListener("error", (e) => r(e.error?.name), { once: true }));
    return { error, failed: p.hasAttribute("data-failed"), originalShown: p.querySelector("img").checkVisibility() };
  });
  expect(result).toEqual({ error: "SecurityError", failed: true, originalShown: true });
});

test("a playing video is redrawn every frame", async ({ page }) => {
  await mount(page, `<canvas id="feed" width="4" height="4"></canvas><pixel-canvas id="p"><video muted playsinline></video></pixel-canvas>`, MODULES);
  const supported = await page.evaluate(() => typeof HTMLCanvasElement.prototype.captureStream === "function");
  test.skip(!supported, "no canvas.captureStream() in this engine");
  // Some engine builds (WebKit on Linux CI) can't play a canvas stream at
  // all: video.play() never settles. Skip there rather than time out.
  const plays = await page.evaluate(async () => {
    const video = document.querySelector("video");
    video.srcObject = document.getElementById("feed").captureStream(30);
    const started = await Promise.race([video.play().then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 3000))]);
    video.pause();
    return started;
  });
  test.skip(!plays, "this engine can't play a canvas stream here");
  const result = await page.evaluate(async () => {
    const feed = document.getElementById("feed");
    const context = feed.getContext("2d");
    let hue = 0;
    const paintFeed = () => {
      context.fillStyle = `hsl(${(hue += 40)} 100% 50%)`;
      context.fillRect(0, 0, 4, 4);
    };
    paintFeed();
    const video = document.querySelector("video");
    video.srcObject = feed.captureStream(30);
    await video.play();
    const p = document.getElementById("p");
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      paintFeed();
      await new Promise((r) => setTimeout(r, 50));
      if (p.canvas.width) seen.add([...p.canvas.getContext("2d").getImageData(0, 0, 1, 1).data].join());
    }
    video.pause();
    return seen.size;
  });
  expect(result).toBeGreaterThan(2);
});

test("toBlob gives the result as a PNG; survives a move and every creation path", async ({ page }) => {
  await setup(page, `<div id="a"><pixel-canvas id="p"><canvas data-source></canvas></pixel-canvas></div><div id="b"></div>`, CHECKER);
  const result = await page.evaluate(async () => {
    const p = document.getElementById("p");
    const blob = await p.toBlob();
    document.getElementById("b").append(p);
    const built = document.createElement("pixel-canvas");
    const source = document.createElement("canvas");
    window.paint(source, [["#00f"]]);
    built.append(source);
    document.body.append(built);
    built.render();
    return { type: blob.type, movedDraws: p.render(), built: window.pixels(built)[0][0] };
  });
  expect(result).toEqual({ type: "image/png", movedDraws: true, built: "0,0,255" });
});
