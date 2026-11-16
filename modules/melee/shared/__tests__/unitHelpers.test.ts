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
  it("takes only that unit out of the ready queue", () => {
    const s = battle();
    s.ready = ["a", "b", "a", "c"];
    dropReady(s, "a");
    expect(s.ready).toEqual(["b", "c"]);
  });
});

describe("restoreHp", () => {
  it("heals up to max HP and returns what was gained", () => {
    const unit = foe(battle());
    unit.hp = 40;
    expect(restoreHp(unit, 6)).toBe(6);
    expect(unit.hp).toBe(46);
    expect(restoreHp(unit, 30)).toBe(4);
    expect(unit.hp).toBe(50);
    expect(restoreHp(unit, 5)).toBe(0);
  });
});

describe("findSkill", () => {
  it("finds the unit's own copy of a skill by id", () => {
    const caster = battle().units[0]!;
    expect(findSkill(caster, fireball.id)).toBe(
      caster.skills.find((s) => s.id === fireball.id),
    );
    expect(findSkill(caster, "nope")).toBeUndefined();
  });
});

describe("wouldKnockOut", () => {
  it("is true when the hit reaches the target's HP", () => {
    const unit = foe(battle());
    unit.hp = 20;
    expect(wouldKnockOut(unit, 20)).toBe(true);
    expect(wouldKnockOut(unit, 19)).toBe(false);
  });

  it("counts a shield first and never finishes a warded target", () => {
    const unit = foe(battle());
    unit.hp = 20;
    unit.statuses = [status("shield", 5)];
    expect(wouldKnockOut(unit, 24)).toBe(false);
    expect(wouldKnockOut(unit, 25)).toBe(true);
    unit.statuses = [status("ward")];
    expect(wouldKnockOut(unit, 999)).toBe(false);
  });

  it("is false for no damage", () => {
    const unit = foe(battle());
    unit.hp = 0;
    expect(wouldKnockOut(unit, 0)).toBe(false);
  });
});

describe("canAfford", () => {
  it("needs the MP, and more HP than an HP cost", () => {
    const unit = foe(battle());
    const skill = { ...fireball, mpCost: 10, hpCost: 15 };
    expect(canAfford({ ...unit, mp: 10, hp: 16 }, skill)).toBe(true);
    expect(canAfford({ ...unit, mp: 9, hp: 16 }, skill)).toBe(false);
    expect(canAfford({ ...unit, mp: 10, hp: 15 }, skill)).toBe(false);
  });
});
