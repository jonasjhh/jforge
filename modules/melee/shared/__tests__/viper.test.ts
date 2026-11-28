import { describe, expect, it } from "vitest";
import { advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { viper } from "../content";
import type { BattleEvent, CombatantDef } from "@jforge/battle/engine/types.ts";
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

describe("Viper venom", () => {
  it("given a victim, when the viper bites, then it is poisoned for 4 a tick", () => {
    const victimDef = def("archer", { maxHp: 500 });

    const { events, victim } = bitten(victimDef, 80);

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
  });

  it("given a bitten victim, when 30 game time passes, then poison deals 0.4 x attack as poison damage", () => {
    const victimDef = def("archer", { maxHp: 500 });

    // Bites at ~77, ~154, ... refresh the poison; the first tick is 30 later.
    const { events } = bitten(victimDef, 140);

    const first = ticks(events);
    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first[0]).toMatchObject({
      amount: 4,
      effect: "damage",
      damageType: "poison",
      multiplier: 1,
    });
  });

  it("given a victim the bite leaves nearly dead, when poison ticks, then it knocks them out and is cleared", () => {
    // 7 HP and high defence: the bite leaves a few HP and poison finishes it.
    const tough = def("archer", { maxHp: 500, defence: 40 });

    const { events, victim } = bitten(tough, 400, 7);

    const ko = events.findIndex((e) => e.type === "knockedOut");
    expect(ko).toBeGreaterThan(-1);
    expect(events[ko - 1]?.type).toBe("statusTick");
    expect(victim.statuses).toEqual([]);
  });

  it("given a victim immune to poison, when bitten, then the poison doesn't take hold", () => {
    const immune = {
      ...def("slime", { maxHp: 500 }),
      resistances: { poison: 0 },
    };

    const { events, victim } = bitten(immune, 200);

    expect(events.some((e) => e.type === "statusApplied")).toBe(false);
    expect(victim.statuses).toEqual([]);
  });

  it("given a poisoned victim, when bitten again, then the poison is refreshed, not stacked", () => {
    const victimDef = def("archer", { maxHp: 500 });

    const { events, victim } = bitten(victimDef, 160);

    expect(events.filter((e) => e.type === "statusApplied")).toHaveLength(2);
    expect(victim.statuses).toHaveLength(1);
  });
});
