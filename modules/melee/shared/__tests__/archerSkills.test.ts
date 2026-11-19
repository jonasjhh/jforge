import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import {
  aimedShot,
  archer,
  fireArrow,
  pinningShot,
  quickShot,
  volley,
} from "../content";
import { IGNITE_BURN } from "../ignite";
import { MOVE_GAUGE_LEFT } from "../move";
import { skillValue } from "../aiSkills";
import { PIN_SLOW } from "../pin";
import { previewDamage } from "../preview";
import { effectiveStat } from "../stats";
import type { BattleEvent, BattleState, Cell, Placement } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Archer (column 2, `row`) is waiting for a command. */
function archerTurn(others: Placement[], row = 1): BattleState {
  const fast = { ...archer, stats: { ...archer.stats, speed: 50 } };
  return advance(
    createBattle({ placements: [place(fast, "player", 2, row), ...others] }, 1),
  ).state;
}
const foe = (col: number, row: number, maxHp = 10_000) =>
  place(def(`foe${col}${row}`, { maxHp, speed: 1 }), "enemy", col, row);
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const hitIds = (events: BattleEvent[]) =>
  events
    .filter((e): e is Damage => e.type === "damage")
    .map((e) => e.unitId)
    .sort();
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

const shoot = (state: BattleState, skillId: string, cell: Cell) =>
  act(state, { type: "skill", skillId, cell });
/** The skill's damage on the first foe over a plain attack's. */
const ratio = (skill: Parameters<typeof previewDamage>[2]) => {
  const state = archerTurn([foe(2, 0)]);
  const [self, target] = state.units;
  return {
    shot: previewDamage(self!, target!, skill)!.amount,
    plain: previewDamage(self!, target!)!.amount,
  };
};

describe("Archer skills", () => {
  it("given the Archer, when its skills are listed, then they are Aimed Shot, Volley, Pinning Shot, Quick Shot and Fire Arrow", () => {
    const skills = archer.skills;

    expect(skills).toEqual([
      aimedShot,
      volley,
      pinningShot,
      quickShot,
      fireArrow,
    ]);
  });
});

describe("Volley", () => {
  it("given foes around the middle and an ally in front, when it is aimed past the front row, then it hits every enemy in the 3x3 and no ally, for the MP cost", () => {
    const state = archerTurn([
      place(def("ally", { speed: 1 }), "player", 2, 0),
      foe(1, 0),
      foe(2, 1),
      foe(3, 2),
      foe(0, 1),
    ]);

    const { events, state: after } = shoot(state, volley.id, at(2, 1));

    expect(hitIds(events)).toEqual(["enemy-1-0", "enemy-2-1", "enemy-3-2"]);
    expect(unit(after, "player-2-1").mp).toBe(
      archer.stats.maxMp - volley.mpCost,
    );
  });

  it("given an ally in front, when it is aimed at the enemy front row, then it spills onto your own front row", () => {
    const state = archerTurn([
      place(def("ally", { speed: 1 }), "player", 2, 0),
      foe(2, 0),
    ]);

    const { events } = shoot(state, volley.id, at(2, 0));

    expect(hitIds(events)).toEqual(["enemy-2-0", "player-2-0"]);
  });

  it("given a foe, when the Volley's damage is previewed, then each hit is x0.5", () => {
    const { shot, plain } = ratio(volley);

    expect(Math.abs(shot - plain * 0.5)).toBeLessThan(1);
  });

  it("given the Archer in the front row, when it volleys, then it is refused", () => {
    const front = archerTurn([foe(2, 0)], 0);

    const volleyed = () => shoot(front, volley.id, at(2, 0));

    expect(volleyed).toThrow(/front row/);
  });
});

