import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { revive } from "../content";
import {
  REVIVE_VALUE,
  bestSkill,
  skillCost,
  skillValue,
} from "@jforge/battle/engine/aiSkills.ts";
import { validateSkill } from "@jforge/battle/engine/skills.ts";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Skill,
} from "@jforge/battle/engine/types.ts";
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
  it("given a fallen ally, when revived, then they are back with power x magic HP, an empty gauge, and the MP spent", () => {
    const state = waiting();

    const { state: after, events } = act(state, {
      type: "skill",
      skillId: revive.id,
      cell: cell("player", 1),
    });

    expect(friend(after).hp).toBe(15);
    expect(friend(after).gauge).toBe(0);
    expect(events).toContainEqual({
      type: "revived",
      unitId: "player-1-0",
      hp: 15,
    });
    expect(healer(after).mp).toBe(40 - revive.mpCost);
  });

  it("given a fallen ally, when the revive is aimed at them, then it is allowed", () => {
    const state = waiting();

    const problem = validateSkill(
      state,
      healer(state),
      revive,
      cell("player", 1),
    );

    expect(problem).toBeNull();
  });

  it.each([
    ["an empty cell", cell("player", 2)],
    ["an enemy", cell("enemy", 0)],
  ])(
    "given %s, when the revive is aimed at it, then it needs a fallen ally",
    (_, target) => {
      const state = waiting();

      const problem = validateSkill(state, healer(state), revive, target);

      expect(problem).toMatch(/fallen ally/);
    },
  );

  it("given an ally standing, when the revive is aimed at them, then they are still standing", () => {
    const state = waiting();
    friend(state).hp = 10;

    const problem = validateSkill(
      state,
      healer(state),
      revive,
      cell("player", 1),
    );

    expect(problem).toMatch(/still standing/);
  });

  it("given a slow revive on an ally who gets up first, when it lands, then nothing happens", () => {
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
  it("given a fallen ally, when the AI weighs reviving them, then it is worth more than it costs", () => {
    const state = waiting();
    const me = healer(state);

    const value = skillValue(state, me, revive, cell("player", 1));

    expect(value + skillCost(me, revive)).toBeGreaterThan(REVIVE_VALUE);
  });

  it("given a fallen ally, when the AI picks a skill, then it revives them", () => {
    const state = waiting();

    const best = bestSkill(state, healer(state));

    expect(best?.cell).toEqual(cell("player", 1));
  });

  it("given everyone standing, when the AI picks a skill, then there is nothing to revive", () => {
    const state = waiting();
    friend(state).hp = 100;

    const best = bestSkill(state, healer(state));

    expect(best).toBeNull();
  });
});
