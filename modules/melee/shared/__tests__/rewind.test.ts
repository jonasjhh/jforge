import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import { chronomancer, rewind } from "../content";
import { skillValue } from "../aiSkills";
import type { BattleState, Cell } from "../types";
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
  it("gives back every HP lost since the ally's last turn", () => {
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

  it("is refused on an ally that has lost no HP since its last turn", () => {
    const state = chronoTurn();
    expect(validateCommand(state, unit(state, CHRONO), command)).toBe(
      "ally has lost no HP since its last turn",
    );
  });

  it("only goes back to where the unit's last turn ended", () => {
    const state = chronoTurn();
    unit(state, CHRONO).hp = 40;
    const { state: after } = act(state, { type: "wait" });
    expect(unit(after, CHRONO).rewindHp).toBe(40);
  });

  it("is worth more to the AI the more HP the ally lost", () => {
    const value = (hp: number) => {
      const state = chronoTurn();
      unit(state, ALLY).hp = hp;
      return skillValue(state, unit(state, CHRONO), rewind, allyCell);
    };
    expect(value(30)).toBeGreaterThan(value(80));
  });
});
