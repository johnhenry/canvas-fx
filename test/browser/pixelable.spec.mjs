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
    order: document.getElementById("mosaic-first").effectElements.map((e) => e.localName),
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

test("definePixelEffect makes an effect usable both ways; a later definition redraws", async ({ page }) => {
  await setup(
    page,
    `<pixel-canvas id="attr" effects="tint(200)"><canvas data-source></canvas></pixel-canvas>
     <pixel-canvas id="el"><pixel-tint amount="120"><canvas data-source></canvas></pixel-tint></pixel-canvas>`,
    [["#000"]],
  );
  const read = (id) => page.evaluate((id) => window.pixels(document.getElementById(id))[0][0], id);
  const errors = await page.evaluate(() => {
    window.errors = [];
    document.getElementById("attr").addEventListener("error", (e) => window.errors.push(e.message));
  });
  void errors;
  await page.evaluate(async () => {
    const { definePixelEffect, number } = await import("/src/pixelable/effects.mjs");
    definePixelEffect(
      "tint",
      (image, params) => {
        for (let i = 0; i < image.data.length; i += 4) image.data[i] = number(params.amount, 0);
        return image;
      },
      { params: ["amount"] },
    );
  });
  await expect.poll(() => read("attr"), "the attribute form, once defined").toBe("200,0,0");
  await expect.poll(() => read("el"), "the element form <pixel-tint>, upgraded in place").toBe("120,0,0");
});

test("a stateful effect element: extend PixelEffect, and invalidate() redraws", async ({ page }) => {
  await setup(page, `<pixel-canvas id="p"><pixel-stateful id="t"><canvas data-source></canvas></pixel-stateful></pixel-canvas>`, [["#000"]]);
  await page.evaluate(async () => {
    const { PixelEffect } = await import("/src/pixelable/effects.mjs");
    customElements.define("pixel-stateful", class extends PixelEffect {
      amount = 0;
      apply(image) {
        for (let i = 0; i < image.data.length; i += 4) image.data[i + 1] = this.amount;
        return image;
      }
    });
    document.getElementById("p").render();
  });
  const read = () => page.evaluate(() => window.pixels(document.getElementById("p"))[0][0]);
  expect(await read()).toBe("0,0,0");
  await page.evaluate(() => {
    const t = document.getElementById("t");
    t.amount = 90; // a property: the canvas can't see it...
    t.invalidate(); // ...until asked
  });
  await expect.poll(read).toBe("0,90,0");
});

