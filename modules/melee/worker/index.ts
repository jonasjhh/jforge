import { Hono } from "hono";

// Melee's API, mounted by the shared Worker at /api/melee.
export const meleeApi = new Hono();

meleeApi.get("/health", (c) => c.json({ module: "melee", status: "ok" }));
