import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { meteor } from "../content";
import { turnOrder } from "@jforge/battle/engine/timeline.ts";
import type { BattleState, Placement } from "@jforge/battle/engine/types.ts";
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

describe("turnOrder", () => {
  it("given a new battle where everyone attacks, when ten turns are forecast, then they are the turns played", () => {
    const start = createBattle({ placements: party }, 1);

    const order = turnOrder(start, 10);

    expect(order).toEqual(playedTurns(start, 10));
  });

  it("given a unit waiting for a command, when eight turns are forecast, then it comes first and the rest are the turns played", () => {
    const waiting = advance(createBattle({ placements: party }, 1)).state;

    const order = turnOrder(waiting, 8);

    expect(waiting.phase.kind).toBe("awaitingCommand");
    expect(order[0]).toBe(
      waiting.phase.kind === "awaitingCommand" ? waiting.phase.unitId : "",
    );
    expect(order).toEqual(playedTurns(waiting, 8));
  });

  it("given a unit knocked out and one with no speed, when turns are forecast, then neither is in them", () => {
    const start = createBattle({ placements: party }, 1);
    start.units.find((u) => u.id === "player-1-0")!.hp = 0;

    const order = turnOrder(start, 6);

    expect(order).not.toContain("player-1-0");
    expect(order).not.toContain("enemy-0-0");
  });

  it("given a fast caster starting a long spell, when turns are forecast, then its next turn comes after the spell lands", () => {
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

    const order = turnOrder(casting, 2);

    // Speed 20 would act at +50; the 60-long cast pushes it past "other".
    expect(order).toEqual(["player-1-0", "player-0-0"]);
  });
});