test.describe("the effects attribute", () => {
  test("runs left to right, after any effect elements, and matches the element form", async ({ page }) => {
    await setup(
      page,
      `<pixel-canvas id="attr-order" effects="mosaic(2) palette(1bit)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="attr-reversed" effects="palette(1bit) mosaic(2)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="mixed" effects="palette(1bit)"><pixel-mosaic size="2"><canvas data-source></canvas></pixel-mosaic></pixel-canvas>`,
      CHECKER,
    );
    const first = (id) => page.evaluate((id) => window.pixels(document.getElementById(id))[0][0], id);
    expect(await first("attr-order"), "mosaic then palette: gray rounds to white").toBe("255,255,255");
    expect(await first("attr-reversed"), "palette then mosaic: gray").toBe("128,128,128");
    expect(await first("mixed"), "the element (inside) runs before the attribute").toBe("255,255,255");
  });

  test("named and positional parameters, repeats, and colors with spaces", async ({ page }) => {
    const white = Array.from({ length: 4 }, () => Array(4).fill("#fff"));
    await setup(
      page,
      `<pixel-canvas id="named" effects="grid(color rgb(255 0 0), size 2)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="positional" effects="grid(2, rgb(255 0 0))"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="element"><pixel-grid size="2" color="rgb(255 0 0)"><canvas data-source></canvas></pixel-grid></pixel-canvas>
       <pixel-canvas id="repeated" effects="mosaic(1) palette(#000 #fff) palette(gameboy)"><canvas data-source></canvas></pixel-canvas>`,
      white,
    );
    const all = await page.evaluate(() => Object.fromEntries(["named", "positional", "element", "repeated"].map((id) => [id, window.pixels(document.getElementById(id))])));
    expect(all.named).toEqual(all.element);
    expect(all.positional).toEqual(all.element);
    expect(all.named[1]).toEqual(["255,0,0", "255,255,255", "255,0,0", "255,255,255"]);
    expect(all.repeated[0][0], "white, then the lightest Game Boy green").toBe("155,188,15");
  });

  test("an unknown effect is skipped, reported once with error, and the rest still run", async ({ page }) => {
    await setup(page, `<pixel-canvas id="p" effects="nope(1) palette(#f00)"><canvas data-source></canvas></pixel-canvas>`, [["#fff"]]);
    const result = await page.evaluate(async () => {
      const p = document.getElementById("p");
      const errors = [];
      p.addEventListener("error", (e) => errors.push(e.message));
      p.setAttribute("effects", "other(1) palette(#f00)");
      p.render();
      p.render();
      await new Promise((r) => setTimeout(r));
      return { errors, pixel: window.pixels(p)[0][0], failed: p.hasAttribute("data-failed") };
    });
    expect(result.pixel).toBe("255,0,0");
    expect(result.failed).toBe(false);
    expect(result.errors).toEqual(['No pixel effect named "other" (define it with definePixelEffect)']);
  });

  test("the effects property mirrors the attribute and redraws", async ({ page }) => {
    await setup(page, `<pixel-canvas id="p"><canvas data-source></canvas></pixel-canvas>`, [["#fff"]]);
    await page.evaluate(() => (document.getElementById("p").effects = "palette(#00f)"));
    expect(await page.evaluate(() => document.getElementById("p").getAttribute("effects"))).toBe("palette(#00f)");
    await expect.poll(() => page.evaluate(() => window.pixels(document.getElementById("p"))[0][0])).toBe("0,0,255");
  });

  test("parseEffects handles nesting, bare names, and odd spacing", async ({ page }) => {
    await mount(page, "", MODULES);
    const parsed = await page.evaluate(async () => {
      const { parseEffects } = await import("/src/pixelable/effects.mjs");
      return parseEffects("  mosaic( 4 )palette(rgb(0 0 0) white, ordered)   outline  grid()");
    });
    expect(parsed).toEqual([
      { name: "mosaic", args: ["4"] },
      { name: "palette", args: ["rgb(0 0 0) white", "ordered"] },
      { name: "outline", args: [] },
      { name: "grid", args: [] },
    ]);
  });
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
  const result = await page.evaluate(async () => {
    const feed = document.getElementById("feed");
    const context = feed.getContext("2d");
    let hue = 0;
    const paintFeed = () => {
      context.fillStyle = `hsl(${(hue += 40)} 100% 50%)`;
      context.fillRect(0, 0, 4, 4);
    };
    paintFeed(); // a stream has no frames until something is drawn
    const ticker = setInterval(paintFeed, 50);
    const video = document.querySelector("video");
    video.srcObject = feed.captureStream(30);
    // Some engine builds (WebKit on Linux CI) can't play a canvas stream:
    // play() never settles. Report that rather than time out.
    const plays = await Promise.race([video.play().then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 3000))]);
    if (!plays) {
      clearInterval(ticker);
      return { plays };
    }
    const p = document.getElementById("p");
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 50));
      if (p.canvas.width) seen.add([...p.canvas.getContext("2d").getImageData(0, 0, 1, 1).data].join());
    }
    clearInterval(ticker);
    video.pause();
    return { plays, frames: seen.size };
  });
  test.skip(!result.plays, "this engine can't play a canvas stream here");
  expect(result.frames).toBeGreaterThan(2);
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

