import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import { CHILL_SLOW } from "../chill";
import {
  fireball,
  frostLance,
  lightningBolt,
  mage,
  manaTap,
  meteor,
} from "../content";
import { effectiveStat } from "../stats";
import { skillValue } from "../aiSkills";
import { offenseOf } from "../threat";
import type { BattleEvent, BattleState, Cell, Placement } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Mage (player 2,2) is waiting for a command. */
function mageTurn(others: Placement[], mp?: number): BattleState {
  const fast = { ...mage, stats: { ...mage.stats, speed: 50 } };
  const start = createBattle(
    { placements: [place(fast, "player", 2, 2), ...others] },
    1,
  );
  if (mp !== undefined) start.units[0]!.mp = mp;
  return advance(start).state;
}
const foe = (col: number, row: number, maxHp = 10_000) =>
  place(def(`foe${col}${row}`, { maxHp, speed: 1 }), "enemy", col, row);
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const self: Cell = { side: "player", col: 2, row: 2 };
const MAGE = "player-2-2";
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

describe("Mage skills", () => {
  it("are Fireball, Meteor, Lightning Bolt, Mana Tap and Frost Lance", () => {
    expect(mage.skills).toEqual([
      fireball,
      meteor,
      lightningBolt,
      manaTap,
      frostLance,
    ]);
  });
});

describe("Lightning Bolt", () => {
  it("hits the aimed enemy and the one right behind it, with lightning", () => {
    const state = mageTurn([foe(2, 0), foe(2, 1), foe(2, 2), foe(1, 0)]);
    const { events, state: after } = act(state, {
      type: "skill",
      skillId: lightningBolt.id,
      cell: at(2, 0),
    });
    const hits = events.filter((e): e is Damage => e.type === "damage");
    expect(hits.map((e) => e.unitId).sort()).toEqual([
      "enemy-2-0",
      "enemy-2-1",
    ]);
    expect(hits.every((e) => e.damageType === "lightning")).toBe(true);
    expect(unit(after, MAGE).mp).toBe(mage.stats.maxMp - lightningBolt.mpCost);
  });
});

describe("Mana Tap", () => {
  it("pays 10 HP for 15 MP, never above max", () => {
    const { events, state } = act(mageTurn([foe(2, 0)], 20), {
      type: "skill",
      skillId: manaTap.id,
      cell: self,
    });
    expect(unit(state, MAGE).mp).toBe(35);
    expect(unit(state, MAGE).hp).toBe(mage.stats.maxHp - 10);
    expect(events).toContainEqual({
      type: "mpRestored",
      unitId: MAGE,
      amount: 15,
      mp: 35,
    });
    const nearFull = act(mageTurn([foe(2, 0)], mage.stats.maxMp - 5), {
      type: "skill",
      skillId: manaTap.id,
      cell: self,
    });
    expect(unit(nearFull.state, MAGE).mp).toBe(mage.stats.maxMp);
  });

  it("can't be used at full MP", () => {
    const state = mageTurn([foe(2, 0)]);
    expect(
      validateCommand(state, unit(state, MAGE), {
        type: "skill",
        skillId: manaTap.id,
        cell: self,
      }),
    ).toMatch(/already full/);
  });

  it("is worth using to the AI only once no other spell is affordable", () => {
    const value = (mp: number) => {
      const state = mageTurn([foe(2, 0)], mp);
      return skillValue(state, unit(state, MAGE), manaTap, self);
    };
    expect(value(3)).toBeGreaterThan(0);
    expect(value(30)).toBeLessThan(0);
  });

  it("adds nothing to threat", () => {
    expect(
      offenseOf({ ...mage, skills: mage.skills!.slice(0, 4) }),
    ).toBeCloseTo(offenseOf({ ...mage, skills: mage.skills!.slice(0, 3) }));
  });
});

describe("Frost Lance", () => {
  const cast = (state: BattleState) =>
    act(state, { type: "skill", skillId: frostLance.id, cell: at(2, 0) });

  it("hits with cold and chills a surviving target: speed x0.85", () => {
    const state = mageTurn([foe(2, 0)]);
    const before = effectiveStat(unit(state, "enemy-2-0"), "speed");
    const { events, state: after } = cast(state);
    const hit = events.find((e): e is Damage => e.type === "damage")!;
    expect(hit.damageType).toBe("cold");
    const chilled = unit(after, "enemy-2-0");
    expect(chilled.modifiers.map((m) => m.source)).toContain(CHILL_SLOW.name);
    expect(effectiveStat(chilled, "speed")).toBeCloseTo(before * 0.85);
    expect(unit(after, MAGE).mp).toBe(mage.stats.maxMp - frostLance.mpCost);
  });

  it("leaves no chill on a target it knocks out", () => {
    const { state } = cast(mageTurn([foe(2, 0, 1)]));
    expect(unit(state, "enemy-2-0").modifiers).toEqual([]);
  });

  it("is worth more to the AI on a foe not yet chilled", () => {
    const fresh = mageTurn([foe(2, 0)]);
    const chilled = mageTurn([foe(2, 0)]);
    unit(chilled, "enemy-2-0").modifiers.push({
      stat: "speed",
      op: "mul",
      value: CHILL_SLOW.value,
      source: CHILL_SLOW.name,
      harmful: true,
    });
    const value = (s: BattleState) =>
      skillValue(s, unit(s, MAGE), frostLance, at(2, 0));
    expect(value(fresh)).toBeGreaterThan(value(chilled));
  });
});
