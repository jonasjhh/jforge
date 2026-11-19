import { Hono } from "hono";
import { ROUNDS } from "../shared";

// Autob's API, mounted by the shared Worker at /api/autob.
export const autobApi = new Hono();

autobApi.get("/health", (c) =>
  c.json({
    module: "autob",
    status: "ok",
    uses: ["melee", "char"],
    rounds: ROUNDS,
  }),
);
