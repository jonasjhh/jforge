import { defineConfig, devices } from "@playwright/test";
import { WORKER_E2E_INSPECTOR_PORT, WORKER_E2E_PORT } from "./tooling/ports";

// End-to-end smoke tests: the built app (`pnpm build` first) served by the
// real Worker, driven in Chromium on a phone-sized screen. Each module keeps
// its own in modules/<name>/e2e. Rules belong in unit tests, not here.
const baseURL = `http://127.0.0.1:${WORKER_E2E_PORT}`;

export default defineConfig({
  testDir: "modules",
  testMatch: "*/e2e/**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `wrangler dev --ip 127.0.0.1 --port ${WORKER_E2E_PORT} --inspector-port ${WORKER_E2E_INSPECTOR_PORT}`,
    url: `${baseURL}/api/melee/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
