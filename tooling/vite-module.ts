import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import type { ModuleMeta } from "./module-meta";
import { WORKER_DEV_PORT } from "./ports";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// Shared Vite config for every module: served at /<name>/, built into
// dist/<name>/ for the shared Worker, and installable as its own PWA whose
// scope is limited to /<name>/.
export function moduleViteConfig(meta: ModuleMeta) {
  const base = `/${meta.name}/`;
  return defineConfig({
    base,
    build: {
      outDir: path.join(repoRoot, "dist", meta.name),
      emptyOutDir: true,
    },
    server: {
      port: meta.devPort,
      strictPort: true,
      proxy: {
        "/api": { target: `http://localhost:${WORKER_DEV_PORT}`, ws: true },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "apple-touch-icon.png"],
        manifest: {
          id: base,
          name: meta.title,
          short_name: meta.title,
          description: meta.description,
          start_url: base,
          scope: base,
          display: "standalone",
          orientation: "portrait",
          theme_color: meta.themeColor,
          background_color: meta.themeColor,
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512x512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
          // The API and WebSocket upgrades must always reach the Worker.
          navigateFallbackDenylist: [/^\/api\//],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
  });
}
