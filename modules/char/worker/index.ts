import { Hono } from "hono";

// Char's API, mounted by the shared Worker at /api/char. The codex reads
// its content from code; this only reports that the module is deployed.
export const charApi = new Hono();

charApi.get("/health", (c) =>
  c.json({ module: "char", status: "ok", uses: ["content"] }),
);
