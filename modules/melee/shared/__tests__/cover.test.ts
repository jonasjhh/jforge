import { describe, expect, it } from "vitest";
import { createBattle } from "@jforge/battle/engine/battle.ts";
import { fireball, firebolt, slow } from "../content";
import { exposedEnemies } from "@jforge/battle/engine/reach.ts";
import { validateSkill } from "@jforge/battle/engine/skills.ts";
import type {
  BattleState,
  Cell,
  Skill,
  Unit,
} from "@jforge/battle/engine/types.ts";
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
  it("given a column with a front-liner and one behind, when the exposed enemies are listed, then it is the front-most in each column", () => {
    const { state, caster } = battle();

    const exposed = exposedEnemies(state, caster);

    expect(names(exposed)).toEqual(["front", "lone"]);
  });

  it("given cover ignored, when the exposed enemies are listed, then it is everyone", () => {
    const { state, caster } = battle();

    const exposed = exposedEnemies(state, caster, true);

    expect(names(exposed)).toEqual(["behind", "front", "lone"]);
  });

  it("given the front-liner down, when the exposed enemies are listed, then the one behind is uncovered", () => {
    const { state, caster } = battle();
    state.units.find((u) => u.name === "front")!.hp = 0;

    const exposed = exposedEnemies(state, caster);

    expect(names(exposed)).toEqual(["behind", "lone"]);
  });
});

describe("cover against single-target skills", () => {
  const check = (skill: Skill, cell: Cell) => {
    const { state, caster } = battle();
    return validateSkill(state, caster, skill, cell);
  };

  it.each([
    ["a spell", firebolt],
    ["a debuff", slow],
  ])(
    "given a covered enemy, when %s is aimed at it, then it is behind cover",
    (_, skill) => {
      const problem = check(skill, at(1, 2));

      expect(problem).toBe("behind is behind cover");
    },
  );

  it.each([
    ["the front row", 1, 0, firebolt],
    ["a lone back row", 3, 2, firebolt],
    [
      "a covered cell, ignoring cover",
      1,
      2,
      { ...firebolt, ignoreCover: true },
    ],
    ["a covered cell, as an area", 1, 2, fireball],
  ])(
    "given an exposed or reachable enemy in %s, when a skill is aimed at it, then it is allowed",
    (_, col, row, skill) => {
      const problem = check(skill, at(col, row));

      expect(problem).toBeNull();
    },
  );
});
