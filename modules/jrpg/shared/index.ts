// JRPG's rules. Battles come from melee, imported through the workspace
// package "@jforge/melee" rather than a relative path, the same way any
// module depends on another.
import {
  GRID_COLUMNS,
  MAX_PARTY_SIZE,
  content,
  simulate,
  type BattleSetup,
  type BattleSummary,
  type CombatantDef,
  type Placement,
  type Roster,
} from "@jforge/melee/shared";

const { fighter, healer, slime } = content;

/** Who sets out when no party has been designed in char. */
export const defaultParty: CombatantDef[] = [fighter, healer];

/**
 * The adventuring party: the characters published by the char module (the
 * first five), or the default heroes when there are none.
 */
export function partyFrom(roster: Roster): CombatantDef[] {
  return roster.party.length > 0
    ? roster.party.slice(0, MAX_PARTY_SIZE)
    : defaultParty;
}

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

export const openingBattle: BattleSetup = openingBattleFor(defaultParty);

/** Auto-plays the opening battle with melee's engine. */
export function previewOpeningBattle(
  seed = 1,
  party: CombatantDef[] = defaultParty,
): BattleSummary {
  return simulate(openingBattleFor(party), seed);
}

export * from "./run";
export * from "./labels";
export { GEAR_TIERS, atTier, withWorld } from "./world";
