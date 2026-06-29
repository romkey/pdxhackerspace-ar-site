import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "markers/**",
      "public/markers/**",
      "public/js/config.template.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["server/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    // Browser ES modules (loaded via <script type="module"> / import).
    // Named .js (not .mjs) so static hosts always serve a JS MIME type.
    files: [
      "public/js/wall-clock.js",
      "public/js/clock-faces.js",
      "public/js/printer-source.js",
      "public/js/printer-hud.js",
      "public/js/printer-view.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        localStorage: "readonly",
      },
    },
  },
  {
    files: ["public/js/**/*.js"],
    ignores: [
      "public/js/wall-clock.js",
      "public/js/clock-faces.js",
      "public/js/printer-source.js",
      "public/js/printer-hud.js",
      "public/js/printer-view.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        location: "readonly",
        AFRAME: "readonly",
      },
    },
  },
];