describe("Pinning Shot", () => {
  it("given a sturdy foe, when it is pinned, then it is hit and slowed x0.7", () => {
    const state = archerTurn([foe(2, 0)]);
    const before = effectiveStat(unit(state, "enemy-2-0"), "speed");

    const { events, state: after } = shoot(state, pinningShot.id, at(2, 0));

    const pinned = unit(after, "enemy-2-0");
    expect(hitIds(events)).toEqual(["enemy-2-0"]);
    expect(pinned.modifiers.map((m) => m.source)).toContain(PIN_SLOW.name);
    expect(effectiveStat(pinned, "speed")).toBeCloseTo(before * 0.7);
  });

  it("given a 1 HP foe, when the shot knocks it out, then it leaves no pin", () => {
    const state = archerTurn([foe(2, 0, 1)]);

    const { state: after } = shoot(state, pinningShot.id, at(2, 0));

    expect(unit(after, "enemy-2-0").modifiers).toEqual([]);
  });

  it("given a pinned and a fresh foe, when the AI values the shot, then the fresh one is worth more", () => {
    const value = (s: BattleState) =>
      skillValue(s, unit(s, "player-2-1"), pinningShot, at(2, 0));
    const pinned = archerTurn([foe(2, 0)]);
    unit(pinned, "enemy-2-0").modifiers.push({
      stat: "speed",
      op: "mul",
      value: 0.7,
      source: PIN_SLOW.name,
      harmful: true,
    });
    const fresh = archerTurn([foe(2, 0)]);

    const freshValue = value(fresh);

    expect(freshValue).toBeGreaterThan(value(pinned));
  });
});

describe("Quick Shot", () => {
  it("given a foe, when the Quick Shot's damage is previewed, then it is x0.6", () => {
    const { shot, plain } = ratio(quickShot);

    expect(Math.abs(shot - plain * 0.6)).toBeLessThan(1);
  });

  it("given a foe, when it is shot, then it is hit and the Archer keeps half its gauge", () => {
    const state = archerTurn([foe(2, 0)]);

    const { events, state: after } = shoot(state, quickShot.id, at(2, 0));

    expect(hitIds(events)).toEqual(["enemy-2-0"]);
    expect(unit(after, "player-2-1").gauge).toBe(MOVE_GAUGE_LEFT);
  });

  it("given the same shot as a whole turn, when the AI values both, then the half-turn one is worth more", () => {
    const state = archerTurn([foe(2, 0)]);
    const self = unit(state, "player-2-1");
    const full = { ...quickShot, id: "full", halfTurn: undefined };

    const half = skillValue(state, self, quickShot, at(2, 0));

    expect(half).toBeGreaterThan(skillValue(state, self, full, at(2, 0)));
  });
});

describe("Fire Arrow", () => {
  it("given a foe, when the Fire Arrow's damage is previewed, then it is x0.8", () => {
    const { shot, plain } = ratio(fireArrow);

    expect(Math.abs(shot - plain * 0.8)).toBeLessThan(1);
  });

  it("given a sturdy foe, when it is shot, then it takes pierce and burns with fire", () => {
    const state = archerTurn([foe(2, 0)]);

    const { events, state: after } = shoot(state, fireArrow.id, at(2, 0));

    const hit = events.find((e): e is Damage => e.type === "damage")!;
    const burning = unit(after, "enemy-2-0").statuses.find(
      (st) => st.id === IGNITE_BURN.id,
    );
    expect(hit.damageType).toBe("pierce");
    expect(burning?.damageType).toBe("fire");
  });

  it("given a 1 HP foe, when the arrow knocks it out, then it leaves no burn", () => {
    const state = archerTurn([foe(2, 0, 1)]);

    const { state: after } = shoot(state, fireArrow.id, at(2, 0));

    expect(unit(after, "enemy-2-0").statuses).toEqual([]);
  });

  it("given the same shot without the burn, when the AI values both, then the Fire Arrow is worth more", () => {
    const state = archerTurn([foe(2, 0)]);
    const self = unit(state, "player-2-1");
    const plain = {
      ...fireArrow,
      id: "plain",
      effect: { type: "strike" as const, power: 0.8 },
    };

    const value = skillValue(state, self, fireArrow, at(2, 0));

    expect(value).toBeGreaterThan(skillValue(state, self, plain, at(2, 0)));
  });
});
