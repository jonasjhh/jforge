import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import {
  fireball,
  poisonBlade,
  rogue,
  shadowstep,
  smite,
  smokeBomb,
  vanish,
} from "../content";
import { skillValue } from "../aiSkills";
import { reachableTargets } from "../reach";
import { skillVictims } from "../skills";
import { offenseOf } from "../threat";
import { POISON } from "../poison";
import type { BattleState, Cell, Skill } from "../types";
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
  it("are Vanish, Shadowstep, Poison Blade and Smoke Bomb", () => {
    expect(rogue.skills).toEqual([vanish, shadowstep, poisonBlade, smokeBomb]);
  });
});

describe("Poison Blade", () => {
  it("coats the Rogue's blade for 450 game time", () => {
    const { state } = cast(rogueTurn(), poisonBlade.id, mine(2, 0));
    const coat = unit(state, ROGUE).statuses.find((s) => s.effect === "coat");
    expect(coat).toMatchObject({ harmful: false, interval: 450 });
    expect(unit(state, ROGUE).mp).toBe(rogue.stats.maxMp - poisonBlade.mpCost);
  });

  it("makes weapon attacks poison, as the Viper's bite does", () => {
    const plain = act(rogueTurn(), { type: "attack", targetId: FOE }).state;
    expect(poisonOn(plain)).toBeUndefined();
    const after = act(coated(), { type: "attack", targetId: FOE }).state;
    expect(poisonOn(after)).toMatchObject({
      amount: Math.round(POISON.power * rogue.stats.attack),
      ticksLeft: POISON.ticks,
    });
  });

  it("poisons through strike skills too", () => {
    expect(poisonOn(cast(rogueTurn(), stab.id, foeCell).state)).toBeUndefined();
    expect(poisonOn(cast(coated(), stab.id, foeCell).state)).toBeDefined();
  });

  it("makes the AI value a coated strike more", () => {
    const value = (s: BattleState) =>
      skillValue(s, unit(s, ROGUE), stab, foeCell);
    expect(value(coated())).toBeGreaterThan(value(rogueTurn()));
  });

  it("raises the Rogue's threat like a venomous weapon", () => {
    const without = { ...rogue, skills: [vanish, shadowstep, smokeBomb] };
    expect(offenseOf(rogue)).toBeGreaterThan(offenseOf(without));
  });
});

describe("Smoke Bomb", () => {
  const smoked = () => cast(rogueTurn(), smokeBomb.id, mine(1, 0)).state;

  it("hides another ally, not the Rogue", () => {
    const state = rogueTurn();
    expect(
      validateCommand(state, unit(state, ROGUE), {
        type: "skill",
        skillId: smokeBomb.id,
        cell: mine(2, 0),
      }),
    ).toBe("Smoke Bomb can't target its caster");
    const ally = unit(smoked(), ALLY);
    expect(ally.statuses).toContainEqual(
      expect.objectContaining({ effect: "smoke", interval: 100 }),
    );
  });

  it("keeps enemies from singling the ally out, but areas still hit it", () => {
    const state = smoked();
    const foe = unit(state, FOE);
    const picks = reachableTargets(state, foe).map((u) => u.id);
    expect(picks).toContain(ROGUE);
    expect(picks).not.toContain(ALLY);
    const caster = { ...foe, skills: [fireball, smite], mp: 100 };
    expect(
      validateCommand(state, caster, {
        type: "skill",
        skillId: smite.id,
        cell: mine(1, 0),
      }),
    ).toBe("ally can't be seen");
    const victims = skillVictims(state, caster, fireball, mine(1, 0));
    expect(victims.map((u) => u.id)).toContain(ALLY);
  });
});