test.describe("the newer effects", () => {
  const pixel = (page, id, x = 0, y = 0) =>
    page.evaluate(([id, x, y]) => {
      const canvas = document.getElementById(id).canvas;
      return [...canvas.getContext("2d").getImageData(x, y, 1, 1).data];
    }, [id, x, y]);

  test("adjust: brightness, contrast, saturation, and hue", async ({ page }) => {
    await setup(
      page,
      `<pixel-canvas id="dark" effects="adjust(brightness 0)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="flat" effects="adjust(contrast 0)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="gray" effects="adjust(saturation 0)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="turned" effects="adjust(hue 180)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="positional" effects="adjust(1, 1, 0)"><canvas data-source></canvas></pixel-canvas>`,
      [["#f00"]],
    );
    expect(await pixel(page, "dark")).toEqual([0, 0, 0, 255]);
    expect(await pixel(page, "flat")).toEqual([128, 128, 128, 255]);
    const [r, g, b] = await pixel(page, "gray");
    expect(r).toBe(g);
    expect(g).toBe(b);
    const [tr, tg, tb] = await pixel(page, "turned");
    expect(tg > tr && tb > tr, "red turned toward cyan").toBe(true);
    expect(await pixel(page, "positional"), "positional: brightness, contrast, saturation").toEqual(await pixel(page, "gray"));
  });

  test("halftone: dark areas become ink dots on paper; ink=auto keeps the color", async ({ page }) => {
    const rows = Array.from({ length: 12 }, () => Array(12).fill("#000"));
    await setup(
      page,
      `<pixel-canvas id="black" effects="halftone(6, 0)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="colored" effects="halftone(6, 0, auto, white)"><canvas data-source data-red></canvas></pixel-canvas>`,
      rows,
    );
    await page.evaluate(() => {
      const red = document.querySelector("[data-red]");
      window.paint(red, Array.from({ length: 12 }, () => Array(12).fill("rgb(128 0 0)")));
      document.getElementById("colored").render();
    });
    const share = (id, color) =>
      page.evaluate(([id, color]) => {
        const flat = window.pixels(document.getElementById(id)).flat();
        return flat.filter((p) => p === color).length / flat.length;
      }, [id, color]);
    expect(await share("black", "0,0,0"), "black: dots cover nearly everything").toBeGreaterThan(0.85);
    expect(await pixel(page, "black", 3, 3), "a cell's center is ink").toEqual([0, 0, 0, 255]);
    expect(await pixel(page, "colored", 3, 3), "auto ink: the cell's color").toEqual([128, 0, 0, 255]);
    expect(await pixel(page, "colored", 0, 0), "a corner of a mid-tone cell is paper").toEqual([255, 255, 255, 255]);
  });

  test("outline: lines where brightness changes, paper elsewhere (or the image, with paper none)", async ({ page }) => {
    const rows = Array.from({ length: 6 }, () => ["#fff", "#fff", "#fff", "#000", "#000", "#000"]);
    await setup(
      page,
      `<pixel-canvas id="o" effects="outline()"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="over" effects="outline(0.2, red, none)"><canvas data-source></canvas></pixel-canvas>`,
      rows,
    );
    const row = await page.evaluate(() => window.pixels(document.getElementById("o"))[2]);
    expect(row).toEqual(["255,255,255", "255,255,255", "0,0,0", "0,0,0", "255,255,255", "255,255,255"]);
    const over = await page.evaluate(() => window.pixels(document.getElementById("over"))[2]);
    expect(over).toEqual(["255,255,255", "255,255,255", "255,0,0", "255,0,0", "0,0,0", "0,0,0"]);
  });

  test("crt: darker alternate rows and a color stripe per column", async ({ page }) => {
    const rows = Array.from({ length: 2 }, () => Array(3).fill("#fff"));
    await setup(page, `<pixel-canvas id="p" effects="crt(0.5, 0.5, 1)"><canvas data-source></canvas></pixel-canvas>`, rows);
    expect(await page.evaluate(() => window.pixels(document.getElementById("p")))).toEqual([
      ["255,128,128", "128,255,128", "128,128,255"],
      ["128,64,64", "64,128,64", "64,64,128"],
    ]);
  });

  test("chroma-key: the key color becomes transparent, others stay", async ({ page }) => {
    await setup(page, `<pixel-canvas id="p" effects="chroma-key(lime, 0.2, 0)"><canvas data-source></canvas></pixel-canvas>`, [["lime", "rgb(20 240 20)", "red"]]);
    expect([(await pixel(page, "p", 0))[3], (await pixel(page, "p", 1))[3], (await pixel(page, "p", 2))[3]]).toEqual([0, 0, 255]);
  });

  test("every built-in effect gives the same pixels as an element and as a function", async ({ page }) => {
    const cases = [
      ["mosaic", { size: "2" }],
      ["palette", { colors: "gameboy", dither: "ordered" }],
      ["grid", { size: "3", color: "red" }],
      ["adjust", { contrast: "1.5", saturation: "0.5", hue: "30" }],
      ["halftone", { size: "4", angle: "30" }],
      ["outline", { threshold: "0.1" }],
      ["crt", { scanlines: "0.4" }],
      ["chroma-key", { color: "white", tolerance: "0.2" }],
    ];
    const rows = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => `hsl(${(x * 45 + y * 20) % 360} 70% ${30 + y * 6}%)`));
    const html = cases
      .map(([name, params]) => {
        const attrs = Object.entries(params).map(([k, v]) => `${k}="${v}"`).join(" ");
        const call = `${name}(${Object.entries(params).map(([k, v]) => `${k} ${v}`).join(", ")})`;
        return `<pixel-canvas id="fn-${name}" effects="${call}"><canvas data-source></canvas></pixel-canvas>
                <pixel-canvas id="el-${name}"><pixel-${name} ${attrs}><canvas data-source></canvas></pixel-${name}></pixel-canvas>`;
      })
      .join("");
    await setup(page, html, rows);
    const mismatches = await page.evaluate((names) => names.filter((name) =>
      JSON.stringify(window.pixels(document.getElementById(`fn-${name}`))) !== JSON.stringify(window.pixels(document.getElementById(`el-${name}`))),
    ), cases.map(([name]) => name));
    expect(mismatches).toEqual([]);
  });
});

