import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

const pkgs = (...names) =>
  names.flatMap((n) => [`@jforge/${n}`, `@jforge/${n}/*`]);
const ban = (names, message) => ({ group: pkgs(...names), message });
const NO_APP = ban(["char", "jrpg", "autob"], "a library imports no app.");
const NO_CHAR = ban(
  ["char"],
  "char is a read-only codex: read @jforge/content instead.",
);
const NO_DEEP_BATTLE = {
  group: ["@jforge/battle/engine/*", "@jforge/battle/screen/*"],
  message: "import @jforge/battle or @jforge/battle/screen, not their files.",
};

/**
 * rules is logic and the design format, and imports nothing of jforge's;
 * look is the same for every game and imports nothing either; battle
 * imports only rules and look, each game bringing its own units; content
 * is data for the games; autob shares nothing of melee or battle; no
 * package imports char; and only melee's tests reach into battle's files.
 */
function boundaries() {
  const block = (files, patterns, ignores = []) => ({
    files,
    ignores,
    rules: { "no-restricted-imports": ["error", { patterns }] },
  });
  return [
    block(
      ["libs/rules/**/*.{ts,tsx}"],
      [
        ban(
          ["content", "melee", "battle", "look", "char", "jrpg", "autob"],
          "rules imports nothing of jforge's: build fixtures in the test.",
        ),
      ],
    ),
    block(
      ["libs/look/**/*.{ts,tsx}"],
      [{ group: ["@jforge/*"], message: "look imports nothing of jforge's." }],
    ),
    block(
      ["libs/battle/**/*.{ts,tsx}"],
      [
        ban(
          ["content", "melee", "char", "jrpg", "autob"],
          "battle imports only rules and look: each game brings its own units.",
        ),
      ],
    ),
    block(
      ["libs/content/**/*.{ts,tsx}"],
      [
        NO_APP,
        ban(
          ["melee", "battle"],
          "content imports only rules: each game fields its own versions of it.",
        ),
      ],
    ),
    block(
      ["modules/melee/**/__tests__/**/*.{ts,tsx}"],
      [NO_CHAR, ban(["jrpg", "autob"], "melee imports no other game.")],
    ),
    block(
      ["modules/melee/**/*.{ts,tsx}"],
      [
        NO_CHAR,
        NO_DEEP_BATTLE,
        ban(["jrpg", "autob"], "melee imports no other game."),
      ],
      ["modules/melee/**/__tests__/**"],
    ),
    block(
      ["modules/jrpg/**/*.{ts,tsx}"],
      [
        NO_CHAR,
        NO_DEEP_BATTLE,
        ban(
          ["melee", "autob"],
          "jrpg imports no other game: it fields its own units.",
        ),
      ],
    ),
    block(
      ["modules/autob/**/*.{ts,tsx}"],
      [
        NO_CHAR,
        ban(
          ["melee", "battle", "jrpg"],
          "autob has its own fight: it imports nothing of melee, battle or jrpg.",
        ),
      ],
    ),
    block(
      ["modules/char/**/*.{ts,tsx}"],
      [
        NO_DEEP_BATTLE,
        ban(["jrpg", "autob"], "char reads content, not games."),
      ],
    ),
  ];
}

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
  // The boundaries between packages (README.md, Layout), one block per
  // package: a later block for the same file would replace an earlier one.
  ...boundaries(),
  eslintConfigPrettier,
);
