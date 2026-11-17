import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { chronomancer, haste, quicken, slow, timeBomb } from "../content";
import { knockOutIfDown } from "../damage";
import { skillValue } from "../aiSkills";
import { offenseOf } from "../threat";
import type { BattleEvent, BattleState, Cell, Placement } from "../types";
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
const bombDef =
  timeBomb.effect.type === "status" ? timeBomb.effect.status : null;
/** What one bomb deals: its power x the caster's magic. */
const BLAST = Math.round(bombDef!.power * chronomancer.stats.magic);

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
  it("are Haste, Slow, Quicken and Time Bomb", () => {
    expect(chronomancer.skills).toEqual([haste, slow, quicken, timeBomb]);
  });
});

describe("Time Bomb", () => {
  it("plants a bomb worth its power x the caster's magic and deals nothing yet", () => {
    const { events, state } = plant(chronoTurn([foe(2, 0)]), at(2, 0));
    expect(events.some((e) => e.type === "damage")).toBe(false);
    const bomb = unit(state, "enemy-2-0").statuses[0]!;
    expect(bomb).toMatchObject({ effect: "bomb", amount: BLAST });
    expect(unit(state, "player-2-2").mp).toBe(
      chronomancer.stats.maxMp - timeBomb.mpCost,
    );
  });

  it("explodes when its time runs out, on the carrier and its neighbours", () => {
    const foes = [foe(2, 0), foe(1, 0), foe(3, 0), foe(2, 1), foe(0, 0)];
    const { state } = plant(chronoTurn(foes), at(2, 0));
    const { events, state: after } = waitForBlast(state);
    expect(events).toContainEqual({
      type: "exploded",
      unitId: "enemy-2-0",
      name: "Time Bomb",
    });
    const hits = events.filter((e): e is Damage => e.type === "damage");
    expect(hits.map((e) => e.unitId).sort()).toEqual([
      "enemy-1-0",
      "enemy-2-0",
      "enemy-2-1",
      "enemy-3-0",
    ]);
    expect(hits.every((e) => e.amount === BLAST)).toBe(true);
    expect(hits.every((e) => e.damageType === "arcane")).toBe(true);
    expect(unit(after, "enemy-2-0").statuses).toEqual([]);
    expect(events.some((e) => e.type === "statusExpired")).toBe(false);
  });

  it("stays on the carrier's side of the field", () => {
    const { state } = plant(
      chronoTurn([foe(2, 0), place(def("ally"), "player", 2, 0)]),
      at(2, 0),
    );
    const { events } = waitForBlast(state);
    const hits = events.filter((e): e is Damage => e.type === "damage");
    expect(hits.map((e) => e.unitId)).toEqual(["enemy-2-0"]);
  });

  it("goes off at once when the carrier falls, and only once", () => {
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
    expect(events[2]).toMatchObject({ unitId: "enemy-1-0", amount: BLAST });
  });

  it("sets off a bomb on a neighbour it knocks out", () => {
    const { state: one } = plant(
      chronoTurn([foe(2, 0), foe(1, 0, 5), foe(0, 0)]),
      at(2, 0),
    );
    const { state: two } = plant(advance(one).state, at(1, 0));
    // The first bomb was planted earlier, so it goes off first.
    const { events } = waitForBlast(two);
    const blasts = events.filter((e) => e.type === "exploded");
    expect(blasts.map((e) => e.unitId)).toEqual(["enemy-2-0", "enemy-1-0"]);
    const hits = events.filter((e): e is Damage => e.type === "damage");
    expect(hits.map((e) => e.unitId)).toContain("enemy-0-0");
  });

  it("is worth more to the AI the more foes stand around the target", () => {
    const lone = chronoTurn([foe(2, 0)]);
    const crowd = chronoTurn([foe(2, 0), foe(1, 0), foe(3, 0)]);
    const value = (s: BattleState) =>
      skillValue(s, unit(s, "player-2-2"), timeBomb, at(2, 0));
    expect(value(lone)).toBeGreaterThan(0);
    expect(value(crowd)).toBeGreaterThan(value(lone));
    const { state: planted } = plant(crowd, at(2, 0));
    const again = advance(planted).state;
    expect(
      skillValue(again, unit(again, "player-2-2"), timeBomb, at(2, 0)),
    ).toBeLessThan(0);
  });

  it("counts toward the Chronomancer's threat as damage", () => {
    const without = { ...chronomancer, skills: [haste, slow, quicken] };
    expect(offenseOf(chronomancer)).toBeGreaterThan(offenseOf(without));
  });
});
