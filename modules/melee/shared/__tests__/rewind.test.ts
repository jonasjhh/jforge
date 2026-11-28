import { describe, expect, it } from "vitest";
import {
  act,
  advance,
  createBattle,
  validateCommand,
} from "@jforge/battle/engine/battle.ts";
import { chronomancer, rewind } from "../content";
import { skillValue } from "@jforge/battle/engine/aiSkills.ts";
import type { BattleState, Cell } from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

const CHRONO = "player-2-2";
const ALLY = "player-1-2";
const allyCell: Cell = { side: "player", col: 1, row: 2 };

/** The Chronomancer (player 2,2) is waiting; an ally with 100 HP stands by. */
function chronoTurn(): BattleState {
  const fast = { ...chronomancer, stats: { ...chronomancer.stats, speed: 50 } };
  const start = createBattle(
    {
      placements: [
        place(fast, "player", 2, 2),
        place(def("ally", { maxHp: 100, speed: 1 }), "player", 1, 2),
        place(def("foe", { maxHp: 10_000, speed: 1 }), "enemy", 2, 0),
      ],
    },
    1,
  );
  return advance(start).state;
}
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
const command = {
  type: "skill" as const,
  skillId: rewind.id,
  cell: allyCell,
};

describe("Rewind", () => {
  it("given an ally down to 35 HP since its last turn, when it is rewound, then it is back to 100 and the MP is spent", () => {
    const state = chronoTurn();
    unit(state, ALLY).hp = 35;

    const { events, state: after } = act(state, command);

    expect(unit(after, ALLY).hp).toBe(100);
    expect(events).toContainEqual({
      type: "heal",
      unitId: ALLY,
      amount: 65,
      hp: 100,
    });
    expect(unit(after, CHRONO).mp).toBe(
      chronomancer.stats.maxMp - rewind.mpCost,
    );
  });

  it("given an ally that lost no HP since its last turn, when the rewind is checked, then it is refused", () => {
    const state = chronoTurn();

    const problem = validateCommand(state, unit(state, CHRONO), command);

    expect(problem).toBe("ally has lost no HP since its last turn");
  });

  it("given a unit at 40 HP, when its turn ends, then 40 is where a rewind goes back to", () => {
    const state = chronoTurn();
    unit(state, CHRONO).hp = 40;

    const { state: after } = act(state, { type: "wait" });

    expect(unit(after, CHRONO).rewindHp).toBe(40);
  });

  it("given allies at 30 and 80 HP, when the AI weighs rewinding them, then the one lower is worth more", () => {
    const value = (hp: number) => {
      const state = chronoTurn();
      unit(state, ALLY).hp = hp;
      return skillValue(state, unit(state, CHRONO), rewind, allyCell);
    };

    const low = value(30);

    expect(low).toBeGreaterThan(value(80));
  });
});
