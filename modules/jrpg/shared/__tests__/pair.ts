import {
  meleeHeroId,
  starterLibrary,
  type Character,
} from "@jforge/char/shared";

export const ALDRIC = meleeHeroId("knight");
export const MIRA = meleeHeroId("sage");

/**
 * Aldric (Knight, front row) and Mira (Sage, back row) at level 3, in the
 * starter's gear: Iron Sword and Chain Mail, Oak Staff and Silk Robe.
 */
export function pair(library = starterLibrary()): Character[] {
  const hero = (id: string) => library.characters.find((c) => c.id === id)!;
  return [
    {
      ...hero(ALDRIC),
      level: 3,
      gear: { weapon: "gear-sword", armor: "gear-mail" },
    },
    {
      ...hero(MIRA),
      level: 3,
      gear: { weapon: "gear-staff", armor: "gear-robe" },
    },
  ];
}
