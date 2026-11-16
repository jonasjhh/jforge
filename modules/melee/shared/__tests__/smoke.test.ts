import { describe, expect, it } from "vitest";
import { DIFFICULTIES, randomEncounter } from "../encounters";
import { playWithBot } from "./bot";

// Happy path only: a random encounter of each difficulty plays to the end
// without errors. Each rule has its own unit tests.
describe("smoke", () => {
  it.each(DIFFICULTIES)("plays a %s encounter to the end", (difficulty) => {
    const steps = playWithBot(randomEncounter(1000, difficulty), 1000);
    expect(steps.at(-1)!.state.phase.kind).toBe("over");
  });
});
