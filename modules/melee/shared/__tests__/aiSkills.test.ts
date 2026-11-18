import { describe, expect, it } from "vitest";
import { chooseCommand, targetScore } from "../ai";
import {
  CAST_DISCOUNT,
  SUMMON_VALUE,
  SUPPORT_VALUE,
  bestSkill,
  hitValue,
  skillCost,
  skillValue,
} from "../aiSkills";
import { createBattle } from "../battle";
import {
  cure,
  fireball,
  haste,
  heal,
  meteor,
  quicken,
  regen,
  slow,
  summonImp,
  upheaval,
  sword,
} from "../content";
import type {
  BattleState,
  Cell,
  Placement,
  Skill,
  TargetingProfile,
  Unit,
} from "../types";
import { def, place } from "./helpers";

const calm: TargetingProfile = {
  near: 1,
  finish: 3,
  wounded: 1,
  soft: 1,
  noise: 0,
};

/** The AI caster stands at enemy 2,2 with the given skills, facing `foes`. */
function battle(
  skills: Skill[],
  foes: Placement[],
  allies: Placement[] = [],
): { state: BattleState; caster: Unit } {
  const caster = {
    ...def("caster", { magic: 20, maxMp: 100 }),
    skills,
    targeting: calm,
  };
  const state = createBattle(
    { placements: [place(caster, "enemy", 2, 2), ...allies, ...foes] },
    1,
  );
  return { state, caster: unit(state, "enemy-2-2") };
}

const unit = (state: BattleState, id: string) =>
  state.units.find((u) => u.id === id)!;
const at = (side: Cell["side"], col: number, row = 0): Cell => ({
  side,
  col,
  row,
});
const foe = (col: number, row = 0) =>
  place(def(`foe${col}`), "player", col, row);
const ally = (col: number, row = 0) =>
  place(def(`ally${col}`), "enemy", col, row);

describe("hitValue", () => {
  it("scores a plain attack the way targetScore does without noise", () => {
    const { state, caster } = battle([], [foe(1)]);
    const target = unit(state, "player-1-0");
    target.hp = 40;
    const plain = 10;
    expect(hitValue(calm, caster, target, plain)).toBeCloseTo(
      targetScore(state, caster, target),
    );
  });

  it("scales with damage compared with a plain attack", () => {
    const { state, caster } = battle([], [foe(1)]);
    const target = unit(state, "player-1-0");
    expect(hitValue(calm, caster, target, 20)).toBeCloseTo(
      2 * hitValue(calm, caster, target, 10),
    );
  });

  it("adds the finish bonus when the hit would knock the target out", () => {
    const { state, caster } = battle([], [foe(1)]);
    const target = unit(state, "player-1-0");
    target.hp = 5;
    const without = hitValue({ ...calm, finish: 0 }, caster, target, 10);
    expect(hitValue(calm, caster, target, 10)).toBeCloseTo(without + 3);
  });

  it("is worth nothing when nothing gets through", () => {
    const { state, caster } = battle([], [foe(1)]);
    expect(hitValue(calm, caster, unit(state, "player-1-0"), 0)).toBe(0);
  });
});

