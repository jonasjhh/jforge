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
  // The boundaries between packages (README.md, Layout): rules is logic,
  // the design format included, and imports nothing of jforge's; content
  // is data for the games, not for char or any one app; and no package
  // but the root Worker imports char. look (portraits, colours, font) is
  // the same for every game and imports nothing of jforge's.
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
            {
              group: ["@jforge/melee", "@jforge/melee/*"],
              message:
                "rules imports no game: the design format is rules' own.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["libs/battle/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@jforge/content",
                "@jforge/content/*",
                "@jforge/melee",
                "@jforge/melee/*",
                "@jforge/char",
                "@jforge/char/*",
                "@jforge/jrpg",
                "@jforge/jrpg/*",
                "@jforge/autob",
                "@jforge/autob/*",
              ],
              message:
                "battle imports only rules and look: each game brings its own units.",
            },
          ],
        },
      ],
    },
  },
  // Only melee's tests, which try the engine with its test units, reach
  // into battle's files; everything else uses its public entries.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["modules/melee/**/__tests__/**", "libs/battle/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@jforge/battle/engine/*", "@jforge/battle/screen/*"],
              message:
                "import @jforge/battle or @jforge/battle/screen, not their files.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["libs/look/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@jforge/*"],
              message: "look imports nothing of jforge's.",
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
