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
  it("given an enemy covered by the front line, when the Archer attacks it, then it is out of reach", () => {
    const state = archerTurn([foe(4, 0), foe(4, 2)]);

    const attack = () => act(state, { type: "attack", targetId: "enemy-4-2" });

    expect(attack).toThrow(/out of reach/);
  });

  it("given an enemy covered by the front line, when the Archer shoots it, then only it is hit, for the MP cost", () => {
    const state = archerTurn([foe(4, 0), foe(4, 2)]);

    const { events, state: after } = shoot(state, at(4, 2));

    expect(damage(events).map((e) => e.unitId)).toEqual(["enemy-4-2"]);
    expect(after.units[0]!.mp).toBe(archer.stats.maxMp - aimedShot.mpCost);
  });

  it("given enemies in every column and row, when the shot's cells are listed, then every visible enemy can be aimed at", () => {
    const state = archerTurn([foe(0, 0), foe(0, 1), foe(0, 2), foe(4, 1)]);

    const cells = skillCells(state, state.units[0]!, aimedShot)
      .map((c) => `${c.col},${c.row}`)
      .sort();

    expect(cells).toEqual(["0,0", "0,1", "0,2", "4,1"]);
  });

  it("given a foe, when the shot is previewed, then it hits x1.5 a normal attack", () => {
    const state = archerTurn([foe(2, 0)]);
    const [self, target] = state.units;
    const attack = previewDamage(self!, target!)!.amount;

    const shot = previewDamage(self!, target!, aimedShot)!.amount;

    // Both are rounded, so allow one point either way.
    expect(Math.abs(shot - 1.5 * attack)).toBeLessThanOrEqual(1);
  });

  it("given a foe, when the shot lands, then it deals the bow's pierce", () => {
    const state = archerTurn([foe(2, 0)]);

    const { events } = shoot(state, at(2, 0));

    expect(damage(events)[0]!.damageType).toBe("pierce");
  });

  it("given a foe, when the Archer takes aim, then the cast starts and nothing is hit yet", () => {
    const state = archerTurn([foe(4, 0), foe(4, 2)]);

    const aimed = act(state, {
      type: "skill",
      skillId: "aimed-shot",
      cell: at(4, 2),
    });

    expect(aimed.events.some((e) => e.type === "castStarted")).toBe(true);
    expect(damage(aimed.events)).toEqual([]);
  });

  it("given the target steps aside while aimed at, when the shot lands, then it misses", () => {
    const state = archerTurn([foe(4, 0), foe(4, 2)]);
    const aimed = act(state, {
      type: "skill",
      skillId: "aimed-shot",
      cell: at(4, 2),
    });
    aimed.state.units.find((u) => u.id === "enemy-4-2")!.position = {
      col: 3,
      row: 2,
    };

    const { events } = advance(aimed.state);

    expect(damage(events)).toEqual([]);
  });

  it("given the Archer in the front row, when the shot's cells are listed, then there are none", () => {
    const state = archerTurn([foe(2, 0), foe(2, 2)], 1, 0);

    const cells = skillCells(state, state.units[0]!, aimedShot);

    expect(cells).toEqual([]);
  });

  it("given the Archer in the front row, when it shoots, then it is refused as hand-to-hand", () => {
    const state = archerTurn([foe(2, 0), foe(2, 2)], 1, 0);

    const fire = () => shoot(state, at(2, 2));

    expect(fire).toThrow(/hand-to-hand/);
  });

  it("given a stealthed enemy, when the Archer shoots it, then it can't be seen", () => {
    const state = archerTurn([foe(1, 0), foe(1, 2)]);
    const hidden = state.units.find((u) => u.id === "enemy-1-2")!;
    applyStatus(state, hidden, hidden, stealth, []);

    const fire = () => shoot(state, at(1, 2));

    expect(fire).toThrow(/can't be seen/);
  });
});

describe("a bow's late start", () => {
  it("given an Archer, when the battle is created, then its gauge starts at the bow's negative startGauge", () => {
    const placements = [place(archer, "player", 2, 1), foe(2, 0)];

    const state = createBattle({ placements }, 1);

    expect(state.units[0]!.gauge).toBe(archer.weapon.startGauge);
    expect(archer.weapon.startGauge).toBeLessThan(0);
  });

  it("given a slower enemy, when the battle runs to the first action, then the enemy acts before the Archer", () => {
    const start = createBattle(
      {
        placements: [
          place(archer, "player", 2, 1),
          place(def("slower", { speed: 10 }), "enemy", 2, 0),
        ],
      },
      1,
    );

    const state = advance(start, { stopAfterAction: true });

    const first = state.events.find(
      (e) => e.type === "attack" || e.type === "skill",
    );
    expect(first && "unitId" in first && first.unitId).toBe("enemy-2-0");
  });
});
