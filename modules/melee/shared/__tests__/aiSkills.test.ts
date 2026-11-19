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
  it("given a foe at 40 HP, when a plain attack is scored, then it matches targetScore without noise", () => {
    const { state, caster } = battle([], [foe(1)]);
    const target = unit(state, "player-1-0");
    target.hp = 40;
    const plain = 10;

    const value = hitValue(calm, caster, target, plain);

    expect(value).toBeCloseTo(targetScore(state, caster, target));
  });

  it("given a foe, when a hit of twice the damage is scored, then it is worth twice as much", () => {
    const { state, caster } = battle([], [foe(1)]);
    const target = unit(state, "player-1-0");

    const value = hitValue(calm, caster, target, 20);

    expect(value).toBeCloseTo(2 * hitValue(calm, caster, target, 10));
  });

  it("given a foe at 5 HP, when a hit that knocks it out is scored, then it adds the finish bonus", () => {
    const { state, caster } = battle([], [foe(1)]);
    const target = unit(state, "player-1-0");
    target.hp = 5;
    const without = hitValue({ ...calm, finish: 0 }, caster, target, 10);

    const value = hitValue(calm, caster, target, 10);

    expect(value).toBeCloseTo(without + 3);
  });

  it("given a foe, when a hit of no damage is scored, then it is worth nothing", () => {
    const { state, caster } = battle([], [foe(1)]);

    const value = hitValue(calm, caster, unit(state, "player-1-0"), 0);

    expect(value).toBe(0);
  });
});

