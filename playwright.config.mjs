// Browser tests (test/browser/): every stable element, in every engine.
// See docs/principles.md section 8.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4729/" },
  webServer: {
    command: "node scripts/serve.mjs",
    url: "http://localhost:4729/package.json",
    // Never reuse whatever already listens on the port: another project's
    // server there would silently serve the wrong files.
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    // HTML-in-canvas is behind a flag in Chromium for now: run the specs
    // that use it with the flag on too (they test the fallback elsewhere).
    {
      name: "chromium-html-in-canvas",
      testMatch: /(html-in-canvas|accessibility)\.spec\.mjs/,
      use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--enable-blink-features=CanvasDrawElement"] } },
    },
  ],
});
