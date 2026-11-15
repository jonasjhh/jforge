import { describe, expect, it } from "vitest";
import { previewOpeningBattle } from "../index";

describe("previewOpeningBattle", () => {
  it("plays the opening battle to the end with melee's engine", () => {
    const summary = previewOpeningBattle();
    expect(summary.actions).toBeGreaterThan(0);
    expect(["player", "enemy", null]).toContain(summary.winner);
  });

  it("is repeatable for a seed", () => {
    expect(previewOpeningBattle(5)).toEqual(previewOpeningBattle(5));
  });
});
