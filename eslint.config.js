import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist",
      "**/dev-dist",
      ".wrangler",
      "coverage",
      "reports",
      ".stryker-tmp",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["worker/**/*.ts", "modules/*/worker/**/*.ts"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // Playwright tests run in Node; their fixtures' `use` is not a React hook.
    files: ["modules/*/e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: { globals: globals.node },
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  // The boundaries between packages (README.md, Layout): rules is logic
  // and never reads content; content is data for the games, not for char
  // or any one app; and no package but the root Worker imports char.
  {
    files: ["libs/rules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@jforge/content", "@jforge/content/*"],
              message:
                "rules never imports content: build fixtures in the test.",
            },
            {
              group: [
                "@jforge/char",
                "@jforge/char/*",
                "@jforge/jrpg",
                "@jforge/jrpg/*",
                "@jforge/autob",
                "@jforge/autob/*",
              ],
              message: "rules imports no app.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["libs/content/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@jforge/char",
                "@jforge/char/*",
                "@jforge/jrpg",
                "@jforge/jrpg/*",
                "@jforge/autob",
                "@jforge/autob/*",
              ],
              message: "content imports only rules and melee.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["modules/**/*.{ts,tsx}"],
    ignores: ["modules/char/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@jforge/char", "@jforge/char/*"],
              message:
                "char is a read-only codex: read @jforge/content instead.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
