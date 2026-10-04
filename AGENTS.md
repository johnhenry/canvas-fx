# Agent playbook

`@johnhenry/canvas-fx`: pixel effects for images, video, canvases, and live
HTML, written as HTML. Single package, Node >= 26 for the tooling, browser
code tested with Playwright in Chromium, Firefox, and WebKit (plus a
Chromium project with the HTML-in-canvas flag on). Ships source; no build
step. Split out of `@johnhenry/domkit`, whose conventions it keeps.

`CLAUDE.md` in this directory is a symlink to this file.

## The verification loop (before every push)

1. `npm test`: every `.mjs` parses, every relative reference and
   `@johnhenry/canvas-fx/<path>` resolves through `exports`, `no-undef`
   lint, and the generated declarations type-check through the package's
   own paths (`test/types`).
2. `npm run test:browser`: Playwright, `test/browser/*.spec.mjs`, in every
   project. Firefox often can't launch on new macOS ("Could not find
   profile folder"); run `--project chromium --project webkit --project
   chromium-html-in-canvas` locally and let CI cover Firefox. **Skipped
   tests are expected only in pairs**: the HTML-in-canvas specs skip their
   supported half where the API is missing and their fallback half where
   it exists.
3. `npm run manifest` after any JSDoc change, and commit the output (CI
   checks it's current).
4. For anything visual, look at it: `npm run serve` (port 4729), then
   `/demo/` and the element's `demo.html`. Pixel tests check pixels, but
   only a look catches "correct and ugly".
5. `npm pack --dry-run`, then a genuinely fresh clone:
   `git clone . /tmp/canvas-fx-verifyN && cd $_ && npm ci && npm test`.

## Repo-specific gotchas

- **HTML-in-canvas is behind a flag.** `--enable-blink-features=CanvasDrawElement`
  turns it on in Playwright's Chromium (the `chromium-html-in-canvas`
  project). The API may change before it ships; feature-detect
  (`"drawElementImage" in CanvasRenderingContext2D.prototype`), never
  version-sniff.
- **A canvas's children shrink to fit,** so the content isn't slotted
  straight into the `<canvas layoutsubtree>`: a block `<div>` (the
  `html-content` part) holds it, lays it out as anywhere else, and is the
  one element drawn.
- **`texElementImage2D(target, internalformat, element)`** is the shape in
  Chromium 153, not the explainer's; the internal format must be `RGBA8`,
  `SRGB8_ALPHA8`, `RGBA16F`, or `RGBA32F`. Probe a new Chromium before
  trusting the docs.
- **An element with no content isn't drawn** by HTML-in-canvas in
  Chromium 153 (a `<div>` with only a background stays transparent). Tests
  give such elements text.
- **Every GPU effect must draw what its CPU version draws.**
  `expansions.spec.mjs` compares the two pixel by pixel; the only allowed
  differences are documented per effect (threshold edges, premultiplied
  alpha on soft edges, different resamplers for HTML).
- **`@readonly` on a getter breaks the generated types** (`readonly get`
  is invalid TypeScript). A getter without a setter is read-only anyway.
- **With `html`, `<pixel-canvas>` is never an image**, supported or not:
  no `role="img"`, and no `<img>` inside it is treated as the source.
- **Effects mutate `ImageData` in place and must be deterministic per
  frame**: use `random(seed)`, never `Math.random()`, or a paused canvas
  flickers.

## Definition of done

- The element meets domkit's [principles](https://github.com/johnhenry/domkit/blob/main/docs/principles.md)
  (attributes and properties, `hidden`, every creation path, move and
  reconnect), and a browser test checks real pixels.
- JSDoc for the manifest (`@tag`, `@attr`, `@fires`, `@csspart`) and
  `npm run manifest` committed; the element's `readme.md` keeps Usage first,
  API (generated) after the guide, Notes last (`check-links.mjs` enforces it).
- New elements are in `test/browser/consistency.spec.mjs`'s `ELEMENTS` and
  the accessibility audit's markup.
- README's Effects table, the gallery (`demo/index.html`), and
  `CHANGELOG.md` updated in the same change.

## Non-goals

- No build step and no runtime dependencies: no-build users load modules
  from a CDN, and a bare import would force an import map on them.
- No TypeScript sources; declarations are generated from JSDoc.

## Releases

Bump `version` in `package.json` in a PR, add the `CHANGELOG.md` entry,
merge, then `gh release create v<version>`. The release event (or the tag
push) triggers `.github/workflows/publish.yml`, which is idempotent (skips
if the version is already on npm).
