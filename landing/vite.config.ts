import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { LANDING_DEV_PORT, WORKER_DEV_PORT } from "../tooling/ports.ts";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const themeColor = "#0d0907";

// The landing page at /. It is installable as the "jforge" app, alongside
// each module installing as its own app. It builds into dist/ itself, next
// to the modules' dist/<name>/ folders, so it must not empty dist/ (the
// root build does).
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
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "jforge",
        short_name: "jforge",
        description:
          "Game forge: design classes and skills, then play them in battle games.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: themeColor,
        background_color: themeColor,
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
        // The service worker's scope is the whole site, but it owns only the
        // landing page. Cache only files at the top of dist/ and in assets/,
        // never a module's dist/<name>/ folder (it may already be built).
        globPatterns: [
          "*.{js,css,html,png,svg,ico,webmanifest}",
          "assets/**/*",
        ],
        // Answer only navigations to / itself. A module's pages (/melee/...)
        // go to that module's own service worker or the network, and the
        // API always reaches the Worker.
        navigateFallbackAllowlist: [/^\/$/],
        navigateFallbackDenylist: [/^\/api\//],
        // The module icons shown on the landing cards, so it looks right
        // offline too.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/[^/]+\/pwa-192x192\.png$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "module-icons" },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
