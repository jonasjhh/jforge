import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { hook, lancer, skewer } from "../content";
import type { BattleEvent, BattleState, Cell, Placement } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Lancer (column 2, front row) is waiting for a command. */
function lancerTurn(enemies: Placement[], seed = 1): BattleState {
  const fast = {
    ...lancer,
    stats: { ...lancer.stats, speed: 50, attack: 100 },
  };
  return advance(
    createBattle({ placements: [place(fast, "player", 2), ...enemies] }, seed),
  ).state;
}

const foe = (col: number, row: number, hp = 10_000) =>
  place(def(`foe${col}${row}`, { maxHp: hp, speed: 1 }), "enemy", col, row);
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const perform = (state: BattleState, skillId: string, cell: Cell) =>
  act(state, { type: "skill", skillId, cell });
const damaged = (events: BattleEvent[]) =>
  events
    .filter((e): e is Damage => e.type === "damage")
    .map((e) => e.unitId)
    .sort();
const unitAtId = (s: BattleState, id: string) =>
  s.units.find((u) => u.id === id)!;

describe("Lancer's spear", () => {
  it("reaches the front-most unit and the one behind it, but no deeper", () => {
    const state = lancerTurn([foe(2, 0), foe(2, 1), foe(2, 2)]);
    expect(() =>
      act(state, { type: "attack", targetId: "enemy-2-1" }),
    ).not.toThrow();
    expect(() => act(state, { type: "attack", targetId: "enemy-2-2" })).toThrow(
      /out of reach/,
    );
  });
});

describe("Skewer", () => {
  it("hits the target and the unit directly behind it, and nothing else", () => {
    const state = lancerTurn([
      foe(2, 0),
      foe(2, 1),
      foe(2, 2),
      foe(1, 1),
      foe(3, 0),
    ]);
    const { events, state: after } = perform(state, "skewer", at(2, 0));
    expect(damaged(events)).toEqual(["enemy-2-0", "enemy-2-1"]);
    expect(after.units[0]!.mp).toBe(lancer.stats.maxMp - skewer.mpCost);
  });

  it("can't be aimed past the spear's reach", () => {
    const state = lancerTurn([foe(2, 0), foe(2, 1), foe(2, 2)]);
    expect(() => perform(state, "skewer", at(2, 2))).toThrow(/out of reach/);
  });
});

describe("Hook", () => {
  it("pulls the target one row forward into an empty cell", () => {
    const state = lancerTurn([foe(2, 1)]);
    const { events, state: after } = perform(state, "hook", at(2, 1));
    expect(events).toContainEqual({
      type: "pushed",
      unitId: "enemy-2-1",
      from: { col: 2, row: 1 },
      to: { col: 2, row: 0 },
    });
    expect(unitAtId(after, "enemy-2-1").position).toEqual({ col: 2, row: 0 });
    expect(after.units[0]!.mp).toBe(lancer.stats.maxMp - hook.mpCost);
  });

  /** Damage to the hooked unit at 2,1 with or without a blocker in front. */
  const hookDamage = (blocker: Placement[], koBlocker = false) => {
    const state = lancerTurn([foe(2, 1), ...blocker]);
    if (koBlocker) unitAtId(state, "enemy-2-0").hp = 0;
    const { events } = perform(state, "hook", at(2, 1));
    const hit = events.find(
      (e): e is Damage => e.type === "damage" && e.unitId === "enemy-2-1",
    )!;
    return { amount: hit.amount, events };
  };

  it("crashes into a unit in the way for x1.5 damage instead of moving", () => {
    const free = hookDamage([]);
    const blocked = hookDamage([foe(2, 0)]);
    expect(blocked.events).toContainEqual({
      type: "collided",
      unitId: "enemy-2-1",
      blockerId: "enemy-2-0",
    });
    expect(blocked.events.some((e) => e.type === "pushed")).toBe(false);
    expect(Math.abs(blocked.amount - free.amount * 1.5)).toBeLessThanOrEqual(1);
  });

  it("treats a knocked-out unit in the way as blocking", () => {
    const { events } = hookDamage([foe(2, 0)], true);
    expect(events).toContainEqual({
      type: "collided",
      unitId: "enemy-2-1",
      blockerId: "enemy-2-0",
    });
  });

  it("crashes against the front edge when the target is already in front", () => {
    const state = lancerTurn([foe(2, 0)]);
    const { events, state: after } = perform(state, "hook", at(2, 0));
    expect(events).toContainEqual({ type: "collided", unitId: "enemy-2-0" });
    expect(unitAtId(after, "enemy-2-0").position).toEqual({ col: 2, row: 0 });
  });

  it("doesn't move a target it knocks out", () => {
    const state = lancerTurn([foe(2, 1, 5)]);
    const { events, state: after } = perform(state, "hook", at(2, 1));
    expect(events.some((e) => e.type === "knockedOut")).toBe(true);
    expect(events.some((e) => e.type === "pushed")).toBe(false);
    expect(unitAtId(after, "enemy-2-1").position).toEqual({ col: 2, row: 1 });
  });
});
