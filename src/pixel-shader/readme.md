# pixel-shader

A pixel effect you write in GLSL, run on the GPU: put a fragment shader in
a `<script type="x-shader/x-fragment">` child and wrap the source in it.
It's fast enough for full-size live video, and it chains with every other
effect. Part of [pixelable](../../README.md).

## Usage

```html
<script type="module" src="https://esm.sh/@johnhenry/pixelable/global.mjs"></script>

<pixel-canvas fps="30">
  <pixel-shader strength="0.03">
    <script type="x-shader/x-fragment">
      vec2 offset = vec2(sin(v_uv.y * 30.0 + u_time * 4.0) * u_strength, 0.0);
      color = texture(u_image, v_uv + offset);
    </script>
    <img src="photo.jpg" alt="A photo, rippling" />
  </pixel-shader>
</pixel-canvas>
```

## Writing a shader

These are declared for you:

| Name | What it is |
|---|---|
| `u_image` | The image so far (`sampler2D`) |
| `u_resolution` | Its size in pixels (`vec2`) |
| `u_time` | Seconds on the `<pixel-canvas>` clock (`float`) |
| `u_frame` | The canvas's redraw count (`float`) |
| `v_uv` | This pixel's position, 0–1, with `0,0` at the **top left** (`vec2`) |
| `color` | The output (`vec4`) |

Any other uniform you use whose name starts with `u_` is declared as a
`float` and set from the attribute of the same name, with underscores as
hyphens: `u_line_width` reads `line-width="2"`. Changing the attribute
redraws.

Without a `main()`, your code is the body of one, with
`vec4 pixel = texture(u_image, v_uv)` read and `color = pixel` set
already, so a one-line effect is one line: `color = pixel.bgra;`. With
your own `main()` you write the whole thing, and with a `#version` line
nothing is added at all.

## As a named effect

`definePixelShader(name, code)` from `pixelable/shader.mjs` registers a
shader for the `effects` attribute and as a `<pixel-name>` element, with
its `u_` uniforms as parameters:

```js
import { definePixelShader } from "@johnhenry/pixelable/shader.mjs";

definePixelShader("vignette", `
  float d = distance(v_uv, vec2(0.5));
  color = vec4(pixel.rgb * smoothstep(0.8, u_size, d), pixel.a);
`);
```

```html
<pixel-canvas effects="vignette(0.3) palette(gameboy)">…</pixel-canvas>
```

## API

<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->

### Attributes

| Attribute | Property | Type | Description |
|---|---|---|---|
| `disabled` |  | `boolean` | Pass the image through unchanged. |

### Properties

| Property | Type | Description |
|---|---|---|
| `source` (read-only) | `string` | The shader's code: the text of its `<script type="x-shader/x-fragment">` child. |

### Methods

| Method | Description |
|---|---|
| `apply(image, context)` |  |

<!-- api:end -->

## Notes

- A shader that doesn't compile fires `error` on the `<pixel-canvas>`
  with the compiler's message, and the original content is shown.
- Every shader on the page shares one WebGL2 context, and compiled
  shaders are cached by their code. Where WebGL2 isn't available, shader
  effects fail the same way.
- The image goes to the GPU and back on every redraw. That's cheap at
  video sizes, but other effects still run on the CPU, so for big live
  video, do as much as possible in shaders.
