import { describe, expect, it } from "vitest";
import { starterLibrary } from "@jforge/char/shared";
import { botRun } from "../bot";
import { ROUNDS, ROUNDS_PER_STAGE } from "../monsters";
import { roundsCleared, startRun } from "../run";

// The difficulty curve, measured by the simple bot of bot.ts: it should
// get well into the run but not through it, leaving the last stages to
// a player who plans better than it does.

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe("difficulty", () => {
  it("given the starter library, when the bot plays many runs, then it lasts past the third stage on average but rarely wins", () => {
    const library = starterLibrary();

    const cleared = SEEDS.map((seed) =>
      roundsCleared(botRun(startRun(library, seed))),
    );

    const mean = cleared.reduce((a, b) => a + b, 0) / cleared.length;
    const won = cleared.filter((c) => c === ROUNDS).length;
    expect(mean).toBeGreaterThan(3 * ROUNDS_PER_STAGE);
    expect(mean).toBeLessThan(ROUNDS - 1);
    expect(won).toBeLessThanOrEqual(SEEDS.length / 4);
  });
});
