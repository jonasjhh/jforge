import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { fireball, shadowstep } from "../content";
import type { BattleEvent, BattleState, Cell } from "../types";
import { def, place } from "./helpers";

// Decided: a knocked-out unit stays in its cell as a body (for a later
// Revive). It blocks movement and pushes, never attacks, reach or areas.

const hero = def("hero", { speed: 50, maxMp: 99, magic: 10 });
const foe = (id: string) => def(id, { maxHp: 10_000, speed: 1 });

/**
 * The hero (player 2,0) is waiting. Its ally behind it (player 2,1) and an
 * enemy (enemy 3,0) are bodies.
 */
function withBody(): BattleState {
  const state = advance(
    createBattle(
      {
        placements: [
          place({ ...hero, skills: [fireball, shadowstep] }, "player", 2, 0),
          place(def("fallen", { speed: 0 }), "player", 2, 1),
          place(foe("foe"), "enemy", 2, 0),
          place(foe("fallen foe"), "enemy", 3, 0),
        ],
      },
      1,
    ),
  ).state;
  for (const id of ["player-2-1", "enemy-3-0"]) {
    state.units.find((u) => u.id === id)!.hp = 0;
  }
  return state;
}

const mine = (col: number, row: number): Cell => ({
  side: "player",
  col,
  row,
});
const damaged = (events: BattleEvent[]) =>
  events.flatMap((e) => (e.type === "damage" ? [e.unitId] : []));

describe("Knocked-out bodies", () => {
  it("block moving into their cell", () => {
    const state = withBody();
    expect(() => act(state, { type: "move", to: { col: 2, row: 1 } })).toThrow(
      /occupied/,
    );
  });

  it("block teleporting into their cell", () => {
    const state = withBody();
    expect(() =>
      act(state, { type: "skill", skillId: "shadowstep", cell: mine(2, 1) }),
    ).toThrow(/occupied/);
  });

  it("can't be attacked", () => {
    const state = withBody();
    expect(() => act(state, { type: "attack", targetId: "enemy-3-0" })).toThrow(
      /already knocked out/,
    );
  });

  it("aren't hit by areas", () => {
    const state = withBody();
    const { events } = act(state, {
      type: "skill",
      skillId: "fireball",
      cell: mine(2, 1),
    });
    expect(damaged(events)).not.toContain("player-2-1");
    expect(damaged(events)).toContain("player-2-0");
  });
});
