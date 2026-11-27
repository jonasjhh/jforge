import { describe, expect, it } from "vitest";
import { forGame } from "../games";
import { blankArchetype, blankCharacter, emptyLibrary } from "../library";
import type { Archetype, Game, Library } from "../types";

const type = (id: string, games: Game[]): Archetype => ({
  ...blankArchetype(id, "class"),
  games,
});

/** A knight in every game, a squire in none, a wolf only in jrpg; one of each as a character. */
const library = (): Library => {
  const archetypes = [
    type("knight", ["melee", "jrpg", "autob"]),
    type("squire", []),
    { ...type("wolf", ["jrpg"]), kind: "enemy" as const },
  ];
  return {
    ...emptyLibrary(),
    archetypes,
    characters: archetypes.map((a) => blankCharacter(`hero-${a.id}`, a)),
  };
};
const ids = (items: { id: string }[]) => items.map((x) => x.id);

describe("forGame", () => {
  it("given designs ticked for different games, when melee's library is taken, then only the knight and its character are in it", () => {
    const lib = library();

    const melee = forGame(lib, "melee");

    expect(ids(melee.archetypes)).toEqual(["knight"]);
    expect(ids(melee.characters)).toEqual(["hero-knight"]);
  });

  it("given designs ticked for different games, when jrpg's library is taken, then the enemy type ticked for it is in it too", () => {
    const lib = library();

    const jrpg = forGame(lib, "jrpg");

    expect(ids(jrpg.archetypes)).toEqual(["knight", "wolf"]);
  });

  it("given a squire in no game, when any game's library is taken, then the squire is never in it", () => {
    const lib = library();

    const seen = (["melee", "jrpg", "autob"] as const).flatMap((g) =>
      ids(forGame(lib, g).archetypes),
    );

    expect(seen).not.toContain("squire");
  });
});
