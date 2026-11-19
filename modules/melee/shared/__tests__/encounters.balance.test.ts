// A balance test: hundreds of whole battles. Mutation testing leaves out
// *.balance.test.ts files (see vitest.stryker.config.ts).
import { describe, expect, it } from "vitest";
import { randomEncounter, type Difficulty } from "../encounters";
import { simulate } from "../simulate";

describe("randomEncounter", () => {
  it("keeps each difficulty in its win-rate band", () => {
    const winRate = (difficulty: Difficulty) => {
      const runs = 300;
      let wins = 0;
      for (let seed = 0; seed < runs; seed++) {
        if (
          simulate(randomEncounter(seed, difficulty), seed + 1000).winner ===
          "player"
        )
          wins++;
      }
      return wins / runs;
    };
    expect(winRate("easy")).toBeGreaterThanOrEqual(0.95);
    expect(winRate("normal")).toBeGreaterThanOrEqual(0.8);
    expect(winRate("normal")).toBeLessThanOrEqual(0.95);
    expect(winRate("hard")).toBeGreaterThanOrEqual(0.45);
    expect(winRate("hard")).toBeLessThanOrEqual(0.7);
    // 900 whole battles with skills on both sides take a few seconds.
  }, 30_000);
});
