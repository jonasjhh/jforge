import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import {
  geomancer,
  petrifySkill,
  raiseBoulder,
  shatter,
  stoneSkin,
  upheaval,
} from "../content";
import { applyStatus } from "../status";
import { effectiveStat } from "../stats";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Skill,
  StatusDef,
} from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;
const SKIN = (stoneSkin.effect as { status: StatusDef }).status;

/** A strike that shoves its target one row back. */
const shove: Skill = {
  id: "shove",
  name: "Shove",
  description: "",
  mpCost: 0,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 1, push: 1 },
};
/** The same strike without the push. */
const poke: Skill = {
  ...shove,
  id: "poke",
  effect: { type: "strike", power: 1 },
};

/** The Geomancer (speed 50, front 0,0) is waiting; foe at enemy 0,0. */
function geoTurn(): BattleState {
  const fast = {
    ...geomancer,
    stats: { ...geomancer.stats, speed: 50, attack: 40 },
    skills: [...(geomancer.skills ?? []), shove, poke],
  };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 0),
          place(
            def("ally", { maxHp: 200, speed: 1, defense: 10 }),
            "player",
            1,
          ),
          place(def("foe", { maxHp: 1000, speed: 1 }), "enemy", 0),
        ],
      },
      1,
    ),
  ).state;
}

const GEO = "player-0-0";
const ALLY = "player-1-0";
const FOE = "enemy-0-0";
const foeCell: Cell = { side: "enemy", col: 0, row: 0 };
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
const cast = (s: BattleState, skillId: string, cell: Cell) =>
  act(s, { type: "skill", skillId, cell });
/** The foe, stone-skinned by the Geomancer. */
function skinnedFoe(): BattleState {
  const s = geoTurn();
  applyStatus(s, unit(s, GEO), unit(s, FOE), SKIN, []);
  return s;
}

describe("Stone Skin", () => {
  it("given an ally, when the Geomancer casts Stone Skin on them, then their defense is x1.5 for 150 game time, for 6 MP", () => {
    const state = geoTurn();

    const { state: after } = cast(state, stoneSkin.id, {
      side: "player",
      col: 1,
      row: 0,
    });

    const ally = unit(after, ALLY);
    expect(ally.statuses).toContainEqual(
      expect.objectContaining({ id: "stoneSkin", interval: 150 }),
    );
    expect(effectiveStat(ally, "defense")).toBe(15);
    expect(unit(after, GEO).mp).toBe(geomancer.stats.maxMp - 6);
  });

  it("given a stone-skinned foe, when it is heaved, then it stays put", () => {
    const state = skinnedFoe();

    const { state: after, events } = cast(state, upheaval.id, foeCell);

    expect(unit(after, FOE).position).toEqual({ col: 0, row: 0 });
    expect(events).toContainEqual({ type: "unmoved", unitId: FOE });
  });

  it("given a stone-skinned foe, when a pushing strike hits, then it stays put and takes a normal hit", () => {
    const plain = cast(skinnedFoe(), poke.id, foeCell);

    const pushed = cast(skinnedFoe(), shove.id, foeCell);

    const hit = (events: BattleEvent[]) =>
      events.find((e): e is Damage => e.type === "damage")!.amount;
    expect(unit(pushed.state, FOE).position).toEqual({ col: 0, row: 0 });
    expect(pushed.events.some((e) => e.type === "collided")).toBe(false);
    expect(hit(pushed.events)).toBe(hit(plain.events));
  });

  it("given the Geomancer, when its skills are listed, then Stone Skin is the fourth of five", () => {
    const skills = geomancer.skills;

    expect(skills).toEqual([
      raiseBoulder,
      shatter,
      upheaval,
      stoneSkin,
      petrifySkill,
    ]);
  });
});
