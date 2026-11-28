import { describe, expect, it } from "vitest";
import {
  act,
  advance,
  createBattle,
  validateCommand,
} from "@jforge/battle/engine/battle.ts";
import {
  coupDeGrace,
  fireball,
  poisonBlade,
  rogue,
  shadowstep,
  smite,
  smokeBomb,
  vanish,
} from "../content";
import { skillValue } from "@jforge/battle/engine/aiSkills.ts";
import { reachableTargets } from "@jforge/battle/engine/reach.ts";
import { skillVictims } from "@jforge/battle/engine/skills.ts";
import { offenseOf } from "@jforge/battle/engine/threat.ts";
import { POISON } from "@jforge/battle/engine/poison.ts";
import { previewDamage } from "@jforge/battle/engine/preview.ts";
import type { BattleState, Cell, Skill } from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

/** A plain strike skill, to see the coating work through strikes too. */
const stab: Skill = {
  id: "stab",
  name: "Stab",
  description: "",
  mpCost: 0,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 1 },
};

/** The Rogue (speed 50, player 2,0) is waiting; an ally stands at 0,0. */
function rogueTurn(): BattleState {
  const fast = {
    ...rogue,
    stats: { ...rogue.stats, speed: 50 },
    skills: [...(rogue.skills ?? []), stab],
  };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 2, 0),
          place(def("ally", { maxHp: 200, speed: 1 }), "player", 1, 0),
          place(
            def(
              "foe",
              { maxHp: 10_000, speed: 1, attack: 0 },
              {
                id: "far",
                name: "Far",
                columns: "any",
                depth: "any",
                damageType: "slash",
                kind: "ranged",
              },
            ),
            "enemy",
            2,
            0,
          ),
        ],
      },
      4,
    ),
  ).state;
}

const ROGUE = "player-2-0";
const ALLY = "player-1-0";
const FOE = "enemy-2-0";
const mine = (col: number, row: number): Cell => ({ side: "player", col, row });
const foeCell: Cell = { side: "enemy", col: 2, row: 0 };
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
const cast = (s: BattleState, skillId: string, cell: Cell) =>
  act(s, { type: "skill", skillId, cell });
const poisonOn = (s: BattleState) =>
  unit(s, FOE).statuses.find((st) => st.id === POISON.id);
/** Coats the blade, then waits for the Rogue's next turn. */
const coated = () =>
  advance(cast(rogueTurn(), poisonBlade.id, mine(2, 0)).state).state;

describe("Rogue skills", () => {
  it("given the Rogue, when its skills are listed, then they are Vanish, Shadowstep, Poison Blade, Smoke Bomb and Coup de Grâce", () => {
    const skills = rogue.skills;

    expect(skills).toEqual([
      vanish,
      shadowstep,
      poisonBlade,
      smokeBomb,
      coupDeGrace,
    ]);
  });
});

describe("Poison Blade", () => {
  it("given the Rogue, when it coats its blade, then the coat lasts 450 game time, for the MP cost", () => {
    const start = rogueTurn();

    const { state } = cast(start, poisonBlade.id, mine(2, 0));

    const coat = unit(state, ROGUE).statuses.find((s) => s.effect === "coat");
    expect(coat).toMatchObject({ harmful: false, interval: 450 });
    expect(unit(state, ROGUE).mp).toBe(rogue.stats.maxMp - poisonBlade.mpCost);
  });

  it("given an uncoated blade, when the Rogue attacks, then the foe isn't poisoned", () => {
    const start = rogueTurn();

    const { state } = act(start, { type: "attack", targetId: FOE });

    expect(poisonOn(state)).toBeUndefined();
  });

  it("given a coated blade, when the Rogue attacks, then the foe is poisoned as by the Viper's bite", () => {
    const start = coated();

    const { state } = act(start, { type: "attack", targetId: FOE });

    expect(poisonOn(state)).toMatchObject({
      amount: Math.round(POISON.power * rogue.stats.attack),
      ticksLeft: POISON.ticks,
    });
  });

  it.each([
    ["an uncoated", rogueTurn, false],
    ["a coated", coated, true],
  ])(
    "given %s blade, when the Rogue stabs, then the foe is poisoned: %s",
    (_, start, poisoned) => {
      const state = start();

      const { state: after } = cast(state, stab.id, foeCell);

      expect(poisonOn(after) !== undefined).toBe(poisoned);
    },
  );

  it("given a coated blade, when the AI values a stab, then it is worth more than uncoated", () => {
    const value = (s: BattleState) =>
      skillValue(s, unit(s, ROGUE), stab, foeCell);
    const plain = value(rogueTurn());

    const withCoat = value(coated());

    expect(withCoat).toBeGreaterThan(plain);
  });

  it("given the Rogue with and without Poison Blade, when its offense is weighed, then the blade adds threat", () => {
    const without = offenseOf({
      ...rogue,
      skills: [vanish, shadowstep, smokeBomb],
    });

    const offense = offenseOf(rogue);

    expect(offense).toBeGreaterThan(without);
  });
});

