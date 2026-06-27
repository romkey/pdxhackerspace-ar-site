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
    files: ["server/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: ["server/server.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
  {
    files: ["public/js/**/*.js"],
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
