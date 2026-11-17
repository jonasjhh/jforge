import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import {
  armorPierce,
  hook,
  lancer,
  skewer,
  staggeringThrust,
  weakeningStrike,
} from "../content";
const WEAKEN_FACTOR = 0.75;
import { WEAKEN_STATUS } from "../weaken";
import { skillValue } from "../aiSkills";
import { GAUGE_FULL } from "../timeline";
import { previewDamage } from "../preview";
import type { BattleEvent, BattleState, Cell, Placement } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Lancer (column 2, front row) is waiting for a command. */
function lancerTurn(enemies: Placement[], seed = 1): BattleState {
  const fast = {
    ...lancer,
    stats: { ...lancer.stats, speed: 50, attack: 100 },
  };
  return advance(
    createBattle({ placements: [place(fast, "player", 2), ...enemies] }, seed),
  ).state;
}

const foe = (col: number, row: number, hp = 10_000) =>
  place(def(`foe${col}${row}`, { maxHp: hp, speed: 1 }), "enemy", col, row);
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const perform = (state: BattleState, skillId: string, cell: Cell) =>
  act(state, { type: "skill", skillId, cell });
const damaged = (events: BattleEvent[]) =>
  events
    .filter((e): e is Damage => e.type === "damage")
    .map((e) => e.unitId)
    .sort();
const unitAtId = (s: BattleState, id: string) =>
  s.units.find((u) => u.id === id)!;

describe("Lancer's spear", () => {
  it("reaches the front-most unit and the one behind it, but no deeper", () => {
    const state = lancerTurn([foe(2, 0), foe(2, 1), foe(2, 2)]);
    expect(() =>
      act(state, { type: "attack", targetId: "enemy-2-1" }),
    ).not.toThrow();
    expect(() => act(state, { type: "attack", targetId: "enemy-2-2" })).toThrow(
      /out of reach/,
    );
  });
});

describe("Skewer", () => {
  it("hits the target and the unit directly behind it, and nothing else", () => {
    const state = lancerTurn([
      foe(2, 0),
      foe(2, 1),
      foe(2, 2),
      foe(1, 1),
      foe(3, 0),
    ]);
    const { events, state: after } = perform(state, "skewer", at(2, 0));
    expect(damaged(events)).toEqual(["enemy-2-0", "enemy-2-1"]);
    expect(after.units[0]!.mp).toBe(lancer.stats.maxMp - skewer.mpCost);
  });

  it("can't be aimed past the spear's reach", () => {
    const state = lancerTurn([foe(2, 0), foe(2, 1), foe(2, 2)]);
    expect(() => perform(state, "skewer", at(2, 2))).toThrow(/out of reach/);
  });
});

describe("Hook", () => {
  it("pulls the target one row forward into an empty cell", () => {
    const state = lancerTurn([foe(2, 1)]);
    const { events, state: after } = perform(state, "hook", at(2, 1));
    expect(events).toContainEqual({
      type: "pushed",
      unitId: "enemy-2-1",
      from: { col: 2, row: 1 },
      to: { col: 2, row: 0 },
    });
    expect(unitAtId(after, "enemy-2-1").position).toEqual({ col: 2, row: 0 });
    expect(after.units[0]!.mp).toBe(lancer.stats.maxMp - hook.mpCost);
  });

  /** Damage to the hooked unit at 2,1 with or without a blocker in front. */
  const hookDamage = (blocker: Placement[], koBlocker = false) => {
    const state = lancerTurn([foe(2, 1), ...blocker]);
    if (koBlocker) unitAtId(state, "enemy-2-0").hp = 0;
    const { events } = perform(state, "hook", at(2, 1));
    const hit = events.find(
      (e): e is Damage => e.type === "damage" && e.unitId === "enemy-2-1",
    )!;
    return { amount: hit.amount, events };
  };

  it("crashes into a unit in the way for x1.5 damage instead of moving", () => {
    const free = hookDamage([]);
    const blocked = hookDamage([foe(2, 0)]);
    expect(blocked.events).toContainEqual({
      type: "collided",
      unitId: "enemy-2-1",
      blockerId: "enemy-2-0",
    });
    expect(blocked.events.some((e) => e.type === "pushed")).toBe(false);
    expect(Math.abs(blocked.amount - free.amount * 1.5)).toBeLessThanOrEqual(1);
  });

  it("treats a knocked-out unit in the way as blocking", () => {
    const { events } = hookDamage([foe(2, 0)], true);
    expect(events).toContainEqual({
      type: "collided",
      unitId: "enemy-2-1",
      blockerId: "enemy-2-0",
    });
  });

  it("crashes against the front edge when the target is already in front", () => {
    const state = lancerTurn([foe(2, 0)]);
    const { events, state: after } = perform(state, "hook", at(2, 0));
    expect(events).toContainEqual({ type: "collided", unitId: "enemy-2-0" });
    expect(unitAtId(after, "enemy-2-0").position).toEqual({ col: 2, row: 0 });
  });

  it("doesn't move a target it knocks out", () => {
    const state = lancerTurn([foe(2, 1, 5)]);
    const { events, state: after } = perform(state, "hook", at(2, 1));
    expect(events.some((e) => e.type === "knockedOut")).toBe(true);
    expect(events.some((e) => e.type === "pushed")).toBe(false);
    expect(unitAtId(after, "enemy-2-1").position).toEqual({ col: 2, row: 1 });
  });
});

