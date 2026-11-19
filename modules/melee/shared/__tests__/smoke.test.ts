import { describe, expect, it } from "vitest";
import { DIFFICULTIES, randomEncounter } from "../encounters";
import { playWithBot } from "./bot";

// Happy path only: a random encounter of each difficulty plays to the end
// without errors. Each rule has its own unit tests.
describe("smoke", () => {
  it.each(DIFFICULTIES)(
    "given a random %s encounter, when the bot plays it, then the battle ends",
    (difficulty) => {
      const encounter = randomEncounter(1000, difficulty);

      const steps = playWithBot(encounter, 1000);

      expect(steps.at(-1)!.state.phase.kind).toBe("over");
    },
  );
});
