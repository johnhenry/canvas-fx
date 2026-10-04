import { test, expect } from "@playwright/test";

test("the gallery shows each example's own file beside it, and can hide them", async ({ page }) => {
  await page.goto("/demo/");
  const cards = page.locator(".card:has(iframe)");
  const count = await cards.count();
  expect(count).toBeGreaterThan(3);
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const src = await card.locator("iframe").evaluate((iframe) => iframe.src);
    const expected = (await (await page.request.get(src)).text()).trimEnd();
    await expect(card.locator(".source pre")).toHaveText(expected, { useInnerText: false });
    await expect(card.locator(".source a")).toHaveAttribute("href", src);
  }
  const toggle = page.getByLabel("Show each example's source beside it");
  await toggle.uncheck();
  await expect(page.locator(".card .source").first()).toBeHidden();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator(".card .source").first()).toBeHidden();
  await toggle.check();
  await expect(page.locator(".card .source").first()).toBeVisible();
});
