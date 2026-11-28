import { describe, expect, it } from "vitest";
import { MAX_PARTY_SIZE, createBattle } from "@jforge/battle";
import { catalogue, meleeClasses } from "@jforge/content/catalogue";
import {
  blankCharacter,
  compileRoster,
  isCreature,
  toCreature,
} from "@jforge/rules/core";

// The catalogue's designs, compiled as a game compiles them, fielded in
// the battle engine.

describe("the catalogue in battle", () => {
  it.each(meleeClasses().map((type) => [type.name, type] as const))(
    "given a character of melee's %s class, when it is compiled and fielded, then the battle accepts it",
    (_, type) => {
      const library = catalogue();

      const def = toCreature(library, blankCharacter("x", type))!;
      const start = () =>
        createBattle(
          {
            placements: [
              { def, side: "player", position: { col: 0, row: 0 } },
              { def, side: "enemy", position: { col: 0, row: 0 } },
            ],
          },
          1,
        );

      expect(isCreature(def)).toBe(true);
      expect(def.skills).toHaveLength(type.skills.length);
      expect(start).not.toThrow();
    },
  );

  it("given the catalogue's compiled roster, when a battle is started from it, then it starts", () => {
    const { party, monsters } = compileRoster(catalogue());

    const start = () =>
      createBattle(
        {
          placements: [
            ...party.slice(0, MAX_PARTY_SIZE).map((def, col) => ({
              def,
              side: "player" as const,
              position: { col, row: 0 },
            })),
            { def: monsters[0]!, side: "enemy", position: { col: 0, row: 0 } },
          ],
        },
        1,
      );

    expect(start).not.toThrow();
  });
});
