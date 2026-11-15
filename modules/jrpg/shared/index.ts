// JRPG's rules. Combat comes from melee, imported through the workspace
// package "@jforge/melee" rather than a relative path, the same way any
// module depends on another.
import { strike, type Fighter, type StrikeResult } from "@jforge/melee/shared";

export interface Party {
  hero: Fighter;
  enemy: Fighter;
}

export const openingBattle: Party = {
  hero: { name: "Hero", attack: 5, defense: 2, hp: 20 },
  enemy: { name: "Slime", attack: 3, defense: 1, hp: 8 },
};

/** One turn: the hero strikes first, the enemy answers if still standing. */
export function playTurn({ hero, enemy }: Party): StrikeResult[] {
  const first = strike(hero, enemy);
  if (first.knockedOut) return [first];
  return [first, strike(enemy, hero)];
}
