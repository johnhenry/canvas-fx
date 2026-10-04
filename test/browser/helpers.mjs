// Shared helpers for the Playwright suites in this directory.

/**
 * Open the blank fixture page, import the given modules (paths relative to
 * the repo root, e.g. "src/tabbed-ui/global.mjs"), then set the body's HTML.
 * Modules load first, so elements upgrade as the markup is inserted -- the
 * same order as a page with module scripts in <head>.
 */
export async function mount(page, html, modules = []) {
  await page.goto("/test/browser/fixture.html");
  await page.evaluate(async ({ html, modules }) => {
    for (const path of modules) await import(`/${path}`);
    document.body.innerHTML = html;
  }, { html, modules });
}

/**
 * Record events of the given types that bubble up to the window -- what an
 * ordinary listener on the element or any ancestor sees -- into
 * window.__events as [type, target id] pairs.
 */
export async function recordEvents(page, types) {
  await page.evaluate((types) => {
    window.__events = [];
    for (const type of types) {
      window.addEventListener(type, (e) => window.__events.push([type, e.target.id]));
    }
  }, types);
  return {
    take: () => page.evaluate(() => window.__events.splice(0)),
  };
}

/**
 * Accessible names of every node with `role` in the browser's *real*
 * accessibility tree (Chromium only, via CDP). Playwright's own role/name
 * computation doesn't follow <label for> to form-associated custom
 * elements, so name checks for those use this; returns null elsewhere.
 */
export async function axNames(page, browserName, role) {
  if (browserName !== "chromium") return null;
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  return nodes.filter((n) => n.role?.value === role).map((n) => n.name?.value ?? "");
}
