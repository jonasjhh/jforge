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
  it("gives an ally defense x1.5 for 150 game time, for 6 MP", () => {
    const { state } = cast(geoTurn(), stoneSkin.id, {
      side: "player",
      col: 1,
      row: 0,
    });
    const ally = unit(state, ALLY);
    expect(ally.statuses).toContainEqual(
      expect.objectContaining({ id: "stoneSkin", interval: 150 }),
    );
    expect(effectiveStat(ally, "defense")).toBe(15);
    expect(unit(state, GEO).mp).toBe(geomancer.stats.maxMp - 6);
  });

  it("can't be heaved: the unit stays put", () => {
    const { state, events } = cast(skinnedFoe(), upheaval.id, foeCell);
    expect(unit(state, FOE).position).toEqual({ col: 0, row: 0 });
    expect(events).toContainEqual({ type: "unmoved", unitId: FOE });
  });

  it("holds against a pushing strike, which lands as a normal hit", () => {
    const pushed = cast(skinnedFoe(), shove.id, foeCell);
    const plain = cast(skinnedFoe(), poke.id, foeCell);
    expect(unit(pushed.state, FOE).position).toEqual({ col: 0, row: 0 });
    expect(pushed.events.some((e) => e.type === "collided")).toBe(false);
    const hit = (events: BattleEvent[]) =>
      events.find((e): e is Damage => e.type === "damage")!.amount;
    expect(hit(pushed.events)).toBe(hit(plain.events));
  });

  it("completes the Geomancer's five skills", () => {
    expect(geomancer.skills).toEqual([
      raiseBoulder,
      shatter,
      upheaval,
      stoneSkin,
      petrifySkill,
    ]);
  });
});
