// JRPG's rules. Battles come from melee, imported through the workspace
// package "@jforge/melee" rather than a relative path, the same way any
// module depends on another.
import {
  content,
  simulate,
  type BattleSetup,
  type BattleSummary,
} from "@jforge/melee/shared";

const { fighter, healer, slime } = content;

/** Placeholder first battle: two heroes against two slimes. */
export const openingBattle: BattleSetup = {
  placements: [
    { def: fighter, side: "player", position: { col: 1, row: 0 } },
    { def: healer, side: "player", position: { col: 3, row: 2 } },
    { def: slime, side: "enemy", position: { col: 1, row: 0 } },
    { def: slime, side: "enemy", position: { col: 3, row: 0 } },
  ],
};

/** Auto-plays the opening battle with melee's engine. */
export function previewOpeningBattle(seed = 1): BattleSummary {
  return simulate(openingBattle, seed);
}
