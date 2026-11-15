import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { heal } from "../content";
import { skillTargets } from "../skills";
import type { BattleState, Skill } from "../types";
import { def, place } from "./helpers";

// The healer acts first; everyone else is too slow to matter.
function battle(options: { healerMp?: number; allyHp?: number } = {}) {
  const healer = {
    ...def("healer", { magic: 10, maxMp: options.healerMp ?? 20, speed: 20 }),
    skills: [heal],
  };
  const start = createBattle(
    {
      placements: [
        place(healer, "player", 0),
        place(def("ally", { maxHp: 100, speed: 1 }), "player", 1),
        place(def("foe", { speed: 1 }), "enemy", 0),
      ],
    },
    1,
  );
  const ally = start.units.find((u) => u.id === "player-1-0")!;
  ally.hp = options.allyHp ?? 50;
  return advance(start).state;
}

const healAlly = (state: BattleState) =>
  act(state, { type: "skill", skillId: "heal", targetId: "player-1-0" });

const hpOf = (state: BattleState, id: string) =>
  state.units.find((u) => u.id === id)!.hp;

describe("Heal", () => {
  it("restores power x magic HP and spends MP", () => {
    const { state, events } = healAlly(battle());
    // 1.6 x 10 magic = 16.
    expect(hpOf(state, "player-1-0")).toBe(66);
    expect(state.units[0]!.mp).toBe(20 - heal.mpCost);
    expect(events).toContainEqual({
      type: "heal",
      unitId: "player-1-0",
      amount: 16,
      hp: 66,
    });
  });

  it("never heals above max HP, and reports what was actually healed", () => {
    const { state, events } = healAlly(battle({ allyHp: 95 }));
    expect(hpOf(state, "player-1-0")).toBe(100);
    expect(events).toContainEqual({
      type: "heal",
      unitId: "player-1-0",
      amount: 5,
      hp: 100,
    });
  });

  it("can target the caster itself", () => {
    const waiting = battle();
    expect(() =>
      act(waiting, { type: "skill", skillId: "heal", targetId: "player-0-0" }),
    ).not.toThrow();
  });

  it("is refused without enough MP", () => {
    expect(() => healAlly(battle({ healerMp: heal.mpCost - 1 }))).toThrow(
      /Not enough MP/,
    );
  });

  it("is refused on an enemy, a knocked-out ally or an unknown skill", () => {
    const waiting = battle();
    expect(() =>
      act(waiting, { type: "skill", skillId: "heal", targetId: "enemy-0-0" }),
    ).toThrow(/targets an ally/);
    expect(() => healAlly(battle({ allyHp: 0 }))).toThrow(/knocked out/);
    expect(() =>
      act(waiting, {
        type: "skill",
        skillId: "fireball",
        targetId: "enemy-0-0",
      }),
    ).toThrow(/Unknown skill/);
  });

  it("offers living allies, including the caster, as targets", () => {
    const waiting = battle();
    const healer = waiting.units[0]!;
    expect(skillTargets(waiting, healer, heal).map((u) => u.id)).toEqual([
      "player-0-0",
      "player-1-0",
    ]);
    const broke = battle({ healerMp: 0 });
    expect(skillTargets(broke, broke.units[0]!, heal)).toEqual([]);
  });

  it("does not change the skill definitions it was given", () => {
    const copy: Skill = structuredClone(heal);
    healAlly(battle());
    expect(heal).toEqual(copy);
  });
});
