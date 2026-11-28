// JRPG's rules. Battles come from the battle engine, imported through the
// workspace package "@jforge/battle" rather than a relative path; the
// units are jrpg's own, compiled from its content.
import {
  GRID_COLUMNS,
  simulate,
  type BattleSetup,
  type BattleSummary,
  type CombatantDef,
  type Placement,
} from "@jforge/battle";
import { jrpgUnit } from "./units";

const slime = jrpgUnit("enemy-slime");

/** Who sets out when no party has been designed in char. */
const defaultParty: CombatantDef[] = [
  jrpgUnit("melee-fighter"),
  jrpgUnit("melee-healer"),
];

/** Lines the party up: spread over the columns, each in its preferred row. */
function placeParty(party: CombatantDef[]): Placement[] {
  const step = GRID_COLUMNS / party.length;
  return party.map((def, i) => ({
    def,
    side: "player",
    position: {
      col: Math.floor(step * i + step / 2),
      row: def.preferredRow ?? 0,
    },
  }));
}

/** Placeholder first battle: the party against two slimes. */
export function openingBattleFor(party: CombatantDef[]): BattleSetup {
  return {
    placements: [
      ...placeParty(party),
      { def: slime, side: "enemy", position: { col: 1, row: 0 } },
      { def: slime, side: "enemy", position: { col: 3, row: 0 } },
    ],
  };
}

/** Auto-plays the opening battle with the battle engine. */
export function previewOpeningBattle(
  seed = 1,
  party: CombatantDef[] = defaultParty,
): BattleSummary {
  return simulate(openingBattleFor(party), seed);
}

export { jrpgUnit } from "./units";
export * from "./run";
export * from "./labels";
export { GEAR_TIERS, atTier, withGearTiers } from "./world";
export { formationOf, moveMember } from "./formation";
export * from "./learning";
export * from "./growth";
export * from "./progression";
