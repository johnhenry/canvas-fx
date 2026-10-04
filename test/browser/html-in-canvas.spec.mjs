// <pixel-canvas html>: its own HTML, live, through the effects. Where the
// browser has HTML-in-canvas (the chromium-html-in-canvas project turns the
// flag on), the content is drawn; elsewhere it shows as it is.
import { test, expect } from "@playwright/test";
import { mount } from "./helpers.mjs";

const MODULES = ["src/global.mjs"];
const supported = (page) => page.evaluate(() => "drawElementImage" in CanvasRenderingContext2D.prototype);

const FORM = `
  <pixel-canvas id="p" html effects="mosaic(4)" style="width: 320px">
    <form id="f" style="background: rgb(0, 0, 255); padding: 20px; margin: 0">
      <label>Name <input id="name" value="Ada"></label>
      <button id="go" type="button" style="font-size: 20px">Go</button>
    </form>
  </pixel-canvas>`;

// The color of a pixel of what's on screen at (x, y), in CSS pixels from
// the element's top left: from the canvas showing the result.
const pixel = (page, x, y) =>
  page.evaluate(([x, y]) => {
    const host = document.getElementById("p");
    const canvas = host.shadowRoot.querySelector("canvas[part=html-canvas]");
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    return [...canvas.getContext("2d").getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data];
  }, [x, y]);

test("draws its HTML through the effects; the content stays live and clickable", async ({ page }) => {
  await mount(page, FORM, MODULES);
  test.skip(!(await supported(page)), "needs HTML-in-canvas (the chromium-html-in-canvas project)");
  await page.waitForFunction(() => document.getElementById("p").hasAttribute("data-html"));
  await expect.poll(() => pixel(page, 5, 5)).toEqual([0, 0, 255, 255]); // the form's blue, drawn
  // Mosaic: every 4×4 block (in CSS pixels) is one color.
  const block = await page.evaluate(() => {
    const canvas = document.getElementById("p").shadowRoot.querySelector("canvas[part=html-canvas]");
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const at = (x, y) => data.slice((Math.floor(y * scale) * canvas.width + Math.floor(x * scale)) * 4, 4 + (Math.floor(y * scale) * canvas.width + Math.floor(x * scale)) * 4).join();
    let uniform = true;
    for (let by = 0; by < 40; by += 4) for (let bx = 0; bx < 160; bx += 4) for (const [dx, dy] of [[1, 1], [3, 3], [2, 0]]) if (at(bx + dx, by + dy) !== at(bx, by)) uniform = false;
    return uniform;
  });
  expect(block).toBe(true);
  // The page doesn't paint the content itself; the canvas does, as tall as the content.
  const sizes = await page.evaluate(() => {
    const canvas = document.getElementById("p").shadowRoot.querySelector("canvas[part=html-canvas]");
    return [Math.round(canvas.getBoundingClientRect().height), Math.round(document.getElementById("f").getBoundingClientRect().height)];
  });
  expect(sizes[0]).toBe(sizes[1]);
  // Still a form: clicking where the button is clicks it, typing types.
  await page.evaluate(() => document.getElementById("go").addEventListener("click", () => (window.clicked = true)));
  const go = await page.locator("#go").boundingBox();
  await page.mouse.click(go.x + go.width / 2, go.y + go.height / 2);
  expect(await page.evaluate(() => window.clicked)).toBe(true);
  await page.locator("#name").fill("Grace");
  expect(await page.locator("#name").inputValue()).toBe("Grace");
  // Live: change the content's color, and the drawing follows.
  await page.evaluate(() => (document.getElementById("f").style.background = "rgb(255, 0, 0)"));
  await expect.poll(() => pixel(page, 5, 5)).toEqual([255, 0, 0, 255]);
  // It's the form, not an image, to assistive technology.
  expect(await page.evaluate(() => document.getElementById("p").getAttribute("role"))).toBe(null);
  await expect(page.getByRole("button", { name: "Go" })).toBeVisible();
});

test("effects and swatches apply as with any source; removing html goes back to normal", async ({ page }) => {
  await mount(page, FORM.replace('effects="mosaic(4)"', 'effects="palette(1bit)" swatches="2"'), MODULES);
  test.skip(!(await supported(page)), "needs HTML-in-canvas (the chromium-html-in-canvas project)");
  await expect.poll(() => page.evaluate(() => document.getElementById("p").palette.length)).toBe(2);
  const [r, g, b] = await pixel(page, 5, 5);
  expect([0, 255]).toContain(r); // 1-bit: black or white only
  expect(r === g && g === b).toBe(true);
  await page.evaluate(() => document.getElementById("p").removeAttribute("html"));
  expect(await page.evaluate(() => {
    const host = document.getElementById("p");
    return [host.hasAttribute("data-html"), host.shadowRoot.querySelector("canvas[part=html-canvas]")];
  })).toEqual([false, null]);
});