describe("Smoke Bomb", () => {
  const smoked = () => cast(rogueTurn(), smokeBomb.id, mine(1, 0)).state;

  it("given the Rogue, when it smoke-bombs itself, then it is refused", () => {
    const state = rogueTurn();

    const problem = validateCommand(state, unit(state, ROGUE), {
      type: "skill",
      skillId: smokeBomb.id,
      cell: mine(2, 0),
    });

    expect(problem).toBe("Smoke Bomb can't target its caster");
  });

  it("given an ally, when the Rogue smoke-bombs it, then the ally is hidden in smoke for 100", () => {
    const start = rogueTurn();

    const { state } = cast(start, smokeBomb.id, mine(1, 0));

    expect(unit(state, ALLY).statuses).toContainEqual(
      expect.objectContaining({ effect: "smoke", interval: 100 }),
    );
  });

  describe("on a smoked ally", () => {
    const state = smoked();
    const foe = unit(state, FOE);
    const caster = { ...foe, skills: [fireball, smite], mp: 100 };

    it("given a smoked ally, when an enemy's targets are listed, then the ally is not among them", () => {
      const picks = reachableTargets(state, foe).map((u) => u.id);

      expect(picks).toContain(ROGUE);
      expect(picks).not.toContain(ALLY);
    });

    it("given a smoked ally, when an enemy casts a single-target skill at it, then it can't be seen", () => {
      const problem = validateCommand(state, caster, {
        type: "skill",
        skillId: smite.id,
        cell: mine(1, 0),
      });

      expect(problem).toBe("ally can't be seen");
    });

    it("given a smoked ally, when an enemy's area skill is aimed at it, then it is among the victims", () => {
      const victims = skillVictims(state, caster, fireball, mine(1, 0));

      expect(victims.map((u) => u.id)).toContain(ALLY);
    });
  });
});

describe("Coup de Grâce", () => {
  /** The foe's HP set to `share` of its max, then the hit it takes. */
  function hitAt(share: number, skillId = coupDeGrace.id): number {
    const s = rogueTurn();
    const foe = unit(s, FOE);
    foe.hp = Math.round(foe.base.maxHp * share);
    const before = foe.hp;
    return before - unit(cast(s, skillId, foeCell).state, FOE).hp;
  }

  it("given a foe at half HP, when it is finished, then it hits like a plain stab", () => {
    const stabbed = hitAt(0.5, "stab");

    const hit = hitAt(0.5);

    expect(hit).toBe(stabbed);
  });

  it("given a foe below 30% HP, when it is finished, then it hits more than twice as hard as a stab", () => {
    const stabbed = hitAt(0.29, "stab");

    const hit = hitAt(0.29);

    expect(hit).toBeGreaterThan(2 * stabbed);
  });

  it("given a foe at 20% HP, when the finisher is previewed, then it shows the finishing hit", () => {
    const s = rogueTurn();
    const foe = unit(s, FOE);
    const healthy = previewDamage(unit(s, ROGUE), foe, coupDeGrace);
    foe.hp = Math.round(foe.base.maxHp * 0.2);

    const hurt = previewDamage(unit(s, ROGUE), foe, coupDeGrace);

    expect(hurt!.amount).toBeGreaterThan(2 * healthy!.amount);
  });
});
