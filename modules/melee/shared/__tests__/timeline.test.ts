import { describe, expect, it } from "vitest";
import { advance, act, createBattle } from "@jforge/battle/engine/battle.ts";
import type {
  BattleEvent,
  BattleSetup,
  Placement,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

// Enemies with huge HP and no attack, so only turn order matters.
const dummy = def("dummy", { maxHp: 1_000_000, attack: 0, speed: 0 });

/** Plays player turns (always attacking the dummy) until `time`. */
function turnsUntil(placements: Placement[], time: number) {
  const setup: BattleSetup = {
    placements: [...placements, place(dummy, "enemy", 0)],
  };
  let state = createBattle(setup, 1);
  const turns: string[] = [];
  const events: BattleEvent[] = [];
  for (;;) {
    const step = advance(state);
    events.push(...step.events);
    state = step.state;
    if (state.time > time || state.phase.kind !== "awaitingCommand") break;
    turns.push(state.phase.unitId);
    state = act(state, { type: "attack", targetId: "enemy-0-0" }).state;
  }
  return { turns, events, state };
}

describe("time and gauges", () => {
  it("given a unit twice as fast as another, when time runs, then it gets twice the turns", () => {
    const party = [
      place(def("slow", { speed: 10 }), "player", 0),
      place(def("fast", { speed: 20 }), "player", 1),
    ];

    const { turns } = turnsUntil(party, 1000);

    const count = (id: string) => turns.filter((t) => t === id).length;
    expect(count("player-1-0")).toBe(2 * count("player-0-0"));
  });

  it("given two units of one speed, when their turns come together, then they go in ID order", () => {
    const party = [
      place(def("b", { speed: 10 }), "player", 1),
      place(def("a", { speed: 10 }), "player", 0),
    ];

    const { turns } = turnsUntil(party, 100);

    expect(turns.slice(0, 2)).toEqual(["player-0-0", "player-1-0"]);
  });

  it("given a unit hasted until 300, when time runs to 700, then it is fast until the haste expires", () => {
    const haste = {
      stat: "speed" as const,
      op: "mul" as const,
      value: 2,
      source: "haste",
      expiresAt: 300,
    };
    const party = [
      place(def("hasted", { speed: 10 }), "player", 0, 0, {
        modifiers: [haste],
      }),
    ];

    const { turns, events } = turnsUntil(party, 700);

    // Hasted: turns at 50, 100, 150, 200, 250, 300. Then normal: 400, ... 700.
    expect(turns).toHaveLength(10);
    expect(events).toContainEqual({
      type: "modifierExpired",
      unitId: "player-0-0",
      source: "haste",
    });
  });

  it("given a stopped unit beside a free one, when time runs, then only the free one acts", () => {
    const stop = {
      stat: "speed" as const,
      op: "mul" as const,
      value: 0,
      source: "stop",
    };
    const party = [
      place(def("stopped"), "player", 0, 0, { modifiers: [stop] }),
      place(def("free"), "player", 1),
    ];

    const { turns } = turnsUntil(party, 500);

    expect(turns).not.toContain("player-0-0");
    expect(turns.length).toBeGreaterThan(0);
  });

  it("given a unit waiting for a command, when the battle advances, then time stands still", () => {
    const { state } = turnsUntil([place(def("a"), "player", 0)], 0);

    const after = advance(state).state;

    expect(state.phase.kind).toBe("awaitingCommand");
    expect(after.time).toBe(state.time);
  });
});
