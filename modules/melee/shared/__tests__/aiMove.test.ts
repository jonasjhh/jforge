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
  it("given a melee unit in the front row and one in the back, when their positions are valued, then the front one is worth more", () => {
    const front = battle([
      place(brute(), "enemy", 2, 0),
      place(def("dummy", { attack: 0 }), "player", 2),
    ]);
    const back = battle([
      place(brute(), "enemy", 2, 2),
      place(def("dummy", { attack: 0 }), "player", 2),
    ]);

    const frontValue = positionValue(front, unit(front, "enemy-2-0"));
    const backValue = positionValue(back, unit(back, "enemy-2-2"));

    expect(frontValue).toBeGreaterThan(backValue);
  });

  it("given a second foe that can reach the unit, when its position is valued, then it is worth less", () => {
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

    const value = positionValue(state, me);

    expect(value).toBeLessThan(alone);
  });

  it("given only an obstacle across, when the position is valued, then it is worth nothing", () => {
    const state = battle([
      place(brute(), "enemy", 2, 0),
      place({ ...def("rock", { attack: 0 }), obstacle: true }, "player", 2),
    ]);

    const value = positionValue(state, unit(state, "enemy-2-0"));

    expect(value).toBe(0);
  });
});

describe("valueAt", () => {
  it("given a unit, when another cell is valued for it, then the unit stays where it was", () => {
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
  it("given a melee unit in the middle row, when its best move is sought, then it steps forward to hit harder", () => {
    const state = battle([
      place(brute(), "enemy", 2, 1),
      place(def("dummy", { attack: 1, maxHp: 50 }), "player", 2),
    ]);

    const move = bestMove(state, unit(state, "enemy-2-1"));

    expect(move?.command).toEqual({ type: "move", to: { col: 2, row: 0 } });
  });

  it("given a frail ranged unit in melee, when its best move is sought, then it pulls back", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(brute({ attack: 40 }), "player", 2),
    ]);

    const move = bestMove(state, unit(state, "enemy-2-0"));

    expect(move?.command).toEqual({ type: "move", to: { col: 2, row: 1 } });
  });

  it("given no cell beats its own by the threshold, when its best move is sought, then it stays put", () => {
    const state = battle([
      place(def("turret"), "enemy", 2, 0),
      place(def("dummy", { attack: 0 }), "player", 2),
    ]);

    const move = bestMove(state, unit(state, "enemy-2-0"));

    expect(move).toBeNull();
  });

  it("given every neighbouring cell taken, when its best move is sought, then there is none", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(def("wall"), "enemy", 2, 1),
      place(def("wall"), "enemy", 1, 0),
      place(def("wall"), "enemy", 3, 0),
      place(brute(), "player", 2),
    ]);

    const move = bestMove(state, unit(state, "enemy-2-0"));

    expect(move).toBeNull();
  });

  it("given a boxed-in unit with Shadowstep, when its best move is sought, then it teleports for a gain", () => {
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

  it("given a move that pays, when its gain is taken, then the threshold is charged against it", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(brute({ attack: 40 }), "player", 2),
    ]);
    const me = unit(state, "enemy-2-0");
    const raw =
      valueAt(state, me, { col: 2, row: 1 }) - positionValue(state, me);

    const move = bestMove(state, me);

    expect(move!.gain).toBeCloseTo(raw - MOVE_THRESHOLD);
  });
});

describe("chooseCommand with movement", () => {
  it("given a move that pays, when the AI chooses, then it moves before attacking", () => {
    const state = battle([
      place(archer(), "enemy", 2, 0),
      place(brute({ attack: 40 }), "player", 2),
    ]);

    const command = chooseCommand(state, unit(state, "enemy-2-0"));

    expect(command?.type).toBe("move");
  });
});
