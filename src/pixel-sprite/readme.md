# pixel-sprite

Pixel art written as text, right in your HTML: one character per pixel,
one line per row, and a key saying what each character's color is. Blank
lines separate animation frames, played at `fps`. It shows itself as a
crisp, scaled-up image, and it can be the source of a
[`<pixel-canvas>`](../pixel-canvas/readme.md), so every
[effect](../../README.md#effects) applies. Part of [pixelable](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/pixelable/global.mjs"></script>

<pixel-sprite colors=". transparent; # #3b2d1f; o gold" fps="6" alt="A spinning coin">
  .####.
  #oooo#
  #oooo#
  .####.

  ..##..
  .#oo#.
  .#oo#.
  ..##..
</pixel-sprite>
```

## Colors

`colors` is either a key of `character color` pairs separated by `;`
(`". transparent; # black; o gold"`, any CSS color), or a named palette
whose colors are numbered `0`–`9`, then `a`–`z`. The default is `pico-8`,
so hex digits are the 16 PICO-8 colors:

```html
<pixel-sprite alt="A heart">
  .8.8.
  88888
  .888.
  ..8..
</pixel-sprite>
```

`.` is transparent unless the key says otherwise, and so is any character
not in the key. Indentation and blank lines around the art are ignored;
rows shorter than the widest are padded with transparency.

## Animation

With more than one frame and an `fps`, it plays. `play()`, `pause()`, the
`paused` attribute (write it to start paused), and `play`/`pause` events
work as on [`<frame-timer>`](https://github.com/johnhenry/domkit/blob/main/src/frame-timer/readme.md), and so do the
`--play`, `--pause`, and `--toggle` invoker commands. `frame` is the frame
showing (settable, wrapping), and `frames` is how many there are.
`framechange` fires whenever it redraws. For visitors who prefer reduced
motion, it doesn't animate on its own; `play()` still works.

## Effects

Inside a `<pixel-canvas>` it's a source like an image. Small sources are
enlarged without smoothing, so a 16×16 sprite at `width="128"` stays
sharp, and the canvas redraws on every frame:

```html
<pixel-canvas width="96" effects="crt()">
  <pixel-sprite fps="4" alt="A blinking face">…</pixel-sprite>
</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `colors` |  | `string` | What each character means: `char color` pairs separated by `;` (`. transparent; # black; o gold`), or a named palette whose colors are numbered `0`–`9` then `a`–`z` (`pico-8`, the default; `gameboy`; `1bit`; …). `.` is transparent unless you say otherwise. |
| `fps` |  | `number` | Play the frames at this rate. Without it (or with one frame), it's still. |
| `paused` | `paused` | `boolean` | Whether the animation is paused. Reflects; write it in markup to start paused. |
| `alt` |  | `string` | A text alternative, as on `<img>`. An empty `alt` marks it decorative. |

### Properties

| Property | Type | Description |
|---|---|---|
| `canvas` (read-only) | `HTMLCanvasElement` | The canvas it's drawn on (in the shadow root), at one pixel per character. |
| `frames` (read-only) | `number` | How many frames there are. |
| `frame` | `number` | The frame showing, from 0. Setting it shows that frame (wrapping). |
| `paused` (read-only) | `boolean` | Whether the animation is paused. |
| `width` | `number` |  |
| `height` | `number` |  |

### Methods

| Method | Description |
|---|---|
| `play()` | Play the frames (at `fps`). |
| `pause()` | Pause on the current frame. |

### Events

| Event | Description |
|---|---|
| `play` | The animation started or resumed. |
| `pause` | The animation paused. |
| `framechange` | It was redrawn: the frame advanced, or its pixels or colors changed. |

### CSS custom properties

| Property | Description |
|---|---|
| `--pixel-sprite-scale` | How many screen pixels each sprite pixel takes. Default 8. |

<!-- api:end -->

## Styling

| Selector | Matches |
|---|---|
| `pixel-sprite` | The element: an inline block, `--pixel-sprite-scale` (default 8) screen pixels per sprite pixel, unless you size it |
| `pixel-sprite::part(canvas)` | The canvas it's drawn on |

Its text isn't displayed; only the drawing is.

## Notes

- Like an `<img>`, `alt` names it (`role="img"`), and an empty or missing
  `alt` marks it decorative.
- Editing the text or `colors` redraws it.
