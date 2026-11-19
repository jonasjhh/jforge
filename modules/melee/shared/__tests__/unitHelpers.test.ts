import { describe, expect, it } from "vitest";
import { createBattle } from "../battle";
import { fireball, mage } from "../content";
import { wouldKnockOut } from "../damage";
import { canAfford } from "../skills";
import type { BattleState, Status, Unit } from "../types";
import { dropReady, findSkill, restoreHp } from "../units";
import { def, place } from "./helpers";

function battle(): BattleState {
  return createBattle(
    {
      placements: [
        place(mage, "player", 0),
        place(def("foe", { maxHp: 50 }), "enemy", 0),
      ],
    },
    1,
  );
}

const status = (effect: Status["effect"], amount = 0): Status => ({
  id: effect,
  name: effect,
  effect,
  harmful: false,
  amount,
  interval: 1,
  nextTickAt: 1,
  ticksLeft: 1,
  sourceId: "x",
});

const foe = (s: BattleState): Unit => s.units[1]!;

describe("dropReady", () => {
  it("given a unit queued twice among others, when it is dropped, then only its entries go", () => {
    const s = battle();
    s.ready = ["a", "b", "a", "c"];

    dropReady(s, "a");

    expect(s.ready).toEqual(["b", "c"]);
  });
});

describe("restoreHp", () => {
  it.each([
    [40, 6, 6, 46],
    [46, 30, 4, 50],
    [50, 5, 0, 50],
  ])(
    "given a unit at %i of 50 HP, when %i is restored, then it gains %i and is at %i",
    (hp, amount, gained, after) => {
      const unit = foe(battle());
      unit.hp = hp;

      const result = restoreHp(unit, amount);

      expect(result).toBe(gained);
      expect(unit.hp).toBe(after);
    },
  );
});

describe("findSkill", () => {
  const caster = battle().units[0]!;

  it("given a mage, when Fireball is looked up, then it is the mage's own copy", () => {
    const skill = findSkill(caster, fireball.id);

    expect(skill).toBe(caster.skills.find((s) => s.id === fireball.id));
  });

  it("given a mage, when an unknown skill is looked up, then there is none", () => {
    const skill = findSkill(caster, "nope");

    expect(skill).toBeUndefined();
  });
});

describe("wouldKnockOut", () => {
  it.each([
    ["no protection", [], 20, true],
    ["no protection", [], 19, false],
    ["a 5 shield", [status("shield", 5)], 24, false],
    ["a 5 shield", [status("shield", 5)], 25, true],
    ["a ward", [status("ward")], 999, false],
  ])(
    "given a unit at 20 HP with %s, when a hit of %i is weighed, then it knocks out: %s",
    (_, statuses, damage, out) => {
      const unit = foe(battle());
      unit.hp = 20;
      unit.statuses = statuses;

      const result = wouldKnockOut(unit, damage);

      expect(result).toBe(out);
    },
  );

  it("given a unit at 0 HP, when no damage is weighed, then it doesn't knock out", () => {
    const unit = foe(battle());
    unit.hp = 0;

    const result = wouldKnockOut(unit, 0);

    expect(result).toBe(false);
  });
});

describe("canAfford", () => {
  const skill = { ...fireball, mpCost: 10, hpCost: 15 };

  it.each([
    [10, 16, true],
    [9, 16, false],
    [10, 15, false],
  ])(
    "given a skill costing 10 MP and 15 HP and a unit with %i MP and %i HP, when it is checked, then it is affordable: %s",
    (mp, hp, affordable) => {
      const unit = { ...foe(battle()), mp, hp };

      const result = canAfford(unit, skill);

      expect(result).toBe(affordable);
    },
  );
});
