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
  it("strikes every enemy the sword can reach, and no one covered", () => {
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

  it("hits the same enemies wherever it is aimed", () => {
    const state = fighterTurn([foe(1, 0), foe(3, 0)]);
    const fighterUnit = state.units[0]!;
    const names = (cell: Cell) =>
      skillVictims(state, fighterUnit, cleave, cell)
        .map((u) => u.id)
        .sort();
    expect(names(at(1, 0))).toEqual(["enemy-1-0", "enemy-3-0"]);
    expect(names(at(3, 0))).toEqual(names(at(1, 0)));
  });

  it("hits each enemy for less than a normal attack", () => {
    const attack = act(fighterTurn([foe(2, 0)]), {
      type: "attack",
      targetId: "enemy-2-0",
    });
    const cleft = cast(fighterTurn([foe(2, 0)]), at(2, 0));
    const full = damage(attack.events)[0]!.amount;
    const swing = damage(cleft.events)[0]!.amount;
    expect(swing).toBeLessThan(full);
    expect(swing).toBeGreaterThan(full * 0.5);
  });

  it("can't be aimed at an enemy out of reach", () => {
    const state = fighterTurn([foe(2, 0), foe(2, 1)]);
    expect(() => cast(state, at(2, 1))).toThrow(/out of reach/);
  });

  it("is a slash strike, using the sword's type", () => {
    const { events } = cast(fighterTurn([foe(2, 0)]), at(2, 0));
    expect(damage(events)[0]!.damageType).toBe("slash");
  });
});
