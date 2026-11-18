import { describe, expect, it } from "vitest";
import { createBattle } from "../battle";
import { fireball, firebolt, slow } from "../content";
import { exposedEnemies } from "../reach";
import { validateSkill } from "../skills";
import type { BattleState, Cell, Skill, Unit } from "../types";
import { def, place } from "./helpers";

/**
 * The caster stands at enemy 2,2; the party has a front-liner at 1,0 with
 * one behind it at 1,2, and a lone back-liner at 3,2.
 */
function battle(): { state: BattleState; caster: Unit } {
  const caster = def("caster", { magic: 20, maxMp: 100 });
  const state = createBattle(
    {
      placements: [
        place(caster, "enemy", 2, 2),
        place(def("front"), "player", 1, 0),
        place(def("behind"), "player", 1, 2),
        place(def("lone"), "player", 3, 2),
      ],
    },
    1,
  );
  return { state, caster: state.units.find((u) => u.id === "enemy-2-2")! };
}

const at = (col: number, row: number): Cell => ({ side: "player", col, row });
const names = (units: Unit[]) => units.map((u) => u.name).sort();

describe("exposedEnemies", () => {
  it("is the front-most enemy in each column", () => {
    const { state, caster } = battle();
    expect(names(exposedEnemies(state, caster))).toEqual(["front", "lone"]);
  });

  it("is every enemy when cover is ignored", () => {
    const { state, caster } = battle();
    expect(names(exposedEnemies(state, caster, true))).toEqual([
      "behind",
      "front",
      "lone",
    ]);
  });

  it("uncovers the one behind once the one in front is down", () => {
    const { state, caster } = battle();
    state.units.find((u) => u.name === "front")!.hp = 0;
    expect(names(exposedEnemies(state, caster))).toEqual(["behind", "lone"]);
  });
});

describe("cover against single-target skills", () => {
  const check = (skill: Skill, cell: Cell) => {
    const { state, caster } = battle();
    return validateSkill(state, caster, skill, cell);
  };

  it("refuses a spell at a covered enemy", () => {
    expect(check(firebolt, at(1, 2))).toBe("behind is behind cover");
  });

  it("refuses a debuff at a covered enemy", () => {
    expect(check(slow, at(1, 2))).toBe("behind is behind cover");
  });

  it("lets a spell hit an exposed enemy in any column, even the back row", () => {
    expect(check(firebolt, at(1, 0))).toBeNull();
    expect(check(firebolt, at(3, 2))).toBeNull();
  });

  it("lets a skill that ignores cover single out a covered enemy", () => {
    expect(check({ ...firebolt, ignoreCover: true }, at(1, 2))).toBeNull();
  });

  it("still lets an area land on a covered enemy", () => {
    expect(check(fireball, at(1, 2))).toBeNull();
  });
});
