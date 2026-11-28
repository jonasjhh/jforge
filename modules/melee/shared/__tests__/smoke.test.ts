import { describe, expect, it } from "vitest";
import { meleeEncounter } from "../arena";
import { DIFFICULTIES } from "@jforge/battle/engine/encounters.ts";
import { playWithBot } from "./bot";

// Happy path only: a random encounter of each difficulty plays to the end
// without errors. Each rule has its own unit tests.
describe("smoke", () => {
  it.each(DIFFICULTIES)(
    "given a random %s encounter, when the bot plays it, then the battle ends",
    (difficulty) => {
      const encounter = meleeEncounter(1000, difficulty);

      const steps = playWithBot(encounter, 1000);

      expect(steps.at(-1)!.state.phase.kind).toBe("over");
    },
  );
});
