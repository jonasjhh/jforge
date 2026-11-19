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
  it("given the Mage, when its skills are listed, then they are Fireball, Meteor, Lightning Bolt, Mana Tap and Frost Lance", () => {
    const skills = mage.skills;

    expect(skills).toEqual([
      fireball,
      meteor,
      lightningBolt,
      manaTap,
      frostLance,
    ]);
  });
});

describe("Lightning Bolt", () => {
  it("given a column of foes, when the front one is struck by lightning, then it and the one behind are hit with lightning, for the MP cost", () => {
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
  const tap = (state: BattleState) =>
    act(state, { type: "skill", skillId: manaTap.id, cell: self });

  it("given the Mage at 20 MP, when it taps, then it pays 10 HP for 15 MP", () => {
    const state = mageTurn([foe(2, 0)], 20);

    const { events, state: after } = tap(state);

    expect(unit(after, MAGE).mp).toBe(35);
    expect(unit(after, MAGE).hp).toBe(mage.stats.maxHp - 10);
    expect(events).toContainEqual({
      type: "mpRestored",
      unitId: MAGE,
      amount: 15,
      mp: 35,
    });
  });

  it("given the Mage 5 MP short, when it taps, then it stops at max MP", () => {
    const state = mageTurn([foe(2, 0)], mage.stats.maxMp - 5);

    const { state: after } = tap(state);

    expect(unit(after, MAGE).mp).toBe(mage.stats.maxMp);
  });

  it("given the Mage at full MP, when Mana Tap is checked, then it is refused", () => {
    const state = mageTurn([foe(2, 0)]);

    const problem = validateCommand(state, unit(state, MAGE), {
      type: "skill",
      skillId: manaTap.id,
      cell: self,
    });

    expect(problem).toMatch(/already full/);
  });

  it.each([
    ["can't afford another spell", 3, true],
    ["can afford other spells", 30, false],
  ])(
    "given the Mage %s, when the AI values Mana Tap, then it is worth using: %s",
    (_, mp, worth) => {
      const state = mageTurn([foe(2, 0)], mp);

      const value = skillValue(state, unit(state, MAGE), manaTap, self);

      expect(value > 0).toBe(worth);
    },
  );

  it("given the Mage with and without Mana Tap, when its offense is weighed, then the tap adds nothing", () => {
    const without = offenseOf({ ...mage, skills: mage.skills!.slice(0, 3) });

    const withTap = offenseOf({ ...mage, skills: mage.skills!.slice(0, 4) });

    expect(withTap).toBeCloseTo(without);
  });
});

describe("Frost Lance", () => {
  const cast = (state: BattleState) =>
    act(state, { type: "skill", skillId: frostLance.id, cell: at(2, 0) });

  it("given a sturdy foe, when it is lanced, then it takes cold and is chilled to speed x0.85, for the MP cost", () => {
    const state = mageTurn([foe(2, 0)]);
    const before = effectiveStat(unit(state, "enemy-2-0"), "speed");

    const { events, state: after } = cast(state);

    const hit = events.find((e): e is Damage => e.type === "damage")!;
    const chilled = unit(after, "enemy-2-0");
    expect(hit.damageType).toBe("cold");
    expect(chilled.modifiers.map((m) => m.source)).toContain(CHILL_SLOW.name);
    expect(effectiveStat(chilled, "speed")).toBeCloseTo(before * 0.85);
    expect(unit(after, MAGE).mp).toBe(mage.stats.maxMp - frostLance.mpCost);
  });

  it("given a foe at 1 HP, when the lance knocks it out, then no chill is left", () => {
    const state = mageTurn([foe(2, 0, 1)]);

    const { state: after } = cast(state);

    expect(unit(after, "enemy-2-0").modifiers).toEqual([]);
  });

  it("given a fresh and a chilled foe, when the AI values the lance, then the fresh one is worth more", () => {
    const value = (s: BattleState) =>
      skillValue(s, unit(s, MAGE), frostLance, at(2, 0));
    const chilled = mageTurn([foe(2, 0)]);
    unit(chilled, "enemy-2-0").modifiers.push({
      stat: "speed",
      op: "mul",
      value: CHILL_SLOW.value,
      source: CHILL_SLOW.name,
      harmful: true,
    });
    const already = value(chilled);

    const fresh = value(mageTurn([foe(2, 0)]));

    expect(fresh).toBeGreaterThan(already);
  });
});