test.describe("colors from the image", () => {
  // A picture that's mostly red, some blue, a little white.
  const ROWS = Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => (y < 6 ? "#e00000" : x < 7 ? "#0000d0" : "#ffffff")));

  test("palette(auto) reduces the image to its own dominant colors", async ({ page }) => {
    const gradient = Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => `rgb(${x * 16} ${y * 16} 128)`));
    await setup(
      page,
      `<pixel-canvas id="p" effects="palette(auto, none, 4)"><canvas data-source></canvas></pixel-canvas>
       <pixel-canvas id="el"><pixel-palette colors="auto" count="4"><canvas data-source></canvas></pixel-palette></pixel-canvas>`,
      gradient,
    );
    const result = await page.evaluate(() => ({
      distinct: new Set(window.pixels(document.getElementById("p")).flat()).size,
      same: JSON.stringify(window.pixels(document.getElementById("p"))) === JSON.stringify(window.pixels(document.getElementById("el"))),
      elementPalette: document.querySelector("pixel-palette").palette,
    }));
    expect(result.distinct).toBeLessThanOrEqual(4);
    expect(result.distinct).toBeGreaterThan(1);
    expect(result.same).toBe(true);
    expect(result.elementPalette, "auto depends on the image").toEqual([]);
  });

  test("swatches publishes the most common colors as custom properties, in order", async ({ page }) => {
    await setup(page, `<pixel-canvas id="p" swatches="3" swatches-target="html"><canvas data-source></canvas></pixel-canvas>`, ROWS);
    const result = await page.evaluate(() => {
      const p = document.getElementById("p");
      const root = document.documentElement.style;
      return {
        palette: p.palette,
        own: p.style.getPropertyValue("--pixel-swatch-1"),
        html: [1, 2, 3].map((i) => root.getPropertyValue(`--pixel-swatch-${i}`)),
      };
    });
    expect(result.palette).toEqual(["#e00000", "#0000d0", "#ffffff"]);
    expect(result.own).toBe("#e00000");
    expect(result.html).toEqual(["#e00000", "#0000d0", "#ffffff"]);
  });

  test("palettechange fires when the colors change; fewer swatches and removal clean up", async ({ page }) => {
    await setup(page, `<pixel-canvas id="p" swatches="3" swatches-target="html"><canvas data-source></canvas></pixel-canvas>`, ROWS);
    const result = await page.evaluate(async () => {
      const p = document.getElementById("p");
      const events = [];
      p.addEventListener("palettechange", () => events.push(p.palette.length));
      p.render(); // same picture: no event
      p.swatches = 1;
      p.render();
      const html = () => [1, 2, 3].map((i) => document.documentElement.style.getPropertyValue(`--pixel-swatch-${i}`));
      const afterOne = html();
      p.remove();
      return { events, afterOne, afterRemoval: html() };
    });
    expect(result.events).toEqual([1]);
    expect(result.afterOne).toEqual(["#e00000", "", ""]);
    expect(result.afterRemoval).toEqual(["", "", ""]);
  });
});

