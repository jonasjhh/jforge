import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { meteor } from "../content";
import { turnOrder } from "../timeline";
import type { BattleState, Placement } from "../types";
import { def, place } from "./helpers";

// No attack and huge HP: nothing but turn order matters.
const dummy = def("dummy", { maxHp: 1_000_000, attack: 0, speed: 0 });
const party: Placement[] = [
  place(def("a", { speed: 10 }), "player", 0),
  place(def("b", { speed: 13 }), "player", 1),
  place(def("c", { speed: 7 }), "player", 2),
  place(dummy, "enemy", 0),
];

/** The turns actually played, every unit attacking the dummy. */
function playedTurns(state: BattleState, count: number): string[] {
  const turns: string[] = [];
  while (turns.length < count) {
    state = advance(state).state;
    if (state.phase.kind !== "awaitingCommand") break;
    turns.push(state.phase.unitId);
    state = act(state, { type: "attack", targetId: "enemy-0-0" }).state;
  }
  return turns;
}

describe("turn order forecast", () => {
  it("matches the turns played when everyone attacks", () => {
    const start = createBattle({ placements: party }, 1);
    expect(turnOrder(start, 10)).toEqual(playedTurns(start, 10));
  });

  it("still matches mid-battle, with the waiting unit first", () => {
    const waiting = advance(createBattle({ placements: party }, 1)).state;
    expect(waiting.phase.kind).toBe("awaitingCommand");
    const order = turnOrder(waiting, 8);
    expect(order[0]).toBe(
      waiting.phase.kind === "awaitingCommand" ? waiting.phase.unitId : "",
    );
    expect(order).toEqual(playedTurns(waiting, 8));
  });

  it("leaves out the knocked out and units that never act", () => {
    const start = createBattle({ placements: party }, 1);
    start.units.find((u) => u.id === "player-1-0")!.hp = 0;
    const order = turnOrder(start, 6);
    expect(order).not.toContain("player-1-0");
    expect(order).not.toContain("enemy-0-0");
  });

  it("puts a caster's next turn after its spell lands", () => {
    const caster = def("caster", { speed: 20, maxMp: 99, magic: 10 });
    const state = advance(
      createBattle(
        {
          placements: [
            place({ ...caster, skills: [meteor] }, "player", 0),
            place(def("other", { speed: 10 }), "player", 1),
            place(dummy, "enemy", 0),
          ],
        },
        1,
      ),
    ).state;
    const casting = act(state, {
      type: "skill",
      skillId: "meteor",
      cell: { side: "enemy", col: 0, row: 0 },
    }).state;
    // Speed 20 would act at +50; the 60-long cast pushes it past "other".
    expect(turnOrder(casting, 2)).toEqual(["player-1-0", "player-0-0"]);
  });
});