describe("skillValue", () => {
  it("counts every foe an area skill hits", () => {
    // Each foe alone, with the plus aimed so it is caught the same way.
    const aim = at("player", 2);
    const alone = (col: number) => {
      const one = battle([fireball], [foe(col)]);
      const cost = skillCost(one.caster, fireball);
      return skillValue(one.state, one.caster, fireball, aim) + cost;
    };
    const three = battle([fireball], [foe(1), foe(2), foe(3)]);
    const cost = skillCost(three.caster, fireball);
    const triple = skillValue(three.state, three.caster, fireball, aim) + cost;
    expect(triple).toBeCloseTo(alone(1) + alone(2) + alone(3));
  });

  it("counts allies caught in the area against it", () => {
    // Aimed at the front cell, the plus spills onto the ally across the
    // line; aimed one row back, it still hits the foe but not the ally.
    const { state, caster } = battle([fireball], [foe(2)], [ally(2)]);
    expect(skillValue(state, caster, fireball, at("player", 2))).toBeLessThan(
      skillValue(state, caster, fireball, at("player", 2, 1)),
    );
  });

  it("discounts a delayed skill", () => {
    const { state, caster } = battle([meteor], [foe(2)]);
    const cost = skillCost(caster, meteor);
    const plain = skillValue(
      state,
      caster,
      { ...meteor, castTime: 0 },
      at("player", 2),
    );
    expect(
      skillValue(state, caster, meteor, at("player", 2)) + cost,
    ).toBeCloseTo((plain + cost) * CAST_DISCOUNT);
  });

  it("values healing an ally by how much it restores and how hurt it is", () => {
    const { state, caster } = battle([heal], [foe(0)], [ally(1)]);
    const hurt = unit(state, "enemy-1-0");
    hurt.hp = 100;
    expect(skillValue(state, caster, heal, at("enemy", 1))).toBeLessThan(0);
    hurt.hp = 60;
    const lightly = skillValue(state, caster, heal, at("enemy", 1));
    hurt.hp = 20;
    const badly = skillValue(state, caster, heal, at("enemy", 1));
    expect(badly).toBeGreaterThan(lightly);
  });

  it("buffs allies and debuffs foes, once", () => {
    const { state, caster } = battle([haste, slow], [foe(1)], [ally(1)]);
    const cost = skillCost(caster, haste);
    expect(skillValue(state, caster, haste, at("enemy", 1))).toBeCloseTo(
      SUPPORT_VALUE - cost,
    );
    expect(skillValue(state, caster, slow, at("player", 1))).toBeCloseTo(
      SUPPORT_VALUE - cost,
    );
    unit(state, "enemy-1-0").modifiers.push({
      stat: "speed",
      op: "mul",
      value: 1.5,
      source: haste.effect.type === "modify" ? haste.effect.modifier.name : "",
    });
    expect(skillValue(state, caster, haste, at("enemy", 1))).toBeLessThan(0);
  });

  it("does not refresh a status that is already running", () => {
    const { state, caster } = battle([regen], [foe(0)], [ally(1)]);
    const hurt = unit(state, "enemy-1-0");
    hurt.hp = 30;
    const fresh = skillValue(state, caster, regen, at("enemy", 1));
    expect(fresh).toBeGreaterThan(0);
    if (regen.effect.type !== "status") throw new Error("regen is a status");
    hurt.statuses.push({
      id: regen.effect.status.id,
      name: "Regen",
      effect: "heal",
      harmful: false,
      amount: 5,
      interval: 30,
      nextTickAt: 30,
      ticksLeft: 3,
      sourceId: caster.id,
    });
    expect(skillValue(state, caster, regen, at("enemy", 1))).toBeLessThan(0);
  });

  it("cleanses only an ally that carries something harmful", () => {
    const { state, caster } = battle([cure], [foe(0)], [ally(1)]);
    expect(skillValue(state, caster, cure, at("enemy", 1))).toBeLessThan(0);
    unit(state, "enemy-1-0").modifiers.push({
      stat: "speed",
      op: "mul",
      value: 0.5,
      source: "Slow",
      harmful: true,
    });
    expect(skillValue(state, caster, cure, at("enemy", 1))).toBeGreaterThan(0);
  });

  it("quickens an ally more the emptier its gauge", () => {
    const { state, caster } = battle([quicken], [foe(0)], [ally(1)]);
    const friend = unit(state, "enemy-1-0");
    friend.gauge = 0;
    const empty = skillValue(state, caster, quicken, at("enemy", 1));
    friend.gauge = 800;
    const nearly = skillValue(state, caster, quicken, at("enemy", 1));
    expect(empty).toBeGreaterThan(nearly);
  });

  it("summons until the limit, on its own side only", () => {
    const { state, caster } = battle([summonImp], [foe(0)]);
    const value = skillValue(state, caster, summonImp, at("enemy", 0, 2));
    expect(value).toBeCloseTo(SUMMON_VALUE - skillCost(caster, summonImp));
    expect(
      skillValue(state, caster, summonImp, at("player", 4, 2)),
    ).toBeLessThan(0);
    state.units.push({
      ...unit(state, "player-0-0"),
      id: "summon-1",
      side: "enemy",
      defId: "imp",
      summonedBy: caster.id,
    });
    expect(
      skillValue(state, caster, summonImp, at("enemy", 0, 2)),
    ).toBeLessThan(0);
  });

  it("heaves a melee foe back, not a ranged one", () => {
    const melee = battle(
      [upheaval],
      [place(def("brute", {}, sword), "player", 1)],
    );
    expect(
      skillValue(melee.state, melee.caster, upheaval, at("player", 1)),
    ).toBeGreaterThan(0);
    const ranged = battle([upheaval], [foe(1)]);
    expect(
      skillValue(ranged.state, ranged.caster, upheaval, at("player", 1)),
    ).toBeLessThan(0);
  });
});

describe("skillCost", () => {
  it("charges a share of max MP and of current HP", () => {
    const { caster } = battle([], [foe(0)]);
    caster.hp = 50;
    const skill = { ...fireball, mpCost: 50, hpCost: 10 };
    expect(skillCost(caster, skill)).toBeCloseTo(0.5 * 0.5 + (2 * 10) / 50);
  });
});

describe("bestSkill", () => {
  it("aims an area skill where it hits the most foes", () => {
    // Only the plus around column 2 covers all three.
    const { state, caster } = battle([fireball], [foe(1), foe(2), foe(3)]);
    expect(bestSkill(state, caster)?.cell).toEqual(at("player", 2));
  });

  it("is null when no skill is worth its cost", () => {
    const { state, caster } = battle([heal], [foe(0)]);
    expect(bestSkill(state, caster)).toBeNull();
  });

  it("is null when the caster cannot afford anything", () => {
    const { state, caster } = battle([fireball], [foe(0)]);
    caster.mp = 0;
    expect(bestSkill(state, caster)).toBeNull();
  });
});

describe("chooseCommand with skills", () => {
  it("casts a spell when it is worth more than its weak weapon", () => {
    const { state, caster } = battle([fireball], [foe(1), foe(2), foe(3)]);
    expect(chooseCommand(state, caster)).toEqual({
      type: "skill",
      skillId: fireball.id,
      cell: at("player", 2),
    });
  });

  it("heals a badly hurt ally rather than attack", () => {
    const { state, caster } = battle([heal], [foe(1)], [ally(1)]);
    caster.base.attack = 2;
    unit(state, "enemy-1-0").hp = 15;
    expect(chooseCommand(state, caster)).toMatchObject({
      type: "skill",
      skillId: heal.id,
      cell: at("enemy", 1),
    });
  });

  it("attacks when out of MP", () => {
    const { state, caster } = battle([fireball], [foe(1), foe(2), foe(3)]);
    caster.mp = 0;
    expect(chooseCommand(state, caster)?.type).toBe("attack");
  });
});
