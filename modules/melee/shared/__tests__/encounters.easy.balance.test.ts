// A balance test: 300 whole battles. Mutation testing leaves out
// *.balance.test.ts files (see vitest.stryker.config.ts). Each difficulty
// has its own file so the three run in parallel.
import { describe, expect, it } from "vitest";
import { winRate } from "./encounterBalance";

describe("randomEncounter", () => {
  it("given easy encounters, when 300 are auto-played, then the party wins at least 95%", () => {
    const rate = winRate("easy");

    expect(rate).toBeGreaterThanOrEqual(0.95);
  }, 30_000);
});
