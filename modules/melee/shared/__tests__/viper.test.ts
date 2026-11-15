import { describe, expect, it } from "vitest";
import { advance, createBattle } from "../battle";
import { viper } from "../content";
import type { BattleEvent, BattleState, CombatantDef } from "../types";
import { def, place } from "./helpers";

type Tick = Extract<BattleEvent, { type: "statusTick" }>;

/**
 * A Viper (speed 13: first bite at about 77) against one AI-controlled
 * victim that never fights back. Runs the battle up to `until`.
 */
function bitten(victim: CombatantDef, until: number, victimHp?: number) {
  const start = createBattle(
    {
      placements: [
        place(viper, "enemy", 0),
        place(victim, "player", 0, 0, { control: "ai" }),
      ],
    },
    1,
  );
  const target = start.units.find((u) => u.side === "player")!;
  target.base.attack = 0;
  target.base.speed = 0;
  if (victimHp !== undefined) target.hp = victimHp;
  const { state, events } = advance(start, { until });
  return {
    state,
    events,
    victim: state.units.find((u) => u.side === "player")!,
  };
}

const ticks = (events: BattleEvent[]) =>
  events.filter((e): e is Tick => e.type === "statusTick");
const firstBite = (state: BattleState) => state.time;

describe("Viper venom", () => {
  it("poisons the target of a damaging bite", () => {
    const { events, victim } = bitten(def("archer", { maxHp: 500 }), 80);
    expect(events).toContainEqual({
      type: "statusApplied",
      unitId: victim.id,
      statusId: "poison",
      name: "Poison",
      ticks: 5,
    });
    expect(victim.statuses[0]).toMatchObject({
      id: "poison",
      amount: 4,
      effect: "damage",
    });
    expect(firstBite).toBeDefined();
  });

  it("deals 0.4 x attack poison damage every 30 game time", () => {
    // Bites at ~77, ~154, ... refresh the poison; the first tick is 30 later.
    const { events } = bitten(def("archer", { maxHp: 500 }), 140);
    const first = ticks(events);
    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first[0]).toMatchObject({
      amount: 4,
      effect: "damage",
      damageType: "poison",
      multiplier: 1,
    });
  });

  it("can knock a unit out on its own, which clears it", () => {
    // 6 HP: the bite (about 9) would kill outright, so start at 13: the bite
    // leaves about 4, and poison finishes the job.
    const tough = def("archer", { maxHp: 500, defense: 40 });
    const { events, victim } = bitten(tough, 400, 7);
    const ko = events.findIndex((e) => e.type === "knockedOut");
    expect(ko).toBeGreaterThan(-1);
    expect(events[ko - 1]?.type).toBe("statusTick");
    expect(victim.statuses).toEqual([]);
  });

  it("does not take hold on a target immune to poison", () => {
    const immune = {
      ...def("slime", { maxHp: 500 }),
      resistances: { poison: 0 },
    };
    const { events, victim } = bitten(immune, 200);
    expect(events.some((e) => e.type === "statusApplied")).toBe(false);
    expect(victim.statuses).toEqual([]);
  });

  it("refreshes rather than stacks on a second bite", () => {
    const { events, victim } = bitten(def("archer", { maxHp: 500 }), 160);
    expect(events.filter((e) => e.type === "statusApplied")).toHaveLength(2);
    expect(victim.statuses).toHaveLength(1);
  });
});