test.describe("pixel-sprite", () => {
  const spritePixels = (page, id) =>
    page.evaluate((id) => {
      const canvas = document.getElementById(id).canvas;
      const { width, height } = canvas;
      const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
      const rows = [];
      for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) row.push([...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)].join(","));
        rows.push(row);
      }
      return rows;
    }, id);

  test("draws text as pixels, with a color key; . is transparent; indentation doesn't matter", async ({ page }) => {
    await mount(
      page,
      `<pixel-sprite id="s" colors="# black; o rgb(255 200 0)" alt="A coin">
         .#.
         #o#
       </pixel-sprite>`,
      MODULES,
    );
    const T = "0,0,0,0";
    const K = "0,0,0,255";
    const O = "255,200,0,255";
    expect(await spritePixels(page, "s")).toEqual([[T, K, T], [K, O, K]]);
    const box = await page.evaluate(() => {
      const r = document.getElementById("s").getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height)];
    });
    expect(box, "scaled 8× by default").toEqual([24, 16]);
  });

  test("named palettes number their colors: pico-8 by default, hex digits", async ({ page }) => {
    await mount(page, `<pixel-sprite id="s">08c</pixel-sprite><pixel-sprite id="g" colors="gameboy">0123</pixel-sprite>`, MODULES);
    expect(await spritePixels(page, "s")).toEqual([["0,0,0,255", "255,0,77,255", "41,173,255,255"]]);
    expect((await spritePixels(page, "g"))[0][3]).toBe("155,188,15,255");
  });

  test("frames: blank lines separate them; frame is settable and wraps; fps animates", async ({ page }) => {
    await mount(page, `<pixel-sprite id="s" colors="# black" paused fps="30">#.\n\n.#\n\n##</pixel-sprite>`, MODULES);
    const state = await page.evaluate(() => {
      const s = document.getElementById("s");
      const frames = s.frames;
      s.frame = 4;
      return { frames, frame: s.frame };
    });
    expect(state).toEqual({ frames: 3, frame: 1 });
    const seen = await page.evaluate(async () => {
      const s = document.getElementById("s");
      const events = [];
      for (const type of ["play", "pause"]) s.addEventListener(type, () => events.push(type));
      const frames = new Set();
      s.addEventListener("framechange", () => frames.add(s.frame));
      s.play();
      await new Promise((r) => setTimeout(r, 300));
      s.pause();
      return { events, frames: frames.size };
    });
    expect(seen.events).toEqual(["play", "pause"]);
    expect(seen.frames).toBe(3);
  });

  test("reduced motion: it doesn't animate on its own", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mount(page, `<pixel-sprite id="s" colors="# black" fps="30">#.\n\n.#</pixel-sprite>`, MODULES);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.getElementById("s").frame)).toBe(0);
  });

  test("editing the text or colors redraws; alt names it like an <img>", async ({ page }) => {
    await mount(page, `<pixel-sprite id="s" colors="# black" alt="A dot">#</pixel-sprite><pixel-sprite id="d" colors="# black">#</pixel-sprite>`, MODULES);
    await page.evaluate(() => {
      const s = document.getElementById("s");
      s.textContent = "##";
      s.setAttribute("colors", "# white");
    });
    await expect.poll(() => spritePixels(page, "s")).toEqual([["255,255,255,255", "255,255,255,255"]]);
    expect(await page.evaluate(() => [document.getElementById("s").getAttribute("role"), document.getElementById("s").getAttribute("aria-label"), document.getElementById("d").getAttribute("role")])).toEqual(["img", "A dot", "presentation"]);
  });

  test("is a <pixel-canvas> source: scaled up crisply, through effects, redrawn per frame", async ({ page }) => {
    await mount(
      page,
      `<pixel-canvas id="p" width="4" effects="palette(#000 #f00)"><pixel-sprite id="s" colors="# black; o red" paused alt="A flag">#o\n\no#</pixel-sprite></pixel-canvas>`,
      MODULES,
    );
    const read = () =>
      page.evaluate(() => {
        const c = document.getElementById("p").canvas;
        if (!c.width) return null; // not drawn yet
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        return { size: [c.width, c.height], left: [...d.slice(0, 3)].join(), right: [...d.slice(12, 15)].join(), label: document.getElementById("p").getAttribute("aria-label") };
      });
    await expect.poll(read).toEqual({ size: [4, 2], left: "0,0,0", right: "255,0,0", label: "A flag" });
    await page.evaluate(() => (document.getElementById("s").frame = 1));
    await expect.poll(() => read().then((r) => r && [r.left, r.right])).toEqual(["255,0,0", "0,0,0"]);
  });
});

