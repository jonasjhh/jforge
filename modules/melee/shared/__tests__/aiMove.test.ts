import { describe, expect, it } from "vitest";
import { chooseCommand } from "../ai";
import { MOVE_THRESHOLD, bestMove, positionValue, valueAt } from "../aiMove";
import { createBattle } from "../battle";
import { bow, shadowstep, sword } from "../content";
import type { BattleState, Placement, Unit } from "../types";
import { def, place } from "./helpers";

const unit = (state: BattleState, id: string) =>
  state.units.find((u) => u.id === id)!;

function battle(placements: Placement[]): BattleState {
  return createBattle({ placements }, 1);
}

const brute = (stats = {}) => def("brute", { attack: 30, ...stats }, sword);
const archer = (stats = {}) => def("archer", { maxHp: 40, ...stats }, bow);

describe("positionValue", () => {
  it("counts a melee unit's best hit, weaker from the back row", () => {
    const front = battle([
      place(brute(), "enemy", 2, 0),
      place(def("dummy", { attack: 0 }), "player", 2),
    ]);
    const back = battle([
      place(brute(), "enemy", 2, 2),
      place(def("dummy", { attack: 0 }), "player", 2),
    ]);
    expect(positionValue(front, unit(front, "enemy-2-0"))).toBeGreaterThan(
      positionValue(back, unit(back, "enemy-2-2")),
    );
  });

  it("subtracts the hits of every foe that can reach it", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(def("dummy", { maxHp: 1000 }), "player", 2),
    ]);
    const me = unit(state, "enemy-2-0");
    const alone = positionValue(state, me);
    state.units.push({
      ...unit(state, "player-2-0"),
      id: "extra",
      position: { col: 3, row: 0 },
    });
    expect(positionValue(state, me)).toBeLessThan(alone);
  });

  it("ignores foes covered from it and obstacles", () => {
    const state = battle([
      place(brute(), "enemy", 2, 0),
      place({ ...def("rock", { attack: 0 }), obstacle: true }, "player", 2),
    ]);
    expect(positionValue(state, unit(state, "enemy-2-0"))).toBe(0);
  });
});

describe("valueAt", () => {
  it("leaves the unit where it was", () => {
    const state = battle([
      place(brute(), "enemy", 2, 2),
      place(def("dummy"), "player", 2),
    ]);
    const me = unit(state, "enemy-2-2");
    valueAt(state, me, { col: 2, row: 1 });
    expect(me.position).toEqual({ col: 2, row: 2 });
  });
});

describe("bestMove", () => {
  it("steps a back-row melee unit forward to hit harder", () => {
    const state = battle([
      place(brute(), "enemy", 2, 1),
      place(def("dummy", { attack: 1, maxHp: 50 }), "player", 2),
    ]);
    expect(bestMove(state, unit(state, "enemy-2-1"))?.command).toEqual({
      type: "move",
      to: { col: 2, row: 0 },
    });
  });

  it("pulls a frail ranged unit back out of melee", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(brute({ attack: 40 }), "player", 2),
    ]);
    expect(bestMove(state, unit(state, "enemy-2-0"))?.command).toEqual({
      type: "move",
      to: { col: 2, row: 1 },
    });
  });

  it("stays put when no cell beats its own by the threshold", () => {
    const state = battle([
      place(def("turret"), "enemy", 2, 0),
      place(def("dummy", { attack: 0 }), "player", 2),
    ]);
    expect(bestMove(state, unit(state, "enemy-2-0"))).toBeNull();
  });

  it("only steps into empty cells", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(def("wall"), "enemy", 2, 1),
      place(def("wall"), "enemy", 1, 0),
      place(def("wall"), "enemy", 3, 0),
      place(brute(), "player", 2),
    ]);
    expect(bestMove(state, unit(state, "enemy-2-0"))).toBeNull();
  });

  it("teleports when stepping can't get it clear", () => {
    const rogue: Unit["skills"] = [shadowstep];
    const state = battle([
      place({ ...archer({ maxMp: 20 }), skills: rogue }, "enemy", 2, 0),
      place(def("wall"), "enemy", 2, 1),
      place(def("wall"), "enemy", 1, 0),
      place(def("wall"), "enemy", 3, 0),
      place(brute(), "player", 2),
    ]);
    const move = bestMove(state, unit(state, "enemy-2-0"));
    expect(move?.command).toMatchObject({
      type: "skill",
      skillId: shadowstep.id,
    });
    expect(move!.gain).toBeGreaterThan(0);
  });

  it("charges the threshold against the gain", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(brute({ attack: 40 }), "player", 2),
    ]);
    const me = unit(state, "enemy-2-0");
    const raw =
      valueAt(state, me, { col: 2, row: 1 }) - positionValue(state, me);
    expect(bestMove(state, me)!.gain).toBeCloseTo(raw - MOVE_THRESHOLD);
  });
});

describe("chooseCommand with movement", () => {
  it("moves before attacking when the move pays", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(brute({ attack: 40 }), "player", 2),
    ]);
    expect(chooseCommand(state, unit(state, "enemy-2-0"))?.type).toBe("move");
  });
});
