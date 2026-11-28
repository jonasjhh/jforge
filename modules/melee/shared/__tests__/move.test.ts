import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { fireball, sword } from "../content";
import { MOVE_GAUGE_LEFT } from "@jforge/battle/engine/move.ts";
import { reachableTargets } from "@jforge/battle/engine/reach.ts";
import { skillVictims } from "@jforge/battle/engine/skills.ts";
import type { BattleState, Placement } from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

const dummy = def("dummy", { maxHp: 1_000_000, attack: 0, speed: 0 });

/** The hero (speed 10, at player 2,1) is waiting for a command. */
function waiting(extra: Placement[] = []): BattleState {
  return advance(
    createBattle(
      {
        placements: [
          place(def("hero", { speed: 10 }), "player", 2, 1),
          place(dummy, "enemy", 0),
          ...extra,
        ],
      },
      1,
    ),
  ).state;
}

const hero = (state: BattleState) =>
  state.units.find((u) => u.id === "player-2-1")!;

describe("move", () => {
  it("given the hero waiting, when it steps forward, then it is there with half its gauge left", () => {
    const state = waiting();

    const { state: after, events } = act(state, {
      type: "move",
      to: { col: 2, row: 0 },
    });

    expect(hero(after).position).toEqual({ col: 2, row: 0 });
    expect(hero(after).gauge).toBe(MOVE_GAUGE_LEFT);
    expect(events).toEqual([
      {
        type: "moved",
        unitId: "player-2-1",
        from: { col: 2, row: 1 },
        to: { col: 2, row: 0 },
      },
    ]);
  });

  describe("refused steps", () => {
    const start = waiting([
      place(def("ally", { speed: 1 }), "player", 1, 1),
      place(def("fallen", { speed: 1 }), "player", 3, 1),
    ]);
    start.units.find((u) => u.id === "player-3-1")!.hp = 0;

    it.each([
      ["a diagonal step", 3, 2, /adjacent/],
      ["a step off the grid", 2, -1, /off the grid/],
      ["two steps", 4, 1, /adjacent/],
      ["a step onto an ally", 1, 1, /occupied/],
      ["a step onto a body", 3, 1, /occupied/],
    ])(
      "given %s, when the hero moves, then it is refused",
      (_, col, row, problem) => {
        const move = () => act(start, { type: "move", to: { col, row } });

        expect(move).toThrow(problem);
      },
    );

    it("given an empty cell next to the hero, when it moves there, then it is allowed", () => {
      const move = () => act(start, { type: "move", to: { col: 2, row: 2 } });

      expect(move).not.toThrow();
    });
  });

  it.each([
    ["moves", { type: "move", to: { col: 2, row: 0 } }, 150],
    ["attacks", { type: "attack", targetId: "enemy-0-0" }, 200],
  ] as const)(
    "given the hero's first turn at 100, when it %s, then its next turn is at %i",
    (_, command, time) => {
      const state = act(waiting(), command).state;

      const next = advance(state);

      expect(next.state.time).toBe(time);
    },
  );

  describe("stepping out of harm", () => {
    const brute = def("brute", { speed: 1 }, sword);
    const start = advance(
      createBattle(
        {
          placements: [
            place(def("fighter", { speed: 10 }), "player", 1, 0),
            place(def("archer", { speed: 1 }), "player", 0, 1),
            place(brute, "enemy", 0, 0),
          ],
        },
        1,
      ),
    ).state;
    const enemy = (s: BattleState) =>
      s.units.find((u) => u.id === "enemy-0-0")!;
    const reached = (s: BattleState) =>
      reachableTargets(s, enemy(s))
        .map((u) => u.name)
        .sort();
    const burned = (s: BattleState) =>
      skillVictims(s, hero(s), fireball, { side: "enemy", col: 1, row: 0 }).map(
        (u) => u.name,
      );

    it("given a fighter in a sword's reach and a Fireball's spill, when the battle starts, then both would catch it", () => {
      const sword = reached(start);
      const fire = burned(start);

      expect(sword).toEqual(["archer", "fighter"]);
      expect(fire).toContain("fighter");
    });

    it("given a fighter in harm's way, when it steps aside, then neither the sword nor the Fireball catches it", () => {
      const moved = act(start, { type: "move", to: { col: 2, row: 0 } }).state;

      expect(reached(moved)).toEqual(["archer"]);
      expect(burned(moved)).not.toContain("fighter");
    });
  });
});
