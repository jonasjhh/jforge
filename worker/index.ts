import { Hono } from "hono";
import { jrpgApi } from "@jforge/jrpg/worker";
import { meleeApi } from "@jforge/melee/worker";

// Bindings of the shared Worker. Module bindings (Durable Objects, secrets)
// are added here as modules need them.
interface Env {
  ASSETS: Fetcher;
}

// Every module's API, mounted at /api/<name>. Adding a module means adding
// it here (and to package.json dependencies).
const modules = {
  melee: meleeApi,
  jrpg: jrpgApi,
} as const;

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) =>
  c.json({ status: "ok", modules: Object.keys(modules) }),
);

for (const [name, api] of Object.entries(modules)) {
  app.route(`/api/${name}`, api);
}

app.notFound(async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404 || !acceptsHtml(c.req.raw)) return asset;

  // Single-page fallback: a deep link inside a module (/melee/anything)
  // loads that module's app; anything else loads the landing page.
  const first = url.pathname.split("/")[1] ?? "";
  const fallback = first in modules ? `/${first}/` : "/";
  return c.env.ASSETS.fetch(new Request(new URL(fallback, url), c.req.raw));
});

function acceptsHtml(request: Request): boolean {
  return (
    request.method === "GET" &&
    (request.headers.get("accept") ?? "").includes("text/html")
  );
}

export default app;
