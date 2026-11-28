import type { BattleEvent } from "../engine";
import { resistanceKind } from "./labels";

/** A damage or heal number floating up over a unit. */
export interface Hit {
  key: number;
  unitId: string;
  amount: number;
  kind: "damage" | "heal";
  /** How the target's resistance changed a damage hit, or a shield took it. */
  tag?: "weak" | "resist" | "immune" | "shield";
  /** Damage from an effect over time, e.g. poison. */
  overTime?: boolean;
}

/** Damage and heal numbers to float up for a step's events. */
export function hitsFrom(events: BattleEvent[], nextKey: () => number): Hit[] {
  return events.flatMap((e): Hit[] => {
    if (e.type === "heal" || (e.type === "statusTick" && e.effect === "heal")) {
      if (e.amount <= 0) return [];
      return [
        { key: nextKey(), unitId: e.unitId, amount: e.amount, kind: "heal" },
      ];
    }
    if (e.type === "revived") {
      return [{ key: nextKey(), unitId: e.unitId, amount: e.hp, kind: "heal" }];
    }
    if (e.type === "statusTick") {
      if (e.amount <= 0) return [];
      return [
        {
          key: nextKey(),
          unitId: e.unitId,
          amount: e.amount,
          kind: "damage",
          overTime: true,
        },
      ];
    }
    if (e.type !== "damage") return [];
    return [
      {
        key: nextKey(),
        unitId: e.unitId,
        amount: e.amount,
        kind: "damage",
        // A hit fully soaked by a shield shows as SHIELD.
        tag:
          e.amount === 0 && e.absorbed
            ? "shield"
            : resistanceKind(e.multiplier),
      },
    ];
  });
}
