import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import {
  armourPierce,
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
  it.each([
    ["the unit behind the front-most", "enemy-2-1", false],
    ["the unit two behind", "enemy-2-2", true],
  ])(
    "given a column of three foes, when the Lancer attacks %s, then it is out of reach: %s",
    (_, targetId, refused) => {
      const state = lancerTurn([foe(2, 0), foe(2, 1), foe(2, 2)]);

      const attack = () => act(state, { type: "attack", targetId });

      if (refused) expect(attack).toThrow(/out of reach/);
      else expect(attack).not.toThrow();
    },
  );
});

describe("Skewer", () => {
  it("given foes in and around a column, when the front one is skewered, then it and the one behind are hit, for the MP cost", () => {
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

  it("given a foe past the spear's reach, when it is skewered, then it is refused", () => {
    const state = lancerTurn([foe(2, 0), foe(2, 1), foe(2, 2)]);

    const skewerFar = () => perform(state, "skewer", at(2, 2));

    expect(skewerFar).toThrow(/out of reach/);
  });
});

describe("Hook", () => {
  it("given an empty cell in front of the target, when it is hooked, then it is pulled one row forward, for the MP cost", () => {
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

  it("given a unit in the way, when the target is hooked, then it crashes into it for x1.5 instead of moving", () => {
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

  it("given a knocked-out unit in the way, when the target is hooked, then it crashes into it", () => {
    const blocker = [foe(2, 0)];

    const { events } = hookDamage(blocker, true);

    expect(events).toContainEqual({
      type: "collided",
      unitId: "enemy-2-1",
      blockerId: "enemy-2-0",
    });
  });

  it("given the target already in front, when it is hooked, then it crashes against the front edge", () => {
    const state = lancerTurn([foe(2, 0)]);

    const { events, state: after } = perform(state, "hook", at(2, 0));

    expect(events).toContainEqual({ type: "collided", unitId: "enemy-2-0" });
    expect(unitAtId(after, "enemy-2-0").position).toEqual({ col: 2, row: 0 });
  });

  it("given a frail target, when the hook knocks it out, then it isn't moved", () => {
    const state = lancerTurn([foe(2, 1, 5)]);

    const { events, state: after } = perform(state, "hook", at(2, 1));

    expect(events.some((e) => e.type === "knockedOut")).toBe(true);
    expect(events.some((e) => e.type === "pushed")).toBe(false);
    expect(unitAtId(after, "enemy-2-1").position).toEqual({ col: 2, row: 1 });
  });
});

describe("Armour Pierce", () => {
  const armoured = (defense: number) =>
    place(def("armoured", { maxHp: 10_000, speed: 1, defense }), "enemy", 2, 0);

  it("given a target of defense 40, when Armour Pierce is previewed, then it hits as a plain attack on defense 20", () => {
    const state = lancerTurn([armoured(40)]);
    const [self, target] = state.units;
    const halved = lancerTurn([armoured(20)]);
    const plain = previewDamage(halved.units[0]!, halved.units[1]!)!.amount;

    const pierced = previewDamage(self!, target!, armourPierce)!.amount;

    expect(pierced).toBe(plain);
  });

  it("given its preview, when Armour Pierce lands, then it deals the previewed damage within the spread", () => {
    const state = lancerTurn([armoured(40)]);
    const [self, target] = state.units;
    const expected = previewDamage(self!, target!, armourPierce)!.amount;

    const { events } = perform(state, armourPierce.id, at(2, 0));

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

  it("given a target at gauge 600, when it is thrust at, then it is hit and loses a quarter of a full gauge", () => {
    const state = withGauge(600);

    const { events, state: after } = thrust(state);

    const gauge = 600 - 0.25 * GAUGE_FULL;
    expect(damaged(events)).toEqual(["enemy-2-0"]);
    expect(unitAtId(after, "enemy-2-0").gauge).toBe(gauge);
    expect(events).toContainEqual({
      type: "gaugeChanged",
      unitId: "enemy-2-0",
      gauge,
    });
  });

  it.each([
    [100, 0],
    [-300, -300],
  ])(
    "given a target at gauge %d, when it is thrust at, then its gauge is %d, never below 0 from the thrust",
    (start, end) => {
      const state = withGauge(start);

      const { state: after } = thrust(state);

      expect(unitAtId(after, "enemy-2-0").gauge).toBe(end);
    },
  );

  it("given a casting target, when it is thrust at, then its gauge is left alone", () => {
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

    const { state: after } = thrust(state);

    expect(unitAtId(after, "enemy-2-0").gauge).toBe(600);
  });

  it("given targets with more and less gauge, when the AI values the thrust, then the fuller one is worth more", () => {
    const value = (gauge: number) => {
      const state = withGauge(gauge);
      return skillValue(
        state,
        unitAtId(state, "player-2-0"),
        staggeringThrust,
        at(2, 0),
      );
    };
    const empty = value(0);

    const full = value(600);

    expect(full).toBeGreaterThan(empty);
  });
});

describe("Weakening Strike", () => {
  const strike = (state: BattleState) =>
    perform(state, weakeningStrike.id, at(2, 0));

  it("given the Lancer, when its skills are listed, then they are its five", () => {
    const skills = lancer.skills;

    expect(skills).toEqual([
      skewer,
      hook,
      armourPierce,
      staggeringThrust,
      weakeningStrike,
    ]);
  });

  it("given a foe, when Weakening Strike is previewed, then it hits x0.8", () => {
    const state = lancerTurn([foe(2, 0)]);
    const [self, target] = state.units;
    const plain = previewDamage(self!, target!)!.amount;

    const shot = previewDamage(self!, target!, weakeningStrike)!.amount;

    expect(Math.abs(shot - plain * 0.8)).toBeLessThan(1);
  });

  it("given a sturdy foe, when it is struck, then it is hit and weakened", () => {
    const state = lancerTurn([foe(2, 0)]);

    const { events, state: after } = strike(state);

    expect(damaged(events)).toEqual(["enemy-2-0"]);
    expect(unitAtId(after, "enemy-2-0").statuses.map((st) => st.id)).toContain(
      WEAKEN_STATUS.id,
    );
  });

  it("given a foe at 1 HP, when the strike knocks it out, then no weakness is left", () => {
    const state = lancerTurn([foe(2, 0, 1)]);

    const { state: after } = strike(state);

    expect(unitAtId(after, "enemy-2-0").statuses).toEqual([]);
  });

  it.each([
    ["a weapon", undefined],
    [
      "a spell",
      {
        ...weakeningStrike,
        effect: {
          type: "damage" as const,
          kind: "magical" as const,
          element: "fire" as const,
          power: 1,
        },
      },
    ],
  ])(
    "given a weakened foe, when it strikes back with %s, then it deals x0.75",
    (_, skill) => {
      const { state } = strike(lancerTurn([foe(2, 0)]));
      const weakened = unitAtId(state, "enemy-2-0");
      const lancerUnit = unitAtId(state, "player-2-0");
      const full = previewDamage(
        { ...weakened, statuses: [] },
        lancerUnit,
        skill,
      )!.amount;

      const weak = previewDamage(weakened, lancerUnit, skill)!.amount;

      expect(Math.abs(weak - full * WEAKEN_FACTOR)).toBeLessThanOrEqual(1);
    },
  );

  it("given a fresh and a weakened foe, when the AI values the strike, then the fresh one is worth more", () => {
    const value = (state: BattleState) =>
      skillValue(
        state,
        unitAtId(state, "player-2-0"),
        weakeningStrike,
        at(2, 0),
      );
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
    const already = value(weakened);

    const fresh = value(lancerTurn([foe(2, 0)]));

    expect(fresh).toBeGreaterThan(already);
  });
});
