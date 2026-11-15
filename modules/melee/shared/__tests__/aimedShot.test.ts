import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { aimedShot, archer, vanish } from "../content";
import { skillCells } from "../skills";
import { applyStatus } from "../status";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Placement,
  StatusDef,
} from "../types";
import { def, place } from "./helpers";

const stealth = (vanish.effect as { type: "status"; status: StatusDef }).status;
type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Archer (column 2, middle row) is waiting for a command. */
function archerTurn(enemies: Placement[], seed = 1): BattleState {
  const fast = { ...archer, stats: { ...archer.stats, speed: 50 } };
  return advance(
    createBattle(
      { placements: [place(fast, "player", 2, 1), ...enemies] },
      seed,
    ),
  ).state;
}

const foe = (col: number, row: number, extra = {}) =>
  place(
    def(`foe${col}${row}`, { maxHp: 10_000, speed: 1 }),
    "enemy",
    col,
    row,
    extra,
  );
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const shoot = (state: BattleState, cell: Cell) =>
  act(state, { type: "skill", skillId: "aimed-shot", cell });
const damage = (events: BattleEvent[]) =>
  events.filter((e): e is Damage => e.type === "damage");

describe("Aimed Shot", () => {
  it("hits an enemy covered by the front line, which an attack can't", () => {
    const state = archerTurn([foe(4, 0), foe(4, 2)]);
    expect(() => act(state, { type: "attack", targetId: "enemy-4-2" })).toThrow(
      /out of reach/,
    );
    const { events, state: after } = shoot(state, at(4, 2));
    expect(damage(events).map((e) => e.unitId)).toEqual(["enemy-4-2"]);
    expect(after.units[0]!.mp).toBe(archer.stats.maxMp - aimedShot.mpCost);
  });

  it("can be aimed at every visible enemy, in any column or row", () => {
    const state = archerTurn([foe(0, 0), foe(0, 1), foe(0, 2), foe(4, 1)]);
    const cells = skillCells(state, state.units[0]!, aimedShot)
      .map((c) => `${c.col},${c.row}`)
      .sort();
    expect(cells).toEqual(["0,0", "0,1", "0,2", "4,1"]);
  });

  it("hits as hard as a normal attack, with the bow's pierce", () => {
    const attack = act(archerTurn([foe(2, 0)]), {
      type: "attack",
      targetId: "enemy-2-0",
    });
    const shot = shoot(archerTurn([foe(2, 0)]), at(2, 0));
    const a = damage(attack.events)[0]!;
    const s = damage(shot.events)[0]!;
    expect(s.amount).toBe(a.amount);
    expect(s.damageType).toBe("pierce");
  });

  it("can't find a stealthed enemy", () => {
    const state = archerTurn([foe(1, 0), foe(1, 2)]);
    const hidden = state.units.find((u) => u.id === "enemy-1-2")!;
    applyStatus(state, hidden, hidden, stealth, []);
    expect(() => shoot(state, at(1, 2))).toThrow(/can't be seen/);
  });
});
