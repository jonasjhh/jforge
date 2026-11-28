import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { regen } from "../content";
import type {
  BattleEvent,
  BattleState,
  Modifier,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

// Healer (magic 15: 6 HP per tick) acts first at time 20; the patient is
// slow and wounded; the enemy never acts.
function castRegen(
  options: { patientHp?: number; patientMods?: Modifier[] } = {},
) {
  const healer = {
    ...def("healer", { magic: 15, maxMp: 40, speed: 50 }),
    skills: [regen],
  };
  const start = createBattle(
    {
      placements: [
        place(healer, "player", 0),
        place(def("patient", { maxHp: 100, speed: 1 }), "player", 1, 0, {
          modifiers: options.patientMods,
        }),
        place(def("dummy", { maxHp: 1000, attack: 0, speed: 0 }), "enemy", 0),
      ],
    },
    1,
  );
  start.units.find((u) => u.id === "player-1-0")!.hp = options.patientHp ?? 50;
  const waiting = advance(start).state;
  return act(waiting, {
    type: "skill",
    skillId: "regen",
    cell: { side: "player", col: 1, row: 0 },
  });
}

/** Advances to `time`, letting player turns pass by attacking the dummy. */
function runUntil(state: BattleState, time: number) {
  const events: BattleEvent[] = [];
  let current = state;
  while (current.time < time && current.phase.kind !== "over") {
    if (current.phase.kind === "awaitingCommand") {
      current = act(current, { type: "attack", targetId: "enemy-0-0" }).state;
      continue;
    }
    const step = advance(current, { until: time });
    events.push(...step.events);
    current = step.state;
  }
  return { state: current, events };
}

const ticksOf = (events: BattleEvent[]) =>
  events.filter(
    (e): e is Extract<BattleEvent, { type: "statusTick" }> =>
      e.type === "statusTick",
  );
const patient = (s: BattleState) => s.units.find((u) => u.id === "player-1-0")!;

/** The game times of the first five Regen ticks on the patient. */
function tickTimes(mods?: Modifier[]) {
  const { state } = castRegen({ patientMods: mods });
  const times: number[] = [];
  let current = state;
  for (let i = 0; i < 40 && times.length < 5; i++) {
    if (current.phase.kind === "awaitingCommand") {
      current = act(current, { type: "attack", targetId: "enemy-0-0" }).state;
      continue;
    }
    const step = advance(current, { until: current.time + 10 });
    if (ticksOf(step.events).length) times.push(step.state.time);
    current = step.state;
  }
  return times;
}

describe("Regen", () => {
  it("given a wounded ally, when Regen is cast on it, then MP is spent and Regen is put on it", () => {
    const options = {};

    const { state, events } = castRegen(options);

    expect(state.units[0]!.mp).toBe(40 - regen.mpCost);
    expect(events).toContainEqual({
      type: "statusApplied",
      unitId: "player-1-0",
      statusId: "regen",
      name: "Regen",
      ticks: 5,
    });
  });

  it("given Regen on an ally at 50 HP, when 300 game time passes, then it heals power x magic 5 times and wears off", () => {
    const { state } = castRegen();

    const { events, state: after } = runUntil(state, 300);

    expect(ticksOf(events).map((t) => t.amount)).toEqual([6, 6, 6, 6, 6]);
    expect(patient(after).hp).toBe(80);
    expect(events).toContainEqual({
      type: "statusExpired",
      unitId: "player-1-0",
      statusId: "regen",
      name: "Regen",
    });
    expect(patient(after).statuses).toEqual([]);
  });

  it("given Regen on an ally, when time passes, then it ticks every 30 game time", () => {
    const mods = undefined;

    const times = tickTimes(mods);

    expect(times).toEqual([50, 80, 110, 140, 170]);
  });

  it("given Regen on a hasted ally, when time passes, then it ticks at the same game times", () => {
    const haste: Modifier = {
      stat: "speed",
      op: "mul",
      value: 2,
      source: "haste",
    };

    const times = tickTimes([haste]);

    expect(times).toEqual([50, 80, 110, 140, 170]);
  });

  it("given Regen on an ally 3 HP short, when 300 game time passes, then it never heals above max HP", () => {
    const { state } = castRegen({ patientHp: 97 });

    const { events, state: after } = runUntil(state, 300);

    expect(ticksOf(events).map((t) => t.amount)).toEqual([3, 0, 0, 0, 0]);
    expect(patient(after).hp).toBe(100);
  });

  it("given Regen on an ally, when it is cast again before a tick, then it refreshes instead of stacking", () => {
    const first = castRegen().state;
    // Second cast on the healer's next turn (time 40), before any tick.
    const healerTurn = advance(first).state;

    const again = act(healerTurn, {
      type: "skill",
      skillId: "regen",
      cell: { side: "player", col: 1, row: 0 },
    }).state;

    expect(healerTurn.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-0-0",
    });
    expect(patient(again).statuses).toHaveLength(1);
    expect(patient(again).statuses[0]).toMatchObject({
      ticksLeft: 5,
      nextTickAt: 70,
    });
  });

  it("given Regen on an ally at 1 HP before a brute, when it is knocked out, then Regen is cleared", () => {
    const { state } = castRegen();
    patient(state).hp = 1;
    const brute = state.units.find((u) => u.id === "enemy-0-0")!;
    brute.base.attack = 500;
    brute.base.speed = 100;

    const { state: after, events } = runUntil(state, 200);

    expect(patient(after).hp).toBe(0);
    expect(patient(after).statuses).toEqual([]);
    expect(ticksOf(events).every((t) => t.amount >= 0)).toBe(true);
  });
});
