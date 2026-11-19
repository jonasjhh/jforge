import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", ".stryker-tmp/**"],
    coverage: {
      // `pnpm coverage` reports every module's source, tested or not.
      include: ["modules/*/{shared,src,worker}/**/*.{ts,tsx}", "worker/**"],
      exclude: ["**/__tests__/**", "**/*.d.ts", "**/main.tsx"],
      reporter: ["text-summary", "text", "json-summary", "html"],
      // Floors just under the coverage there is; `pnpm coverage` (and so CI)
      // fails if a change drops below them. Raise them as tests are added.
      thresholds: { statements: 97, branches: 94, functions: 97, lines: 98 },
    },
  },
});