describe("Armor Pierce", () => {
  const armored = (defense: number) =>
    place(def("armored", { maxHp: 10_000, speed: 1, defense }), "enemy", 2, 0);

  it("is the Lancer's third skill", () => {
    expect(lancer.skills!.slice(0, 3)).toEqual([skewer, hook, armorPierce]);
  });

  it("hits as if the target had half its defense", () => {
    const state = lancerTurn([armored(40)]);
    const [self, target] = state.units;
    const pierced = previewDamage(self!, target!, armorPierce)!.amount;
    const halved = lancerTurn([armored(20)]);
    const plain = previewDamage(halved.units[0]!, halved.units[1]!)!.amount;
    expect(pierced).toBe(plain);
  });

  it("deals what the preview shows when it lands", () => {
    const state = lancerTurn([armored(40)]);
    const [self, target] = state.units;
    const expected = previewDamage(self!, target!, armorPierce)!.amount;
    const { events } = perform(state, armorPierce.id, at(2, 0));
    const hit = events.find((e): e is Damage => e.type === "damage")!;
    expect(hit.amount).toBeGreaterThanOrEqual(Math.floor(expected * 0.88));
    expect(hit.amount).toBeLessThanOrEqual(Math.ceil(expected * 1.12));
  });
});

describe("Staggering Thrust", () => {
  const withGauge = (gauge: number) => {
    const state = lancerTurn([foe(2, 0)]);
    unitAtId(state, "enemy-2-0").gauge = gauge;
    return state;
  };
  const thrust = (state: BattleState) =>
    perform(state, staggeringThrust.id, at(2, 0));

  it("is the Lancer's fourth skill", () => {
    expect(lancer.skills![3]).toBe(staggeringThrust);
  });

  it("knocks a quarter of a full gauge off a surviving target", () => {
    const { events, state } = thrust(withGauge(600));
    expect(damaged(events)).toEqual(["enemy-2-0"]);
    const gauge = 600 - 0.25 * GAUGE_FULL;
    expect(unitAtId(state, "enemy-2-0").gauge).toBe(gauge);
    expect(events).toContainEqual({
      type: "gaugeChanged",
      unitId: "enemy-2-0",
      gauge,
    });
  });

  it("stops at 0, and never lowers a gauge below 0", () => {
    expect(unitAtId(thrust(withGauge(100)).state, "enemy-2-0").gauge).toBe(0);
    expect(unitAtId(thrust(withGauge(-300)).state, "enemy-2-0").gauge).toBe(
      -300,
    );
  });

  it("leaves a casting target's gauge alone", () => {
    const state = withGauge(600);
    const cell = { side: "player", col: 2, row: 0 } as const;
    unitAtId(state, "enemy-2-0").casting = {
      skillId: "x",
      skillName: "X",
      cell,
      area: [cell],
      startedAt: 0,
      readyAt: 60,
    };
    expect(unitAtId(thrust(state).state, "enemy-2-0").gauge).toBe(600);
  });

  it("is worth more to the AI on a target with more gauge to lose", () => {
    const value = (gauge: number) => {
      const state = withGauge(gauge);
      return skillValue(
        state,
        unitAtId(state, "player-2-0"),
        staggeringThrust,
        at(2, 0),
      );
    };
    expect(value(600)).toBeGreaterThan(value(0));
  });
});

describe("Weakening Strike", () => {
  const strike = (state: BattleState) =>
    perform(state, weakeningStrike.id, at(2, 0));

  it("is the Lancer's fifth skill", () => {
    expect(lancer.skills).toEqual([
      skewer,
      hook,
      armorPierce,
      staggeringThrust,
      weakeningStrike,
    ]);
  });

  it("hits x0.8 and weakens a surviving target", () => {
    const state = lancerTurn([foe(2, 0)]);
    const [self, target] = state.units;
    const shot = previewDamage(self!, target!, weakeningStrike)!.amount;
    const plain = previewDamage(self!, target!)!.amount;
    expect(Math.abs(shot - plain * 0.8)).toBeLessThan(1);
    const { events, state: after } = strike(state);
    expect(damaged(events)).toEqual(["enemy-2-0"]);
    expect(unitAtId(after, "enemy-2-0").statuses.map((st) => st.id)).toContain(
      WEAKEN_STATUS.id,
    );
  });

  it("leaves no weakness on a target it knocks out", () => {
    const { state } = strike(lancerTurn([foe(2, 0, 1)]));
    expect(unitAtId(state, "enemy-2-0").statuses).toEqual([]);
  });

  it("makes the weakened deal x0.75 with weapons and spells", () => {
    const { state } = strike(lancerTurn([foe(2, 0)]));
    const weakened = unitAtId(state, "enemy-2-0");
    const lancerUnit = unitAtId(state, "player-2-0");
    const fresh = { ...weakened, statuses: [] };
    const bolt = {
      ...weakeningStrike,
      effect: {
        type: "damage" as const,
        kind: "magical" as const,
        element: "fire" as const,
        power: 1,
      },
    };
    for (const skill of [undefined, bolt]) {
      const weak = previewDamage(weakened, lancerUnit, skill)!.amount;
      const full = previewDamage(fresh, lancerUnit, skill)!.amount;
      expect(Math.abs(weak - full * WEAKEN_FACTOR)).toBeLessThanOrEqual(1);
    }
  });

  it("is worth more to the AI on a foe not yet weakened", () => {
    const value = (state: BattleState) =>
      skillValue(
        state,
        unitAtId(state, "player-2-0"),
        weakeningStrike,
        at(2, 0),
      );
    const fresh = lancerTurn([foe(2, 0)]);
    const weakened = lancerTurn([foe(2, 0)]);
    weakened.units[1]!.statuses.push({
      id: WEAKEN_STATUS.id,
      name: WEAKEN_STATUS.name,
      effect: "weaken",
      harmful: true,
      amount: 0,
      interval: 150,
      ticksLeft: 1,
      nextTickAt: 150,
      sourceId: "player-2-0",
    });
    expect(value(fresh)).toBeGreaterThan(value(weakened));
  });
});
