import { Hono } from "hono";
import { openingBattle, playTurn } from "../shared";

// JRPG's API, mounted by the shared Worker at /api/jrpg.
export const jrpgApi = new Hono();

jrpgApi.get("/health", (c) =>
  c.json({
    module: "jrpg",
    status: "ok",
    uses: ["melee"],
    demo: playTurn(openingBattle),
  }),
);
