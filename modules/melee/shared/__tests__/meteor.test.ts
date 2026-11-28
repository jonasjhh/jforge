import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { meteor } from "../content";
import { areaCells } from "@jforge/battle/engine/grid.ts";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Placement,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

const at = (side: Cell["side"], col: number, row = 0): Cell => ({
  side,
  col,
  row,
});
const key = (c: Cell) => `${c.side}-${c.col}-${c.row}`;
const sturdy = (name: string, speed = 1) => def(name, { maxHp: 1000, speed });

/** A mage (speed 50, first to act) that has just started casting Meteor. */
function startCast(
  cell: Cell,
  others: Placement[],
  mage: { hp?: number } = {},
) {
  const caster = {
    ...def("mage", { magic: 20, maxMp: 50, maxHp: mage.hp ?? 100, speed: 50 }),
    skills: [meteor],
  };
  const waiting = advance(
    createBattle({ placements: [place(caster, "player", 4, 2), ...others] }, 1),
  ).state;
  return act(waiting, { type: "skill", skillId: "meteor", cell });
}

/** Advances until the battle needs a command or ends, collecting events. */
function runOn(state: BattleState) {
  const events: BattleEvent[] = [];
  let current = state;
  for (let i = 0; i < 20; i++) {
    const step = advance(current);
    events.push(...step.events);
    current = step.state;
    if (current.phase.kind !== "running") break;
  }
  return { state: current, events };
}

const hitIds = (events: BattleEvent[]) =>
  events.flatMap((e) => (e.type === "damage" ? [e.unitId] : [])).sort();

describe("square area", () => {
  it("given a cell in the middle, when its square is taken, then it covers a 3x3 block", () => {
    const cell = at("enemy", 2, 1);

    const area = areaCells(cell, "square");

    expect(area).toHaveLength(9);
  });

  it("given a corner cell, when its square is taken, then it is clipped at the edges", () => {
    const cell = at("enemy", 0, 2);

    const area = areaCells(cell, "square").map(key).sort();

    expect(area).toEqual(
      ["enemy-0-1", "enemy-0-2", "enemy-1-1", "enemy-1-2"].sort(),
    );
  });

  it("given a front-row cell, when its square is taken, then it crosses the front line", () => {
    const cell = at("enemy", 2, 0);

    const keys = areaCells(cell, "square").map(key);

    expect(keys).toEqual(
      expect.arrayContaining(["player-1-0", "player-2-0", "player-3-0"]),
    );
  });
});

describe("Meteor", () => {
  const foeAt21 = [place(sturdy("foe"), "enemy", 2, 1)];

  it("given a foe, when Meteor is cast, then it is paid for at once and lands after its cast time", () => {
    const cell = at("enemy", 2, 1);

    const { state, events } = startCast(cell, foeAt21);

    expect(events.map((e) => e.type)).toEqual(["castStarted"]);
    expect(state.units[0]!.mp).toBe(50 - meteor.mpCost);
    // Ready at 20 (1000 / speed 50); lands 60 later.
    expect(state.units[0]!.casting).toMatchObject({
      startedAt: 20,
      readyAt: 80,
    });
  });

  it("given Meteor cast, when the battle runs on, then it lands, delayed, on the foe", () => {
    const { state } = startCast(at("enemy", 2, 1), foeAt21);

    const { events } = runOn(state);

    const impact = events.find((e) => e.type === "skill");
    expect(impact).toMatchObject({ skillId: "meteor", delayed: true });
    expect(hitIds(events)).toContain("enemy-2-1");
  });

  it("given Meteor cast, when the battle runs on, then the caster acts next only after it lands and a full gauge", () => {
    const { state } = startCast(at("enemy", 2, 1), foeAt21);

    const { state: next } = runOn(state);

    // The caster's next turn: impact at 80, plus a full gauge at speed 50.
    expect(next.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-4-2",
    });
    expect(next.time).toBe(100);
  });

  it("given an ally that steps out of the zone before impact, when Meteor lands, then the ally is not hit", () => {
    // The zone around player 0,1 covers columns 0-1; one step right clears it.
    const { state } = startCast(at("player", 0, 1), [
      // Speed 15: ready at ~67, before the impact at 80; after a half-turn
      // move, next ready at 100.
      place(sturdy("scout", 15), "player", 1, 1),
      place(sturdy("foe"), "enemy", 0, 0),
    ]);
    const scoutTurn = advance(state).state;
    const moved = act(scoutTurn, { type: "move", to: { col: 2, row: 1 } });

    const { events } = runOn(moved.state);

    expect(scoutTurn.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-1-1",
    });
    expect(events.some((e) => e.type === "skill")).toBe(true);
    expect(hitIds(events)).not.toContain("player-1-1");
  });

  it("given the caster at 1 HP before a fast assassin, when the battle runs on, then the cast fizzles", () => {
    const assassin = {
      ...def("assassin", { attack: 50, speed: 30 }),
      targeting: { finish: 9, wounded: 0, soft: 0, noise: 0 },
    };
    const { state } = startCast(
      at("enemy", 2, 1),
      [place(assassin, "enemy", 2, 1), place(sturdy("ally"), "player", 0, 0)],
      { hp: 1 },
    );

    const { events } = runOn(state);

    expect(events).toContainEqual({
      type: "castFizzled",
      unitId: "player-4-2",
      skillName: "Meteor",
    });
    expect(events.some((e) => e.type === "skill")).toBe(false);
  });
});
