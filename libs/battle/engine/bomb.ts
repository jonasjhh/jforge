import { areaCells, unitAt } from "./grid";
import {
  knockOutIfDown,
  reportDefences,
  resistance,
  sufferDamage,
} from "./damage";
import { isAlive } from "./stats";
import type { BattleEvent, BattleState, Cell, Status, Unit } from "./types";

// A time bomb (the Chronomancer's Time Bomb) is a status that explodes
// when it runs out, or when the unit carrying it falls first. The blast
// covers a plus around the carrier, on the carrier's own side only, and
// hits everyone standing there, the carrier included. Like other damage
// over time, its amount was fixed when it was applied and spirit doesn't
// reduce it; resistances do. Built in, not a general second effect.

/** The cells a bomb carried at `cell` blows up: a plus on its side. */
export function blastCells(cell: Cell): Cell[] {
  return areaCells(cell, "plus").filter((c) => c.side === cell.side);
}

/**
 * Sets off `bomb` on `carrier`, where it stands (or stood, if it just
 * fell). The bomb comes off first, so a carrier the blast knocks out
 * can't set it off again; another bomb a victim carries goes off in turn.
 */
export function explode(
  state: BattleState,
  carrier: Unit,
  bomb: Status,
  cell: Cell,
  events: BattleEvent[],
): void {
  carrier.statuses = carrier.statuses.filter((s) => s !== bomb);
  events.push({ type: "exploded", unitId: carrier.id, name: bomb.name });
  const element = bomb.damageType ?? "arcane";
  for (const c of blastCells(cell)) {
    const victim = unitAt(state, c);
    if (!victim || !isAlive(victim)) continue;
    const multiplier = resistance(victim, element);
    const suffered = sufferDamage(victim, Math.round(bomb.amount * multiplier));
    events.push({
      type: "damage",
      unitId: victim.id,
      amount: suffered.lost,
      hp: victim.hp,
      damageType: element,
      multiplier,
      ...(suffered.absorbed ? { absorbed: suffered.absorbed } : {}),
    });
    reportDefences(victim, suffered, events);
    knockOutIfDown(state, victim, events);
  }
}

/** The bomb `unit` carries, if any. */
export function bombOn(unit: Unit): Status | undefined {
  return unit.statuses.find((s) => s.effect === "bomb");
}
