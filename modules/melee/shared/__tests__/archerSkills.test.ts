import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { aimedShot, archer, pinningShot, volley } from "../content";
import { skillValue } from "../aiSkills";
import { PIN_SLOW } from "../pin";
import { previewDamage } from "../preview";
import { effectiveStat } from "../stats";
import type { BattleEvent, BattleState, Cell, Placement } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Archer (column 2, `row`) is waiting for a command. */
function archerTurn(others: Placement[], row = 1): BattleState {
  const fast = { ...archer, stats: { ...archer.stats, speed: 50 } };
  return advance(
    createBattle({ placements: [place(fast, "player", 2, row), ...others] }, 1),
  ).state;
}
const foe = (col: number, row: number, maxHp = 10_000) =>
  place(def(`foe${col}${row}`, { maxHp, speed: 1 }), "enemy", col, row);
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const hitIds = (events: BattleEvent[]) =>
  events
    .filter((e): e is Damage => e.type === "damage")
    .map((e) => e.unitId)
    .sort();
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

describe("Archer skills", () => {
  it("are Aimed Shot, Volley and Pinning Shot, in that order", () => {
    expect(archer.skills).toEqual([aimedShot, volley, pinningShot]);
  });
});

describe("Volley", () => {
  it("aimed past the front row, hits every enemy in the 3x3 and no ally", () => {
    const state = archerTurn([
      place(def("ally", { speed: 1 }), "player", 2, 0),
      foe(1, 0),
      foe(2, 1),
      foe(3, 2),
      foe(0, 1),
    ]);
    const { events, state: after } = act(state, {
      type: "skill",
      skillId: volley.id,
      cell: at(2, 1),
    });
    expect(hitIds(events)).toEqual(["enemy-1-0", "enemy-2-1", "enemy-3-2"]);
    expect(unit(after, "player-2-1").mp).toBe(
      archer.stats.maxMp - volley.mpCost,
    );
  });

  it("aimed at the enemy front row, spills onto your own front row", () => {
    const state = archerTurn([
      place(def("ally", { speed: 1 }), "player", 2, 0),
      foe(2, 0),
    ]);
    const { events } = act(state, {
      type: "skill",
      skillId: volley.id,
      cell: at(2, 0),
    });
    expect(hitIds(events)).toEqual(["enemy-2-0", "player-2-0"]);
  });

  it("hits x0.5 each, and can't be used from the front row", () => {
    const state = archerTurn([foe(2, 0)]);
    const [self, target] = state.units;
    const shot = previewDamage(self!, target!, volley)!.amount;
    const plain = previewDamage(self!, target!)!.amount;
    expect(Math.abs(shot - plain * 0.5)).toBeLessThan(1);
    const front = archerTurn([foe(2, 0)], 0);
    expect(() =>
      act(front, { type: "skill", skillId: volley.id, cell: at(2, 0) }),
    ).toThrow(/front row/);
  });
});

describe("Pinning Shot", () => {
  it("hits x0.7 and slows a target that survives", () => {
    const state = archerTurn([foe(2, 0)]);
    const before = effectiveStat(unit(state, "enemy-2-0"), "speed");
    const { events, state: after } = act(state, {
      type: "skill",
      skillId: pinningShot.id,
      cell: at(2, 0),
    });
    expect(hitIds(events)).toEqual(["enemy-2-0"]);
    const pinned = unit(after, "enemy-2-0");
    expect(pinned.modifiers.map((m) => m.source)).toContain(PIN_SLOW.name);
    expect(effectiveStat(pinned, "speed")).toBeCloseTo(before * 0.7);
  });

  it("leaves no pin on a target it knocks out", () => {
    const state = archerTurn([foe(2, 0, 1)]);
    const { state: after } = act(state, {
      type: "skill",
      skillId: pinningShot.id,
      cell: at(2, 0),
    });
    expect(unit(after, "enemy-2-0").modifiers).toEqual([]);
  });

  it("is worth more to the AI on a foe not yet pinned", () => {
    const fresh = archerTurn([foe(2, 0)]);
    const pinned = archerTurn([foe(2, 0)]);
    unit(pinned, "enemy-2-0").modifiers.push({
      stat: "speed",
      op: "mul",
      value: 0.7,
      source: PIN_SLOW.name,
      harmful: true,
    });
    const value = (s: BattleState) =>
      skillValue(s, unit(s, "player-2-1"), pinningShot, at(2, 0));
    expect(value(fresh)).toBeGreaterThan(value(pinned));
  });
});
