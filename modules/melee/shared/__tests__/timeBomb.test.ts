import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import {
  chronomancer,
  haste,
  quicken,
  rewind,
  slow,
  timeBomb,
} from "../content";
import { knockOutIfDown } from "@jforge/battle/engine/damage.ts";
import { skillValue } from "@jforge/battle/engine/aiSkills.ts";
import { offenseOf } from "@jforge/battle/engine/threat.ts";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Placement,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Chronomancer (player 2,2) is waiting for a command. */
function chronoTurn(others: Placement[]): BattleState {
  const fast = { ...chronomancer, stats: { ...chronomancer.stats, speed: 50 } };
  const start = createBattle(
    { placements: [place(fast, "player", 2, 2), ...others] },
    1,
  );
  return advance(start).state;
}
const foe = (col: number, row: number, maxHp = 10_000) =>
  place(def(`foe${col}${row}`, { maxHp, speed: 1 }), "enemy", col, row);
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
const MAGIC = chronomancer.stats.magic;

function plant(state: BattleState, cell: Cell) {
  return act(state, { type: "skill", skillId: timeBomb.id, cell });
}

/** Waits turn after turn until a bomb goes off; returns everything seen. */
function waitForBlast(state: BattleState) {
  const events: BattleEvent[] = [];
  let current = state;
  for (let i = 0; i < 50; i++) {
    const moved = advance(current);
    events.push(...moved.events);
    if (moved.events.some((e) => e.type === "exploded")) {
      return { state: moved.state, events };
    }
    const step = act(moved.state, { type: "wait" });
    events.push(...step.events);
    current = step.state;
    if (events.some((e) => e.type === "exploded")) break;
  }
  return { state: current, events };
}

describe("Chronomancer skills", () => {
  it("given the Chronomancer, when its skills are listed, then they are Haste, Slow, Quicken, Time Bomb and Rewind", () => {
    const skills = chronomancer.skills;

    expect(skills).toEqual([haste, slow, quicken, timeBomb, rewind]);
  });
});

describe("Time Bomb", () => {
  it("given a foe, when a bomb is planted on it, then it is worth the caster's magic, deals nothing yet and costs MP", () => {
    const state = chronoTurn([foe(2, 0)]);

    const { events, state: after } = plant(state, at(2, 0));

    const bomb = unit(after, "enemy-2-0").statuses[0]!;
    expect(events.some((e) => e.type === "damage")).toBe(false);
    expect(bomb).toMatchObject({ effect: "bomb", amount: MAGIC });
    expect(unit(after, "player-2-2").mp).toBe(
      chronomancer.stats.maxMp - timeBomb.mpCost,
    );
  });

  it("given a bomb on a foe among others, when its time runs out, then it explodes for arcane on the carrier and its neighbours", () => {
    const foes = [foe(2, 0), foe(1, 0), foe(3, 0), foe(2, 1), foe(0, 0)];
    const { state } = plant(chronoTurn(foes), at(2, 0));

    const { events, state: after } = waitForBlast(state);

    const hits = events.filter((e): e is Damage => e.type === "damage");
    expect(events).toContainEqual({
      type: "exploded",
      unitId: "enemy-2-0",
      name: "Time Bomb",
    });
    expect(hits.map((e) => e.unitId).sort()).toEqual([
      "enemy-1-0",
      "enemy-2-0",
      "enemy-2-1",
      "enemy-3-0",
    ]);
    expect(hits.every((e) => e.amount === MAGIC)).toBe(true);
    expect(hits.every((e) => e.damageType === "arcane")).toBe(true);
    expect(unit(after, "enemy-2-0").statuses).toEqual([]);
    expect(events.some((e) => e.type === "statusExpired")).toBe(false);
  });

  it("given a bomb on a front-row foe opposite an ally, when it explodes, then only the carrier's side is hit", () => {
    const { state } = plant(
      chronoTurn([foe(2, 0), place(def("ally"), "player", 2, 0)]),
      at(2, 0),
    );

    const { events } = waitForBlast(state);

    const hits = events.filter((e): e is Damage => e.type === "damage");
    expect(hits.map((e) => e.unitId)).toEqual(["enemy-2-0"]);
  });

  it("given a bomb carrier, when it is knocked out, then the bomb goes off at once, only once", () => {
    const { state } = plant(chronoTurn([foe(2, 0), foe(1, 0)]), at(2, 0));
    const carrier = unit(state, "enemy-2-0");
    carrier.hp = 0;
    const events: BattleEvent[] = [];

    knockOutIfDown(state, carrier, events);

    expect(events.map((e) => e.type)).toEqual([
      "knockedOut",
      "exploded",
      "damage",
    ]);
    expect(events[2]).toMatchObject({ unitId: "enemy-1-0", amount: MAGIC });
  });

  it("given bombs on two neighbours, when the first knocks out the second, then the second goes off too", () => {
    const { state: one } = plant(
      chronoTurn([foe(2, 0), foe(1, 0, 5), foe(0, 0)]),
      at(2, 0),
    );
    const { state: two } = plant(advance(one).state, at(1, 0));

    const { events } = waitForBlast(two);

    // The first bomb was planted earlier, so it goes off first.
    const blasts = events.filter((e) => e.type === "exploded");
    const hits = events.filter((e): e is Damage => e.type === "damage");
    expect(blasts.map((e) => e.unitId)).toEqual(["enemy-2-0", "enemy-1-0"]);
    expect(hits.map((e) => e.unitId)).toContain("enemy-0-0");
  });

  describe("as the AI sees it", () => {
    const value = (s: BattleState) =>
      skillValue(s, unit(s, "player-2-2"), timeBomb, at(2, 0));

    it("given a lone foe and a crowd, when the AI values a bomb, then both are worth it and the crowd more", () => {
      const lone = value(chronoTurn([foe(2, 0)]));

      const crowd = value(chronoTurn([foe(2, 0), foe(1, 0), foe(3, 0)]));

      expect(lone).toBeGreaterThan(0);
      expect(crowd).toBeGreaterThan(lone);
    });

    it("given a bomb already on the target, when the AI values another, then it is not worth it", () => {
      const crowd = chronoTurn([foe(2, 0), foe(1, 0), foe(3, 0)]);
      const again = advance(plant(crowd, at(2, 0)).state).state;

      const result = value(again);

      expect(result).toBeLessThan(0);
    });
  });

  it("given the Chronomancer with and without Time Bomb, when its offense is weighed, then the bomb counts as damage", () => {
    const without = { ...chronomancer, skills: [haste, slow, quicken, rewind] };

    const offense = offenseOf(chronomancer);

    expect(offense).toBeGreaterThan(offenseOf(without));
  });
});
