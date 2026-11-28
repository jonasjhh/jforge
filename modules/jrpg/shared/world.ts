import { type Gear, type Library } from "@jforge/rules/core";

// jrpg's rules on gear tiers. The world's content (enemies, gear) is in
// the catalogue (@jforge/content/catalogue/world.ts); jrpg picks it in
// @jforge/content/jrpg.

/** Better finds deeper in: each tier adds half again to what gear adds. */
export const GEAR_TIERS = ["", "Fine", "Superior", "Masterwork"] as const;
export const tierId = (id: string, tier: number) =>
  tier > 0 ? `${id}+${tier}` : id;

/** `gear` at a tier: its additions grow, its multipliers stay. */
export function atTier(gear: Gear, tier: number): Gear {
  if (tier <= 0) return gear;
  const name = `${GEAR_TIERS[tier]} ${gear.name}`;
  return {
    ...gear,
    id: tierId(gear.id, tier),
    name,
    bonuses: gear.bonuses.map((b) =>
      b.op === "add" && b.value > 0
        ? { ...b, value: Math.round(b.value * (1 + tier / 2)) }
        : b,
    ),
    ...(gear.weapon
      ? { weapon: { ...gear.weapon, id: tierId(gear.id, tier), name } }
      : {}),
  };
}

/**
 * The library a run plays with: `library` with every piece of gear at
 * every tier. How the enemies grow with levels is in growth.ts.
 */
export function withGearTiers(library: Library): Library {
  return {
    ...library,
    gear: GEAR_TIERS.flatMap((_, tier) =>
      library.gear.map((g) => atTier(g, tier)),
    ),
  };
}
