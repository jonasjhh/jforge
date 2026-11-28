import { describe, expect, it } from "vitest";
import { createBattle } from "@jforge/battle";
import { jrpgUnit, openingBattleFor, previewOpeningBattle } from "../index";

const [archer, fighter, healer, mage] = [
  "melee-archer",
  "melee-fighter",
  "melee-healer",
  "melee-mage",
].map(jrpgUnit) as [
  ReturnType<typeof jrpgUnit>,
  ReturnType<typeof jrpgUnit>,
  ReturnType<typeof jrpgUnit>,
  ReturnType<typeof jrpgUnit>,
];

describe("previewOpeningBattle", () => {
  it("given the opening battle, when it is previewed, then the battle plays it to the end", () => {
    const summary = previewOpeningBattle();

    expect(summary.actions).toBeGreaterThan(0);
    expect(["player", "enemy", null]).toContain(summary.winner);
  });

  it("given one seed, when the opening battle is previewed twice, then both play out the same", () => {
    const first = previewOpeningBattle(5);

    const second = previewOpeningBattle(5);

    expect(second).toEqual(first);
  });
});

describe("openingBattleFor", () => {
  it.each([1, 2, 3, 4, 5])(
    "given %i party members, when the opening battle is set up, then each has a cell and the battle accepts it",
    (size) => {
      const party = [fighter, archer, mage, healer, fighter].slice(0, size);

      const setup = openingBattleFor(party);

      expect(() => createBattle(setup, 1)).not.toThrow();
      expect(setup.placements.filter((p) => p.side === "player")).toHaveLength(
        size,
      );
    },
  );

  it("given a mage, when the opening battle is set up, then it stands in its preferred row", () => {
    const [placed] = openingBattleFor([mage]).placements;

    expect(placed?.position.row).toBe(mage.preferredRow);
  });
});

describe("jrpg's Viper", () => {
  it("given jrpg's content, when its Viper is fielded, then it is immune to poison", () => {
    const viper = jrpgUnit("enemy-viper");

    const poison = viper.resistances?.poison;

    expect(poison).toBe(0);
  });
});
