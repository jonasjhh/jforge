import { Hono } from "hono";
import { previewOpeningBattle } from "../shared";

// JRPG's API, mounted by the shared Worker at /api/jrpg.
export const jrpgApi = new Hono();

jrpgApi.get("/health", (c) =>
  c.json({
    module: "jrpg",
    status: "ok",
    uses: ["melee"],
    demo: previewOpeningBattle(),
  }),
);
