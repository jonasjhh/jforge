// A balance test: 300 whole battles. Mutation testing leaves out
// *.balance.test.ts files (see vitest.stryker.config.ts). Each difficulty
// has its own file so the three run in parallel.
import { describe, expect, it } from "vitest";
import { winRate } from "./encounterBalance";

describe("randomEncounter", () => {
  it("given hard encounters, when 300 are auto-played, then the party wins 45–70%", () => {
    const rate = winRate("hard");

    expect(rate).toBeGreaterThanOrEqual(0.45);
    expect(rate).toBeLessThanOrEqual(0.7);
  }, 30_000);
});
