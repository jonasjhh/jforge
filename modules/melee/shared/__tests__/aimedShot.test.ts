import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { aimedShot, archer, vanish } from "../content";
import { previewDamage } from "../preview";
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

/** The Archer (column 2, `row`) is waiting for a command. */
function archerTurn(enemies: Placement[], seed = 1, row = 1): BattleState {
  const fast = { ...archer, stats: { ...archer.stats, speed: 50 } };
  return advance(
    createBattle(
      { placements: [place(fast, "player", 2, row), ...enemies] },
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
/** Takes aim at `cell`, then lets the shot land. */
const shoot = (state: BattleState, cell: Cell) => {
  const aimed = act(state, { type: "skill", skillId: "aimed-shot", cell });
  const landed = advance(aimed.state);
  return { state: landed.state, events: [...aimed.events, ...landed.events] };
};
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

  it("hits x1.5 a normal attack, with the bow's pierce", () => {
    const state = archerTurn([foe(2, 0)]);
    const [self, target] = state.units;
    const shot = previewDamage(self!, target!, aimedShot)!.amount;
    const attack = previewDamage(self!, target!)!.amount;
    // Both are rounded, so allow one point either way.
    expect(Math.abs(shot - 1.5 * attack)).toBeLessThanOrEqual(1);
    expect(damage(shoot(state, at(2, 0)).events)[0]!.damageType).toBe("pierce");
  });

  it("takes aim first, then lands where the target stood", () => {
    const state = archerTurn([foe(4, 0), foe(4, 2)]);
    const aimed = act(state, {
      type: "skill",
      skillId: "aimed-shot",
      cell: at(4, 2),
    });
    expect(aimed.events.some((e) => e.type === "castStarted")).toBe(true);
    expect(damage(aimed.events)).toEqual([]);
    // The target steps aside before the shot lands: it misses.
    aimed.state.units.find((u) => u.id === "enemy-4-2")!.position = {
      col: 3,
      row: 2,
    };
    expect(damage(advance(aimed.state).events)).toEqual([]);
  });

  it("can't be used from the front row", () => {
    const state = archerTurn([foe(2, 0), foe(2, 2)], 1, 0);
    expect(skillCells(state, state.units[0]!, aimedShot)).toEqual([]);
    expect(() => shoot(state, at(2, 2))).toThrow(/hand-to-hand/);
  });

  it("can't find a stealthed enemy", () => {
    const state = archerTurn([foe(1, 0), foe(1, 2)]);
    const hidden = state.units.find((u) => u.id === "enemy-1-2")!;
    applyStatus(state, hidden, hidden, stealth, []);
    expect(() => shoot(state, at(1, 2))).toThrow(/can't be seen/);
  });
});

describe("a bow's late start", () => {
  it("starts the holder's gauge at the bow's startGauge", () => {
    const state = createBattle(
      { placements: [place(archer, "player", 2, 1), foe(2, 0)] },
      1,
    );
    expect(state.units[0]!.gauge).toBe(archer.weapon.startGauge);
    expect(archer.weapon.startGauge).toBeLessThan(0);
  });

  it("lets a slower unit act before the Archer at first", () => {
    const state = advance(
      createBattle(
        {
          placements: [
            place(archer, "player", 2, 1),
            place(def("slower", { speed: 10 }), "enemy", 2, 0),
          ],
        },
        1,
      ),
      { stopAfterAction: true },
    );
    const first = state.events.find(
      (e) => e.type === "attack" || e.type === "skill",
    );
    expect(first && "unitId" in first && first.unitId).toBe("enemy-2-0");
  });
});
