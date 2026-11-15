import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { chronomancer, cure, haste, quicken, slow } from "../content";
import { effectiveStat } from "../stats";
import type { BattleState, Cell } from "../types";
import { def, place } from "./helpers";

// The Chronomancer (speed 50) acts first at time 20. The ally and the
// enemy have speed 10 (first turn at 100); the enemy never hurts anyone.
function chronoTurn(): BattleState {
  const chrono = {
    ...chronomancer,
    stats: { ...chronomancer.stats, speed: 50 },
  };
  return advance(
    createBattle(
      {
        placements: [
          place(chrono, "player", 4, 2),
          place(def("ally", { speed: 10 }), "player", 0),
          place(def("foe", { speed: 10, attack: 0, maxHp: 1000 }), "enemy", 0),
        ],
      },
      1,
    ),
  ).state;
}

const ally: Cell = { side: "player", col: 0, row: 0 };
const self: Cell = { side: "player", col: 4, row: 2 };
const foeCell: Cell = { side: "enemy", col: 0, row: 0 };
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
const cast = (s: BattleState, skillId: string, cell: Cell) =>
  act(s, { type: "skill", skillId, cell });

/** Turns taken by `id` up to `time`, with player turns attacking the foe. */
function turnsUntil(state: BattleState, id: string, time: number): number {
  let current = state;
  let turns = 0;
  for (let i = 0; i < 200 && current.phase.kind !== "over"; i++) {
    const step = advance(current, { until: time });
    current = step.state;
    turns += step.events.filter(
      (e) => e.type === "attack" && e.unitId === id,
    ).length;
    if (current.phase.kind === "awaitingCommand") {
      if (current.phase.unitId === id) turns++;
      current = act(current, { type: "attack", targetId: "enemy-0-0" }).state;
      continue;
    }
    if (current.time >= time) break;
  }
  return turns;
}

describe("Haste and Slow", () => {
  it("Haste speeds an ally up by x1.5 until it expires", () => {
    const { state, events } = cast(chronoTurn(), "haste", ally);
    expect(events).toContainEqual({
      type: "modifierApplied",
      unitId: "player-0-0",
      source: "Haste",
      harmful: false,
    });
    expect(effectiveStat(unit(state, "player-0-0"), "speed")).toBe(15);
    expect(state.units[0]!.mp).toBe(chronomancer.stats.maxMp - haste.mpCost);
    // Lasts 150: expires at time 170.
    expect(unit(state, "player-0-0").modifiers[0]!.expiresAt).toBe(170);
  });

  it("Slow halves an enemy's speed, so it acts less often", () => {
    const slowed = cast(chronoTurn(), "slow", foeCell).state;
    expect(effectiveStat(unit(slowed, "enemy-0-0"), "speed")).toBe(5);
    expect(turnsUntil(slowed, "enemy-0-0", 160)).toBeLessThan(
      turnsUntil(chronoTurn(), "enemy-0-0", 160),
    );
    expect(slow.effect.type).toBe("modify");
  });

  it("refreshes rather than stacks", () => {
    const once = cast(chronoTurn(), "haste", ally).state;
    const chronoAgain = advance(once).state; // the Chronomancer's next turn
    expect(chronoAgain.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-4-2",
    });
    const twice = cast(chronoAgain, "haste", ally).state;
    expect(unit(twice, "player-0-0").modifiers).toHaveLength(1);
    expect(effectiveStat(unit(twice, "player-0-0"), "speed")).toBe(15);
  });

  it("Cure removes Slow but not Haste", () => {
    const healer = {
      ...def("healer", { magic: 10, maxMp: 20, speed: 50 }),
      skills: [cure],
    };
    const state = createBattle(
      {
        placements: [
          place(healer, "player", 0),
          place(def("dummy", { speed: 0 }), "enemy", 0),
        ],
      },
      1,
    );
    const target = state.units[0]!;
    target.modifiers.push(
      {
        stat: "speed",
        op: "mul",
        value: 0.5,
        source: "Slow",
        expiresAt: 999,
        harmful: true,
      },
      {
        stat: "speed",
        op: "mul",
        value: 1.5,
        source: "Haste",
        expiresAt: 999,
        harmful: false,
      },
    );
    const waiting = advance(state).state;
    const { state: after, events } = cast(waiting, "cure", {
      side: "player",
      col: 0,
      row: 0,
    });
    expect(after.units[0]!.modifiers.map((m) => m.source)).toEqual(["Haste"]);
    expect(events).toContainEqual({
      type: "statusRemoved",
      unitId: "player-0-0",
      statusId: "Slow",
      name: "Slow",
    });
  });
});

describe("Quicken", () => {
  it("makes the ally act next, right away", () => {
    const { state, events } = cast(chronoTurn(), "quicken", ally);
    expect(events).toContainEqual({
      type: "gaugeChanged",
      unitId: "player-0-0",
      gauge: 1000,
    });
    expect(state.units[0]!.mp).toBe(chronomancer.stats.maxMp - quicken.mpCost);
    const next = advance(state).state;
    // Still time 20: the ally acts before anything else happens.
    expect(next.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-0-0",
    });
    expect(next.time).toBe(20);
  });

  it("can't target the Chronomancer itself", () => {
    expect(() => cast(chronoTurn(), "quicken", self)).toThrow(
      /can't target its caster/,
    );
  });
});
