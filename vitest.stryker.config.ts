// The Vitest config for mutation testing (stryker.config.json). It leaves out
// the balance tests: they play hundreds of whole battles, and Stryker would
// re-run them for every mutant they reach. `pnpm test` still runs them.
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(
  base,
  defineConfig({
    test: { exclude: ["**/*.balance.test.ts"] },
  }),
);
