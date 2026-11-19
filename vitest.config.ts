import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", ".stryker-tmp/**"],
    coverage: {
      // `pnpm coverage` reports every module's source, tested or not.
      include: ["modules/*/{shared,src,worker}/**/*.{ts,tsx}", "worker/**"],
      exclude: ["**/__tests__/**", "**/*.d.ts", "**/main.tsx"],
      reporter: ["text-summary", "text", "json-summary", "html"],
    },
  },
});
