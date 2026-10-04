// Deliberately narrow: this package isn't style-linted. The one rule here
// catches the bug class that has shipped most often -- a reference to a
// variable that was never declared, which only throws (a ReferenceError
// under module strict mode) when that exact line runs: `react` in
// react-to-dom, `children` in dom-to-React, `cc`/`result` in code-color's
// highlighter, `loadStr` in infinite-combo (now infinite-combo-box), `genSVG` in xy-grapher.
import globals from "globals";

export default [
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: { "no-undef": "error" },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.mjs", "*.config.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
];
