// Automated accessibility audits (axe-core) for the family's elements,
// complementing the hand-written role/label assertions in pixel-canvas.spec.mjs.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mount } from "./helpers.mjs";

const MODULES = ["src/global.mjs"];
// Element fixtures are fragments, not pages.
const FRAGMENT_RULES = ["landmark-one-main", "page-has-heading-one", "region"];

const audit = async (page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .disableRules(FRAGMENT_RULES)
    .analyze();
  return violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
};

const ALL = `
  <pixel-canvas><pixel-palette colors="gameboy"><img src="/src/pixel-canvas/scene.svg" alt="A sunset"></pixel-palette></pixel-canvas>
  <pixel-sprite alt="A heart">.8.8.\n88888\n.888.</pixel-sprite>
  <pixel-sprite>8</pixel-sprite>
  <pixel-canvas effects="halftone(4) crt()"><img src="/src/pixel-canvas/scene.svg" alt="A sunset, printed"></pixel-canvas>
  <pixel-canvas effects="spotlight(20) lens(10)" gpu><pixel-lens><img src="/src/pixel-canvas/scene.svg" alt="A sunset, magnified"></pixel-lens></pixel-canvas>
  <pixel-canvas effects="glyphs(6x10)"><img src="/src/pixel-canvas/scene.svg" alt="A sunset, in characters"></pixel-canvas>
  <pixel-canvas html effects="mosaic(2)"><form><label>Name <input name="n"></label><button type="button">Go</button></form></pixel-canvas>`;

test("every element passes axe", async ({ page }) => {
  await mount(page, ALL, MODULES);
  await page.waitForTimeout(300);
  expect(await audit(page)).toEqual([]);
});