test("without HTML-in-canvas, the content shows as it is, and works", async ({ page }) => {
  await mount(page, FORM, MODULES);
  test.skip(await supported(page), "this browser has HTML-in-canvas");
  expect(await page.evaluate(() => document.getElementById("p").hasAttribute("data-html-unsupported"))).toBe(true);
  // Not an image: the form is the form, to assistive technology too.
  expect(await page.evaluate(() => document.getElementById("p").getAttribute("role"))).toBe(null);
  await expect(page.locator("#go")).toBeVisible();
  await page.locator("#name").fill("Grace");
  expect(await page.locator("#name").inputValue()).toBe("Grace");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e));
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test("with gpu, live HTML goes straight to a texture: the same pixels, still interactive", async ({ page }) => {
  const CARD = (gpu) => `
    <pixel-canvas id="p" html ${gpu ? "gpu" : ""} effects="mosaic(4) palette(gameboy)" style="width: 320px">
      <form id="f" style="background: rgb(200, 220, 255); padding: 16px; margin: 0">
        Bare text is drawn too
        <button id="go" type="button" style="font-size: 20px">Go</button>
      </form>
    </pixel-canvas>`;
  await mount(page, CARD(false), MODULES);
  test.skip(!(await supported(page)), "needs HTML-in-canvas (the chromium-html-in-canvas project)");
  const read = () =>
    page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 300));
      const host = document.getElementById("p");
      const canvas = host.shadowRoot.querySelector("canvas[part=html-canvas]");
      // Read what's shown, whatever the canvas's context.
      const copy = new OffscreenCanvas(canvas.width, canvas.height).getContext("2d");
      copy.drawImage(canvas, 0, 0);
      return { renderer: host.renderer, data: [...copy.getImageData(0, 0, canvas.width, canvas.height).data] };
    });
  const cpu = await read();
  await page.evaluate((html) => (document.body.innerHTML = html), CARD(true));
  const gpu = await read();
  expect([cpu.renderer, gpu.renderer]).toEqual(["cpu", "gpu"]);
  expect(gpu.data.length).toBe(cpu.data.length);
  let off = 0;
  for (let i = 0; i < cpu.data.length; i++) if (Math.abs(cpu.data[i] - gpu.data[i]) > 3) off++;
  // The two paths shrink the content differently (the 2D canvas's resampler
  // versus bilinear sampling), and the palette then rounds a few pixels to
  // a neighboring color.
  expect(off / cpu.data.length).toBeLessThan(0.03);
  // Bare text is drawn: some of the card's area isn't the background color.
  expect(new Set(gpu.data.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(1);
  await page.evaluate(() => document.getElementById("go").addEventListener("click", () => (window.clicked = true)));
  const go = await page.locator("#go").boundingBox();
  await page.mouse.click(go.x + go.width / 2, go.y + go.height / 2);
  expect(await page.evaluate(() => window.clicked)).toBe(true);
});

test("pointer effects follow the pointer over live HTML", async ({ page }) => {
  await mount(page, `
    <pixel-canvas id="p" html effects="spotlight(20, 10, 0.9)" style="width: 320px">
      <div style="background: rgb(255, 255, 255); height: 120px; display: flex; align-items: flex-end; font-size: 10px">An element with no content isn't drawn (Chromium 153), so this one has some.</div>
    </pixel-canvas>`, MODULES);
  test.skip(!(await supported(page)), "needs HTML-in-canvas (the chromium-html-in-canvas project)");
  const box = await page.locator("#p").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.waitForTimeout(300);
  const [near, far] = await page.evaluate(() => {
    const canvas = document.getElementById("p").shadowRoot.querySelector("canvas[part=html-canvas]");
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const c = canvas.getContext("2d");
    return [c.getImageData(20 * scale, 20 * scale, 1, 1).data[0], c.getImageData(300 * scale, 30 * scale, 1, 1).data[0]];
  });
  expect(near).toBeGreaterThan(240);
  expect(far).toBeLessThan(60);
});
