import { describe, expect, it } from "vitest";
import { content, createBattle } from "@jforge/melee/shared";
import {
  defaultParty,
  openingBattleFor,
  partyFrom,
  previewOpeningBattle,
} from "../index";

const { archer, fighter, healer, mage, slime } = content;

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

describe("partyFrom", () => {
  it("is the default heroes when nothing was imported", () => {
    expect(partyFrom({ party: [], monsters: [slime] })).toBe(defaultParty);
  });

  it("is the imported party, at most five", () => {
    expect(partyFrom({ party: [mage], monsters: [] })).toEqual([mage]);
    const many = [fighter, archer, mage, healer, fighter, archer];
    expect(partyFrom({ party: many, monsters: [] })).toHaveLength(5);
  });
});

describe("openingBattleFor", () => {
  it.each([1, 2, 3, 4, 5])("gives %i party members a cell each", (size) => {
    const party = [fighter, archer, mage, healer, fighter].slice(0, size);
    const setup = openingBattleFor(party);
    expect(() => createBattle(setup, 1)).not.toThrow();
    expect(setup.placements.filter((p) => p.side === "player")).toHaveLength(
      size,
    );
  });

  it("stands each member in its preferred row", () => {
    const [placed] = openingBattleFor([mage]).placements;
    expect(placed?.position.row).toBe(mage.preferredRow);
  });
});
