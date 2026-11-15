import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { LANDING_DEV_PORT, WORKER_DEV_PORT } from "../tooling/ports";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// The landing page is a plain site at /, not a PWA: each module installs as
// its own app instead. It builds into dist/ itself, next to the modules'
// dist/<name>/ folders, so it must not empty dist/ (the root build does).
export default defineConfig({
  build: {
    outDir: path.join(repoRoot, "dist"),
    emptyOutDir: false,
  },
  server: {
    port: LANDING_DEV_PORT,
    strictPort: true,
    proxy: {
      "/api": { target: `http://localhost:${WORKER_DEV_PORT}`, ws: true },
    },
  },
  plugins: [react()],
});
