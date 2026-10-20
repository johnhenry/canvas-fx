import { test, expect } from "@playwright/test";
import { mount } from "./helpers.mjs";

// A lost WebGL context (the browser caps live contexts and drops the oldest)
// must not leave the GPU path dead: the shared context's pipeline is rebuilt
// once the context is restored, and the elements redraw.

test.beforeEach(async ({ page }) => {
  await mount(page, '<pixel-canvas id="a" effects="threshold(0.5)" gpu><canvas id="s" width="2" height="1"></canvas></pixel-canvas>', ["src/global.mjs"]);
  const available = await page.evaluate(async () => (await import("/src/gpu.mjs")).gpuAvailable());
  test.skip(!available, "no WebGL2 in this browser");
  await page.evaluate(() => {
    const c = document.getElementById("s").getContext("2d");
    c.fillStyle = "#fff";
    c.fillRect(0, 0, 1, 1);
    c.fillStyle = "#000";
    c.fillRect(1, 0, 1, 1);
  });
});

const read = (page) =>
  page.evaluate(() => {
    const host = document.getElementById("a");
    const { width, height } = host.canvas;
    return [...host.canvas.getContext("2d").getImageData(0, 0, width, height).data];
  });

test("after the context is lost and restored, effects draw again", async ({ page }) => {
  await page.evaluate(() => document.getElementById("a").render());
  const before = await read(page);
  expect(before.slice(0, 3)).toEqual([255, 255, 255]);
  const result = await page.evaluate(async () => {
    const { sharedContext, pipelineFor } = await import("/src/gpu.mjs");
    const gl = sharedContext();
    const first = pipelineFor(gl);
    const lose = gl.getExtension("WEBGL_lose_context");
    lose.loseContext();
    await new Promise((r) => setTimeout(r, 50));
    const lost = gl.isContextLost();
    lose.restoreContext();
    await new Promise((r) => setTimeout(r, 100));
    return { lost, restored: !gl.isContextLost(), rebuilt: pipelineFor(gl) !== first };
  });
  expect(result).toEqual({ lost: true, restored: true, rebuilt: true });
  // The element redraws by itself on restore (no render() call).
  await page.waitForFunction(() => document.getElementById("a").renderer === "gpu");
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await read(page)).toEqual(before);
});

test("resetGpu() drops the pipelines and the shared context", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { sharedContext, pipelineFor, resetGpu } = await import("/src/gpu.mjs");
    const gl = sharedContext();
    const first = pipelineFor(gl);
    resetGpu();
    const next = sharedContext();
    return { newContext: next !== gl, newPipeline: pipelineFor(next) !== first };
  });
  expect(result).toEqual({ newContext: true, newPipeline: true });
  await page.evaluate(() => document.getElementById("a").render());
  expect((await read(page)).slice(0, 3)).toEqual([255, 255, 255]);
});
