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
  it("given an ally, when the Chronomancer hastes it, then its speed is x1.5 until time 170, for the MP cost", () => {
    const state = chronoTurn();

    const { state: after, events } = cast(state, "haste", ally);

    expect(events).toContainEqual({
      type: "modifierApplied",
      unitId: "player-0-0",
      source: "Haste",
      harmful: false,
    });
    expect(effectiveStat(unit(after, "player-0-0"), "speed")).toBe(15);
    expect(after.units[0]!.mp).toBe(chronomancer.stats.maxMp - haste.mpCost);
    // Lasts 150: expires at time 170.
    expect(unit(after, "player-0-0").modifiers[0]!.expiresAt).toBe(170);
  });

  it("given an enemy, when the Chronomancer slows it, then its speed halves", () => {
    const state = chronoTurn();

    const { state: slowed } = cast(state, "slow", foeCell);

    expect(slow.effect.type).toBe("modify");
    expect(effectiveStat(unit(slowed, "enemy-0-0"), "speed")).toBe(5);
  });

  it("given a slowed enemy, when the battle plays to time 160, then it acts less often", () => {
    const slowed = cast(chronoTurn(), "slow", foeCell).state;
    const normal = turnsUntil(chronoTurn(), "enemy-0-0", 160);

    const turns = turnsUntil(slowed, "enemy-0-0", 160);

    expect(turns).toBeLessThan(normal);
  });

  it("given a hasted ally, when it is hasted again, then the haste refreshes rather than stacks", () => {
    const once = cast(chronoTurn(), "haste", ally).state;
    const chronoAgain = advance(once).state; // the Chronomancer's next turn

    const twice = cast(chronoAgain, "haste", ally).state;

    expect(unit(twice, "player-0-0").modifiers).toHaveLength(1);
    expect(effectiveStat(unit(twice, "player-0-0"), "speed")).toBe(15);
  });

  it("given a unit both slowed and hasted, when it is cured, then Slow is removed and Haste kept", () => {
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
  it("given an ally, when the Chronomancer quickens it, then its gauge fills, for the MP cost", () => {
    const state = chronoTurn();

    const { state: after, events } = cast(state, "quicken", ally);

    expect(events).toContainEqual({
      type: "gaugeChanged",
      unitId: "player-0-0",
      gauge: 1000,
    });
    expect(after.units[0]!.mp).toBe(chronomancer.stats.maxMp - quicken.mpCost);
  });

  it("given a quickened ally, when the battle advances, then the ally acts next, at the same time", () => {
    const { state } = cast(chronoTurn(), "quicken", ally);

    const next = advance(state).state;

    expect(next.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-0-0",
    });
    expect(next.time).toBe(20);
  });

  it("given the Chronomancer, when it quickens itself, then it is refused", () => {
    const state = chronoTurn();

    const quickenSelf = () => cast(state, "quicken", self);

    expect(quickenSelf).toThrow(/can't target its caster/);
  });
});