describe("skillValue", () => {
  const heals = (hp: number) => {
    const { state, caster } = battle([heal], [foe(0)], [ally(1)]);
    unit(state, "enemy-1-0").hp = hp;
    return skillValue(state, caster, heal, at("enemy", 1));
  };
  /** An ally of the caster with haste already on. */
  const hasted = () => {
    const { state, caster } = battle([haste], [foe(1)], [ally(1)]);
    unit(state, "enemy-1-0").modifiers.push({
      stat: "speed",
      op: "mul",
      value: 1.5,
      source: haste.effect.type === "modify" ? haste.effect.modifier.name : "",
    });
    return { state, caster };
  };
  const quickens = (gauge: number) => {
    const { state, caster } = battle([quicken], [foe(0)], [ally(1)]);
    unit(state, "enemy-1-0").gauge = gauge;
    return skillValue(state, caster, quicken, at("enemy", 1));
  };

  it("given three foes in a plus, when a fireball on the middle is valued, then it counts every foe hit", () => {
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

  it("given an ally across the line from a foe, when a fireball would spill onto it, then it is worth less than one aimed past it", () => {
    // Aimed at the front cell, the plus spills onto the ally across the
    // line; aimed one row back, it still hits the foe but not the ally.
    const { state, caster } = battle([fireball], [foe(2)], [ally(2)]);

    const spilling = skillValue(state, caster, fireball, at("player", 2));

    expect(spilling).toBeLessThan(
      skillValue(state, caster, fireball, at("player", 2, 1)),
    );
  });

  it("given a meteor, when it is valued, then its cast time discounts it", () => {
    const { state, caster } = battle([meteor], [foe(2)]);
    const cost = skillCost(caster, meteor);
    const instant = { ...meteor, castTime: 0 };
    const plain = skillValue(state, caster, instant, at("player", 2));

    const delayed = skillValue(state, caster, meteor, at("player", 2));

    expect(delayed + cost).toBeCloseTo((plain + cost) * CAST_DISCOUNT);
  });

  it("given an ally at full HP, when healing it is valued, then it is not worth the cost", () => {
    const full = 100;

    const value = heals(full);

    expect(value).toBeLessThan(0);
  });

  it("given a badly and a lightly hurt ally, when healing them is valued, then the badly hurt one is worth more", () => {
    const lightly = heals(60);

    const badly = heals(20);

    expect(badly).toBeGreaterThan(lightly);
  });

  it.each([
    ["haste on an ally", haste, at("enemy", 1)],
    ["slow on a foe", slow, at("player", 1)],
  ])(
    "given %s, when it is valued, then it is worth the support value less its cost",
    (_, skill, cell) => {
      const { state, caster } = battle([haste, slow], [foe(1)], [ally(1)]);

      const value = skillValue(state, caster, skill, cell);

      expect(value).toBeCloseTo(SUPPORT_VALUE - skillCost(caster, skill));
    },
  );

  it("given an ally already hasted, when hasting it again is valued, then it is not worth the cost", () => {
    const { state, caster } = hasted();

    const value = skillValue(state, caster, haste, at("enemy", 1));

    expect(value).toBeLessThan(0);
  });

  it("given a hurt ally, when Regen on it is valued, then it is worth casting", () => {
    const { state, caster } = battle([regen], [foe(0)], [ally(1)]);
    unit(state, "enemy-1-0").hp = 30;

    const value = skillValue(state, caster, regen, at("enemy", 1));

    expect(value).toBeGreaterThan(0);
  });

  it("given a hurt ally with Regen running, when Regen on it is valued, then it is not refreshed", () => {
    const { state, caster } = battle([regen], [foe(0)], [ally(1)]);
    const hurt = unit(state, "enemy-1-0");
    hurt.hp = 30;
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

    const value = skillValue(state, caster, regen, at("enemy", 1));

    expect(value).toBeLessThan(0);
  });

  it("given a clean ally, when Cure on it is valued, then it is not worth the cost", () => {
    const { state, caster } = battle([cure], [foe(0)], [ally(1)]);

    const value = skillValue(state, caster, cure, at("enemy", 1));

    expect(value).toBeLessThan(0);
  });

  it("given a slowed ally, when Cure on it is valued, then it is worth casting", () => {
    const { state, caster } = battle([cure], [foe(0)], [ally(1)]);
    unit(state, "enemy-1-0").modifiers.push({
      stat: "speed",
      op: "mul",
      value: 0.5,
      source: "Slow",
      harmful: true,
    });

    const value = skillValue(state, caster, cure, at("enemy", 1));

    expect(value).toBeGreaterThan(0);
  });

  it("given an ally with an empty and a nearly full gauge, when Quicken is valued, then the empty gauge is worth more", () => {
    const nearly = quickens(800);

    const empty = quickens(0);

    expect(empty).toBeGreaterThan(nearly);
  });

  it("given no summon yet, when summoning on its own side is valued, then it is worth the summon value less its cost", () => {
    const { state, caster } = battle([summonImp], [foe(0)]);

    const value = skillValue(state, caster, summonImp, at("enemy", 0, 2));

    expect(value).toBeCloseTo(SUMMON_VALUE - skillCost(caster, summonImp));
  });

  it("given no summon yet, when summoning on the other side is valued, then it is not worth it", () => {
    const { state, caster } = battle([summonImp], [foe(0)]);

    const value = skillValue(state, caster, summonImp, at("player", 4, 2));

    expect(value).toBeLessThan(0);
  });

  it("given a summon already out, when summoning again is valued, then it is not worth it", () => {
    const { state, caster } = battle([summonImp], [foe(0)]);
    state.units.push({
      ...unit(state, "player-0-0"),
      id: "summon-1",
      side: "enemy",
      defId: "imp",
      summonedBy: caster.id,
    });

    const value = skillValue(state, caster, summonImp, at("enemy", 0, 2));

    expect(value).toBeLessThan(0);
  });

  it("given a melee foe, when heaving it back is valued, then it is worth casting", () => {
    const { state, caster } = battle(
      [upheaval],
      [place(def("brute", {}, sword), "player", 1)],
    );

    const value = skillValue(state, caster, upheaval, at("player", 1));

    expect(value).toBeGreaterThan(0);
  });

  it("given a ranged foe, when heaving it back is valued, then it is not worth it", () => {
    const { state, caster } = battle([upheaval], [foe(1)]);

    const value = skillValue(state, caster, upheaval, at("player", 1));

    expect(value).toBeLessThan(0);
  });
});

describe("skillCost", () => {
  it("given a caster at 50 HP, when a 50 MP, 10 HP skill is costed, then it charges a share of max MP and of current HP", () => {
    const { caster } = battle([], [foe(0)]);
    caster.hp = 50;
    const skill = { ...fireball, mpCost: 50, hpCost: 10 };

    const cost = skillCost(caster, skill);

    expect(cost).toBeCloseTo(0.5 * 0.5 + (2 * 10) / 50);
  });
});

describe("bestSkill", () => {
  it("given three foes in a row, when the best skill is picked, then the fireball is aimed where it hits them all", () => {
    // Only the plus around column 2 covers all three.
    const { state, caster } = battle([fireball], [foe(1), foe(2), foe(3)]);

    const best = bestSkill(state, caster);

    expect(best?.cell).toEqual(at("player", 2));
  });

  it("given only a heal and no one hurt, when the best skill is picked, then there is none", () => {
    const { state, caster } = battle([heal], [foe(0)]);

    const best = bestSkill(state, caster);

    expect(best).toBeNull();
  });

  it("given a caster without MP, when the best skill is picked, then there is none", () => {
    const { state, caster } = battle([fireball], [foe(0)]);
    caster.mp = 0;

    const best = bestSkill(state, caster);

    expect(best).toBeNull();
  });
});

describe("chooseCommand with skills", () => {
  it("given three foes in a row, when the caster chooses, then it casts the fireball rather than use its weak weapon", () => {
    const { state, caster } = battle([fireball], [foe(1), foe(2), foe(3)]);

    const command = chooseCommand(state, caster);

    expect(command).toEqual({
      type: "skill",
      skillId: fireball.id,
      cell: at("player", 2),
    });
  });

  it("given a badly hurt ally, when the caster chooses, then it heals rather than attack", () => {
    const { state, caster } = battle([heal], [foe(1)], [ally(1)]);
    caster.base.attack = 2;
    unit(state, "enemy-1-0").hp = 15;

    const command = chooseCommand(state, caster);

    expect(command).toMatchObject({
      type: "skill",
      skillId: heal.id,
      cell: at("enemy", 1),
    });
  });

  it("given a caster without MP, when it chooses, then it attacks", () => {
    const { state, caster } = battle([fireball], [foe(1), foe(2), foe(3)]);
    caster.mp = 0;

    const command = chooseCommand(state, caster);

    expect(command?.type).toBe("attack");
  });
});
