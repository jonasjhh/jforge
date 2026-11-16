import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { revive } from "../content";
import { REVIVE_VALUE, bestSkill, skillCost, skillValue } from "../aiSkills";
import { validateSkill } from "../skills";
import type { BattleEvent, BattleState, Cell, Skill } from "../types";
import { def, place } from "./helpers";

/** The fast healer waits for a command; its friend at player 1 is down. */
function waiting(skill: Skill = revive): BattleState {
  const healer = {
    ...def("healer", { magic: 10, maxMp: 40, speed: 50 }),
    skills: [skill],
  };
  const state = createBattle(
    {
      placements: [
        place(healer, "player", 0),
        place(def("friend", { maxHp: 100, speed: 1 }), "player", 1),
        place(def("dummy", { maxHp: 1000, attack: 0, speed: 1 }), "enemy", 0),
      ],
    },
    1,
  );
  state.units[1]!.hp = 0;
  return advance(state).state;
}

const cell = (side: Cell["side"], col: number): Cell => ({ side, col, row: 0 });
const friend = (s: BattleState) => s.units.find((u) => u.id === "player-1-0")!;
const healer = (s: BattleState) => s.units.find((u) => u.id === "player-0-0")!;

describe("Revive", () => {
  it("brings a fallen ally back with power x magic HP", () => {
    const { state, events } = act(waiting(), {
      type: "skill",
      skillId: revive.id,
      cell: cell("player", 1),
    });
    expect(friend(state).hp).toBe(15);
    expect(friend(state).gauge).toBe(0);
    expect(events).toContainEqual({
      type: "revived",
      unitId: "player-1-0",
      hp: 15,
    });
    expect(healer(state).mp).toBe(40 - revive.mpCost);
  });

  it("needs a fallen ally in the cell", () => {
    const state = waiting();
    const me = healer(state);
    expect(validateSkill(state, me, revive, cell("player", 1))).toBeNull();
    expect(validateSkill(state, me, revive, cell("player", 2))).toMatch(
      /fallen ally/,
    );
    expect(validateSkill(state, me, revive, cell("enemy", 0))).toMatch(
      /fallen ally/,
    );
    friend(state).hp = 10;
    expect(validateSkill(state, me, revive, cell("player", 1))).toMatch(
      /still standing/,
    );
  });

  it("does nothing when a delayed revive finds its ally already up", () => {
    const slow = { ...revive, castTime: 100 };
    let state = act(waiting(slow), {
      type: "skill",
      skillId: slow.id,
      cell: cell("player", 1),
    }).state;
    friend(state).hp = 40;
    const events: BattleEvent[] = [];
    for (let i = 0; i < 20; i++) {
      const step = advance(state);
      state = step.state;
      events.push(...step.events);
      if (step.events.some((e) => e.type === "skill" && e.delayed)) break;
    }
    expect(events.some((e) => e.type === "skill" && e.delayed)).toBe(true);
    expect(events.some((e) => e.type === "revived")).toBe(false);
    expect(friend(state).hp).toBe(40);
  });
});

describe("the AI and Revive", () => {
  it("values bringing back a fallen ally above its cost", () => {
    const state = waiting();
    const me = healer(state);
    const value = skillValue(state, me, revive, cell("player", 1));
    expect(value + skillCost(me, revive)).toBeGreaterThan(REVIVE_VALUE);
    expect(bestSkill(state, me)?.cell).toEqual(cell("player", 1));
  });

  it("has nothing to revive when everyone stands", () => {
    const state = waiting();
    friend(state).hp = 100;
    expect(bestSkill(state, healer(state))).toBeNull();
  });
});
