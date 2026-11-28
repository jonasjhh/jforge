import type { BattleEvent, StatusDef, Unit } from "./types";

// A rending hit (the Fighter's Rend) leaves its target bleeding: slash
// damage over time that worsens each time the bleeding unit acts. Built
// into the strike, as with Fire Arrow's burn.

/** What a rending hit leaves on a target that survives it. */
export const BLEED: StatusDef = {
  id: "bleeding",
  name: "Bleeding",
  effect: "damage",
  harmful: true,
  damageType: "slash",
  stat: "attack",
  power: 0.15,
  interval: 30,
  ticks: 5,
  worsens: 0.5,
};

/**
 * Called after `unit` attacks, uses a skill or moves (not after it defends
 * or waits): each status on it that worsens deals more on its later ticks.
 */
export function worsenOnAction(unit: Unit, events: BattleEvent[]): void {
  for (const status of unit.statuses) {
    if (!status.growth) continue;
    status.amount += status.growth;
    events.push({
      type: "statusWorsened",
      unitId: unit.id,
      statusId: status.id,
      name: status.name,
      amount: status.amount,
    });
  }
}