test.describe("effects over time", () => {
  test("effects get { time, frame }; fps redraws a still image; paused freezes the clock", async ({ page }) => {
    await setup(page, `<pixel-canvas id="p" fps="30" effects="clockwork()"><canvas data-source></canvas></pixel-canvas>`, [["#000"]]);
    const result = await page.evaluate(async () => {
      const { definePixelEffect } = await import("/src/pixelable/effects.mjs");
      const seen = [];
      definePixelEffect("clockwork", (image, params, { time, frame }) => {
        seen.push({ time, frame });
        return image;
      });
      await new Promise((r) => setTimeout(r, 400));
      const p = document.getElementById("p");
      const running = seen.length;
      const events = [];
      for (const type of ["play", "pause"]) p.addEventListener(type, () => events.push(type));
      p.pause();
      const frozenAt = p.time;
      const countAtPause = seen.length;
      await new Promise((r) => setTimeout(r, 200));
      const stillFrozen = p.time === frozenAt && seen.length === countAtPause;
      p.render();
      const renderedTime = seen.at(-1).time;
      p.removeAttribute("paused");
      await new Promise((r) => setTimeout(r, 100));
      return {
        running,
        increasing: seen.slice(0, running).every((s, i, all) => i === 0 || (s.time >= all[i - 1].time && s.frame === all[i - 1].frame + 1)),
        stillFrozen,
        renderedTime: Math.abs(renderedTime - frozenAt) < 1e-9,
        resumed: p.time > frozenAt,
        events,
      };
    });
    expect(result.running).toBeGreaterThan(5);
    expect(result.increasing).toBe(true);
    expect(result.stillFrozen).toBe(true);
    expect(result.renderedTime).toBe(true);
    expect(result.resumed).toBe(true);
    expect(result.events).toEqual(["pause", "play"]);
  });

  test("glitch is repeatable for a moment of the clock and changes with it; amount 0 is a no-op", async ({ page }) => {
    await mount(page, "", MODULES);
    const result = await page.evaluate(async () => {
      const glitch = await import("/src/pixelable/pixel-glitch/effect.mjs");
      const make = () => {
        const image = new ImageData(32, 32);
        for (let i = 0; i < image.data.length; i += 4) image.data.set([(i / 4) % 32 * 8, (i / 128) * 8, 128, 255], i);
        return image;
      };
      const run = (time, amount = "0.8") => [...glitch.apply(make(), { amount }, { time }).data].join();
      return {
        repeatable: run(1.0) === run(1.01),
        changes: run(1.0) !== run(2.0),
        none: run(1.0, "0") === [...make().data].join(),
        broken: run(1.0) !== [...make().data].join(),
      };
    });
    expect(result).toEqual({ repeatable: true, changes: true, none: true, broken: true });
  });

  test("wave slides rows along a sine wave that moves with time", async ({ page }) => {
    await mount(page, "", MODULES);
    const result = await page.evaluate(async () => {
      const wave = await import("/src/pixelable/pixel-wave/effect.mjs");
      const make = () => {
        const image = new ImageData(9, 4);
        for (let y = 0; y < 4; y++) image.data.set([255, 255, 255, 255], (y * 9 + 4) * 4); // a white column at x=4
        return image;
      };
      const column = (image) => [0, 1, 2, 3].map((y) => [...Array(9).keys()].find((x) => image.data[(y * 9 + x) * 4] === 255));
      return {
        still: column(wave.apply(make(), { amplitude: "2", wavelength: "4", speed: "0" }, { time: 0 })),
        later: column(wave.apply(make(), { amplitude: "2", wavelength: "4", speed: "1" }, { time: 0.25 })),
      };
    });
    expect(result.still).toEqual([4, 6, 4, 2]);
    expect(result.later, "a quarter wave on").toEqual([6, 4, 2, 4]);
  });

  test("reduced motion: the clock waits for play()", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setup(page, `<pixel-canvas id="p" fps="30" effects="wave(4)"><canvas data-source></canvas></pixel-canvas>`, [["#000"]]);
    const times = await page.evaluate(async () => {
      const p = document.getElementById("p");
      await new Promise((r) => setTimeout(r, 200));
      const before = p.time;
      p.play();
      await new Promise((r) => setTimeout(r, 200));
      return [before, p.time > 0.1];
    });
    expect(times).toEqual([0, true]);
  });

  test("commands drive the clock", async ({ page }) => {
    await setup(page, `<pixel-canvas id="p"><canvas data-source></canvas></pixel-canvas>`, [["#000"]]);
    const states = await page.evaluate(() => {
      const p = document.getElementById("p");
      const send = (command) => p.dispatchEvent(Object.assign(new Event("command"), { command }));
      send("--pause");
      const a = p.paused;
      send("--toggle");
      const b = p.paused;
      return [a, b];
    });
    expect(states).toEqual([true, false]);
  });
});
