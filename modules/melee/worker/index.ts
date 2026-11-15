import { Hono } from "hono";
import { strike, type Fighter } from "../shared";

// Melee's API, mounted by the shared Worker at /api/melee.
export const meleeApi = new Hono();

const sparring: [Fighter, Fighter] = [
  { name: "Duelist", attack: 6, defense: 2, hp: 12 },
  { name: "Training dummy", attack: 0, defense: 1, hp: 10 },
];

meleeApi.get("/health", (c) =>
  c.json({ module: "melee", status: "ok", demo: strike(...sparring) }),
);
