import { meleeHeroId } from "@jforge/content/catalogue";
import { jrpgLibrary } from "@jforge/content/jrpg";
import type { Member } from "../run";

export const ALDRIC = meleeHeroId("knight");
export const MIRA = meleeHeroId("sage");

/**
 * Aldric (Knight, front row) and Mira (Sage, back row) at level 3, in the
 * starter's gear: Iron Sword and Chain Mail, Oak Staff and Silk Robe.
 */
export function pair(library = jrpgLibrary()): Member[] {
  const hero = (id: string) => library.characters.find((c) => c.id === id)!;
  return [
    {
      ...hero(ALDRIC),
      level: 3,
      xp: 0,
      gear: { weapon: "weapon-sword", armor: "armour-mail" },
    },
    {
      ...hero(MIRA),
      level: 3,
      xp: 0,
      gear: { weapon: "weapon-staff", armor: "armour-robe" },
    },
  ];
}
