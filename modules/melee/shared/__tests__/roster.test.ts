import { describe, expect, it } from "vitest";
import { fighter, monsters, playerTypes } from "../content";
import { isCombatantDef } from "../roster";

describe("isCombatantDef", () => {
  it("given the built-in types, when they are checked, then each is a combatant", () => {
    const types = [...playerTypes, ...monsters];

    const rejected = types.filter((t) => !isCombatantDef(t));

    expect(rejected).toEqual([]);
  });

  it.each([
    ["not an object", "fighter"],
    ["no name", { ...fighter, name: undefined }],
    ["no stats", { ...fighter, stats: undefined }],
    [
      "a missing stat",
      { ...fighter, stats: { ...fighter.stats, speed: undefined } },
    ],
    [
      "a stat that is not a number",
      { ...fighter, stats: { ...fighter.stats, attack: "9" } },
    ],
    ["no HP", { ...fighter, stats: { ...fighter.stats, maxHp: 0 } }],
    ["no weapon", { ...fighter, weapon: undefined }],
    [
      "an unknown damage type",
      { ...fighter, weapon: { ...fighter.weapon, damageType: "love" } },
    ],
    [
      "a bad reach",
      { ...fighter, weapon: { ...fighter.weapon, columns: "all" } },
    ],
    ["skills that are not a list", { ...fighter, skills: "cleave" }],
    [
      "a skill with no effect",
      { ...fighter, skills: [{ id: "x", name: "X" }] },
    ],
  ])(
    "given a value with %s, when it is checked, then it is rejected",
    (_, value) => {
      const result = isCombatantDef(value);

      expect(result).toBe(false);
    },
  );
});
