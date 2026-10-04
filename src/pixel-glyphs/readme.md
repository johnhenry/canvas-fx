# pixel-glyphs

Turns the image into text characters: ASCII art, or any characters you
like. Each cell (8×12 working pixels by default) becomes the character
that best matches it, chosen from an atlas measured from the real font:
by **brightness** (how much ink a character has) or by **shape** (where its
ink is, so a diagonal edge gets `/`). Use it as `glyphs(…)` in a
[`<pixel-canvas>`](../pixel-canvas/readme.md)'s `effects`, or as this
element wrapped around the source. Part of [pixelable](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/pixelable/global.mjs"></script>

<!-- Colored characters, each cell in its own color -->
<pixel-canvas width="320" effects="glyphs(6x10)">
  <img src="photo.jpg" alt="A photo, in characters" />
</pixel-canvas>

<!-- A green terminal, on the GPU -->
<pixel-canvas width="320" gpu effects="glyphs(6x10, ramp, monospace, brightness, #33ff66, #001a08) crt()">
  <video src="clip.mp4" autoplay muted loop></video>
</pixel-canvas>

<!-- Line art: outlines, then characters chosen by shape -->
<pixel-canvas width="320" effects="outline(0.15, white, black) glyphs(8x12, ascii, monospace, shape, white)">
  <img src="photo.jpg" alt="A photo, as line art in characters" />
</pixel-canvas>
```

And the result as real text, from the `<pixel-canvas>`:

```js
const text = await document.querySelector("pixel-canvas").toText();
```

## Choosing characters

- **Characters:** a set by name (`ramp`: ` .:-=+*#%@`, the default for
  brightness; `ascii`: all 95 printable characters, the default for shape;
  `blocks`: ` ░▒▓█`; `binary`: ` 01`) or your own. Quote them when they
  include spaces, commas, or parentheses: `glyphs(8, ' .,:;')`.
- **Brightness** (the default) ignores the order you list them in: each
  character's ink is measured in the font, and a cell gets the character
  whose ink matches its brightness, stretched so the emptiest character is
  black and the inkiest is white.
- **Shape** compares where the light is in a cell (a 2 × 3 grid of
  regions) with where each character's ink is, and picks the closest. It
  reads back text drawn in the same font exactly, and gives edges matching
  strokes. It suits line art (try `outline()` first) more than photos.
- **Light is ink:** on a transparent or dark background, bright cells get
  inky characters. On a light `background`, it's the other way round.
- **Fonts:** any CSS font family. One that hasn't loaded yet is drawn in a
  fallback, then everything redraws when it arrives.

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `cell` |  | `string` | Cell size in working pixels, `8x12` (the default) or `10` for square. 2–32 a side. |
| `chars` |  | `string` | The characters to use: a set (`ramp`, the default for brightness; `ascii`, the default for shape; `blocks`; `binary`) or your own, quoted when it has spaces or commas (`' .:#'`). |
| `font` |  | `string` | A CSS font family. Default `monospace`. |
| `mode` |  | `"brightness" \| "shape"` | Choose by how much ink a character has (`brightness`, the default) or where its ink is (`shape`: lines and edges get matching characters). |
| `color` |  | `string` | The ink: `source` (each cell's own color, the default) or a CSS color. |
| `background` |  | `string` | Behind the characters: `none` (transparent, the default) or a CSS color. On a light background, darkness is inked. |
| `disabled` |  | `boolean` | Pass the image through unchanged. |

<!-- api:end -->

## Notes

- Cells are in working pixels, so the `<pixel-canvas>`'s `width` sets the
  number of columns: `width="320"` with 8-pixel cells is 40 columns.
- Runs on the GPU too (`<pixel-canvas gpu>`), drawing what the CPU draws;
  `toText()` takes one CPU frame to know the characters.
- Over live HTML (`<pixel-canvas html>`), the page becomes text and stays
  usable.
