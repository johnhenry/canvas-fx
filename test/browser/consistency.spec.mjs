// Rules that should hold for every element in the family at once: tag
// names, `hidden`, and every way an element can be created or moved.
import { test, expect } from "@playwright/test";
import { mount } from "./helpers.mjs";

// module directory (under src/) -> sample markup for its element
const ELEMENTS = {
  "pixel-canvas": "<canvas></canvas>",
  "pixel-mosaic": "",
  "pixel-palette": "",
  "pixel-grid": "",
  "pixel-adjust": "",
  "pixel-halftone": "",
  "pixel-outline": "",
  "pixel-crt": "",
  "pixel-chroma-key": "",
  "pixel-sprite": ".8.\n888",
  "pixel-glitch": "",
  "pixel-wave": "",
  "pixel-shader": '<script type="x-shader/x-fragment">color = pixel;</script>',
  "pixel-lens": "",
  "pixel-spotlight": "",
  "pixel-glyphs": "",
};
const MODULES = Object.keys(ELEMENTS).map((path) => `src/${path}/global.mjs`);

test("every element registers the tag named after its module", async ({ page }) => {
  await mount(page, "", MODULES);
  const missing = await page.evaluate((tags) => tags.filter((tag) => !customElements.get(tag)), Object.keys(ELEMENTS));
  expect(missing).toEqual([]);
});

test("the hidden attribute hides every element", async ({ page }) => {
  await mount(page, "", MODULES);
  const visible = await page.evaluate((elements) => {
    document.body.innerHTML = Object.entries(elements).map(([tag, inner]) => `<${tag} hidden>${inner}</${tag}>`).join("");
    return [...document.body.children].filter((el) => el.checkVisibility()).map((el) => el.localName);
  }, ELEMENTS);
  expect(visible).toEqual([]);
});

test("every element works however it's created, and survives a move, without errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await mount(page, "", MODULES);
  await page.evaluate(async (elements) => {
    const tick = () => new Promise((r) => setTimeout(r, 10));
    for (const [tag, inner] of Object.entries(elements)) {
      // 1. parsed from markup
      document.body.innerHTML = `<div id="a"><${tag}>${inner}</${tag}></div><div id="b"></div>`;
      await tick();
      // 2. moved (disconnect + reconnect in one task)
      const el = document.querySelector(tag);
      document.getElementById("b").append(el);
      await tick();
      // 3. built with createElement, children before connect
      const built = document.createElement(tag);
      built.innerHTML = inner;
      document.body.append(built);
      await tick();
      // 4. removed
      built.remove();
      el.remove();
      await tick();
    }
  }, ELEMENTS);
  expect(errors).toEqual([]);
});
