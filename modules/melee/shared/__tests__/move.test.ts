import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { fireball, sword } from "../content";
import { MOVE_GAUGE_LEFT } from "../move";
import { reachableTargets } from "../reach";
import { skillVictims } from "../skills";
import type { BattleState, Placement } from "../types";
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
  it("steps to an adjacent empty cell and costs half a turn", () => {
    const { state, events } = act(waiting(), {
      type: "move",
      to: { col: 2, row: 0 },
    });
    expect(hero(state).position).toEqual({ col: 2, row: 0 });
    expect(hero(state).gauge).toBe(MOVE_GAUGE_LEFT);
    expect(events).toEqual([
      {
        type: "moved",
        unitId: "player-2-1",
        from: { col: 2, row: 1 },
        to: { col: 2, row: 0 },
      },
    ]);
  });

  it("allows only one orthogonal step to an empty cell on the grid", () => {
    const start = waiting([
      place(def("ally", { speed: 1 }), "player", 1, 1),
      place(def("fallen", { speed: 1 }), "player", 3, 1),
    ]);
    // The fallen ally lies at 3,1.
    start.units.find((u) => u.id === "player-3-1")!.hp = 0;
    const move = (col: number, row: number) => () =>
      act(start, { type: "move", to: { col, row } });
    expect(move(3, 2)).toThrow(/adjacent/); // diagonal
    expect(move(2, -1)).toThrow(/off the grid/);
    expect(move(4, 1)).toThrow(/adjacent/); // two steps
    expect(move(1, 1)).toThrow(/occupied/);
    expect(move(3, 1)).toThrow(/occupied/); // knocked-out units block too
    expect(move(2, 2)).not.toThrow();
  });

  it("lets a unit act again sooner than attacking does", () => {
    const afterMove = advance(
      act(waiting(), { type: "move", to: { col: 2, row: 0 } }).state,
    );
    const afterAttack = advance(
      act(waiting(), { type: "attack", targetId: "enemy-0-0" }).state,
    );
    // First turn at time 100. Attack: next at 200. Move: next at 150.
    expect(afterMove.state.time).toBe(150);
    expect(afterAttack.state.time).toBe(200);
  });

  it("can step out of a Fireball's spill and out of a sword's reach", () => {
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

    expect(reached(start)).toEqual(["archer", "fighter"]);
    expect(burned(start)).toContain("fighter");

    const moved = act(start, { type: "move", to: { col: 2, row: 0 } }).state;
    expect(reached(moved)).toEqual(["archer"]);
    expect(burned(moved)).not.toContain("fighter");
  });
});
