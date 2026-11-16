import { describe, expect, it } from "vitest";
import { createBattle, content } from "../../../shared";
import {
  resistanceKind,
  resistanceNote,
  resultText,
  unitName,
} from "../labels";

describe("resistanceKind", () => {
  it("names what a damage multiplier means", () => {
    expect([0, 0.5, 1, 1.5].map(resistanceKind)).toEqual([
      "immune",
      "resist",
      undefined,
      "weak",
    ]);
  });

  it("gives the log's note for each", () => {
    expect([0, 0.5, 1, 1.5].map(resistanceNote)).toEqual([
      " (immune)",
      " (resisted)",
      "",
      " (weak)",
    ]);
  });
});

describe("resultText", () => {
  it("is from the player's point of view", () => {
    expect(resultText("player")).toBe("Victory!");
    expect(resultText("enemy")).toBe("Defeat…");
    expect(resultText(null)).toBe("Draw");
  });
});

describe("unitName", () => {
  it("is the unit's name, or the id for an unknown unit", () => {
    const state = createBattle(
      {
        placements: [
          { def: content.mage, side: "player", position: { col: 0, row: 0 } },
          { def: content.slime, side: "enemy", position: { col: 0, row: 0 } },
        ],
      },
      1,
    );
    expect(unitName(state, "enemy-0-0")).toBe("Slime");
    expect(unitName(state, "ghost")).toBe("ghost");
  });
});
