import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { cleave, fighter } from "../content";
import { skillVictims } from "../skills";
import type { BattleEvent, BattleState, Cell, Placement } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Fighter (column 2, front row) is waiting for a command. */
function fighterTurn(enemies: Placement[], seed = 1): BattleState {
  const fast = { ...fighter, stats: { ...fighter.stats, speed: 50 } };
  return advance(
    createBattle({ placements: [place(fast, "player", 2), ...enemies] }, seed),
  ).state;
}

const foe = (col: number, row: number) =>
  place(def(`foe${col}${row}`, { maxHp: 10_000, speed: 1 }), "enemy", col, row);
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const cast = (state: BattleState, cell: Cell) =>
  act(state, { type: "skill", skillId: "cleave", cell });
const damage = (events: BattleEvent[]) =>
  events.filter((e): e is Damage => e.type === "damage");

describe("Cleave", () => {
  it("given enemies beside, behind and two columns off, when the fighter cleaves, then only those the sword reaches are hit and the MP is spent", () => {
    const state = fighterTurn([
      foe(1, 0),
      foe(2, 0),
      foe(3, 0),
      foe(2, 1), // covered by 2,0
      foe(4, 0), // two columns away
    ]);

    const { events, state: after } = cast(state, at(2, 0));

    expect(
      damage(events)
        .map((e) => e.unitId)
        .sort(),
    ).toEqual(["enemy-1-0", "enemy-2-0", "enemy-3-0"]);
    expect(after.units[0]!.mp).toBe(fighter.stats.maxMp - cleave.mpCost);
  });

  it.each([
    [1, 0],
    [3, 0],
  ])(
    "given two enemies in reach, when the cleave is aimed at %i,%i, then both are hit",
    (col, row) => {
      const state = fighterTurn([foe(1, 0), foe(3, 0)]);

      const victims = skillVictims(
        state,
        state.units[0]!,
        cleave,
        at(col, row),
      );

      expect(victims.map((u) => u.id).sort()).toEqual([
        "enemy-1-0",
        "enemy-3-0",
      ]);
    },
  );

  it("given one enemy, when it is cleft, then it takes more than half, but less than, a normal attack", () => {
    const attack = act(fighterTurn([foe(2, 0)]), {
      type: "attack",
      targetId: "enemy-2-0",
    });
    const full = damage(attack.events)[0]!.amount;

    const cleft = cast(fighterTurn([foe(2, 0)]), at(2, 0));

    const swing = damage(cleft.events)[0]!.amount;
    expect(swing).toBeLessThan(full);
    expect(swing).toBeGreaterThan(full * 0.5);
  });

  it("given an enemy covered by another, when the cleave is aimed at it, then it is out of reach", () => {
    const state = fighterTurn([foe(2, 0), foe(2, 1)]);

    const aim = () => cast(state, at(2, 1));

    expect(aim).toThrow(/out of reach/);
  });

  it("given a sword, when the fighter cleaves, then the strike is slash damage", () => {
    const state = fighterTurn([foe(2, 0)]);

    const { events } = cast(state, at(2, 0));

    expect(damage(events)[0]!.damageType).toBe("slash");
  });
});
