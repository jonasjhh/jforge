import { describe, expect, it } from "vitest";
import {
  blankArchetype,
  blankCharacter,
  compileRoster,
  LIBRARY_VERSION,
  emptyLibrary,
  flatStats,
  parseLibrary,
} from "@jforge/rules/core";
import { catalogue as starterLibrary } from "..";

describe("flatStats", () => {
  it("given a value, when flat stats are made, then each of the seven stats has it", () => {
    const stats = flatStats(7);

    expect(new Set(Object.values(stats))).toEqual(new Set([7]));
    expect(Object.keys(stats)).toHaveLength(7);
  });
});

describe("blank designs", () => {
  const blankLibrary = (kind: "class" | "enemy") => {
    const archetype = blankArchetype("t", kind);
    return {
      ...emptyLibrary(),
      archetypes: [archetype],
      characters: [blankCharacter("c", archetype)],
    };
  };

  it.each(["class", "enemy"] as const)(
    "given a blank %s and a character of it, when the library is saved and read back, then it is unchanged",
    (kind) => {
      const library = blankLibrary(kind);

      const back = parseLibrary(JSON.stringify(library));

      expect(back).toEqual(library);
    },
  );

  it.each([
    ["class", 1, 0],
    ["enemy", 0, 1],
  ] as const)(
    "given a blank %s and a character of it, when the roster is compiled, then melee can use it",
    (kind, party, monsters) => {
      const library = blankLibrary(kind);

      const roster = compileRoster(library);

      expect(roster.party).toHaveLength(party);
      expect(roster.monsters).toHaveLength(monsters);
    },
  );
});

describe("parseLibrary", () => {
  const starter = starterLibrary();
  const broken = (
    change: (lib: ReturnType<typeof starterLibrary>) => unknown,
  ) => JSON.stringify(change(starterLibrary()));

  it.each([
    ["no list", undefined, true],
    ["a list of ids", ["melee-fighter"], true],
    ["a list with a number", [3], false],
    ["a string", "melee-fighter", false],
  ])(
    "given a class whose comesFrom is %s, when it is parsed, then it is accepted only if valid",
    (_, comesFrom, valid) => {
      const text = broken((lib) => ({
        ...lib,
        archetypes: lib.archetypes.map((a, i) =>
          i === 0 ? { ...a, comesFrom } : a,
        ),
      }));

      const library = parseLibrary(text);

      expect(library !== null).toBe(valid);
    },
  );

  it("given an exported library, when it is parsed, then it reads back unchanged", () => {
    const text = JSON.stringify(starter);

    const library = parseLibrary(text);

    expect(library).toEqual(starter);
  });

  it.each<[string, string | null]>([
    ["nothing", null],
    ["broken JSON", "{"],
    [
      "another version",
      broken((lib) => ({ ...lib, version: LIBRARY_VERSION + 1 })),
    ],
    ["a missing list", broken((lib) => ({ ...lib, gear: undefined }))],
    [
      "a skill with no effect",
      broken((lib) => ({ ...lib, skills: [{ id: "x", name: "X" }] })),
    ],
    [
      "gear of another slot's category",
      broken((lib) => ({
        ...lib,
        gear: [{ ...lib.gear[0], slot: "weapon", category: "robe" }],
      })),
    ],
    [
      "a class using an unknown category",
      broken((lib) => ({
        ...lib,
        archetypes: [{ ...lib.archetypes[0], proficiencies: ["hat"] }],
      })),
    ],
    [
      "gear in an unknown slot",
      broken((lib) => ({ ...lib, gear: [{ ...lib.gear[0], slot: "hat" }] })),
    ],
    [
      "a bonus to an unknown stat",
      broken((lib) => ({
        ...lib,
        gear: [
          { ...lib.gear[0], bonuses: [{ stat: "luck", op: "add", value: 1 }] },
        ],
      })),
    ],
    [
      "a type missing a stat",
      broken((lib) => ({
        ...lib,
        archetypes: [{ ...lib.archetypes[0], baseStats: { maxHp: 5 } }],
      })),
    ],
    [
      "a type with an unknown trait",
      broken((lib) => ({
        ...lib,
        archetypes: [{ ...lib.archetypes[0], traits: ["ghost"] }],
      })),
    ],
    [
      "a character whose type is not named by id",
      broken((lib) => ({
        ...lib,
        characters: [{ ...lib.characters[0], archetypeId: 3 }],
      })),
    ],
    [
      "a weapon melee would refuse",
      broken((lib) => {
        (lib.archetypes[0]!.weapon as { damageType: string }).damageType =
          "love";
        lib.characters[0]!.gear = {};
        return lib;
      }),
    ],
  ])("given %s, when it is parsed, then there is no library", (_, text) => {
    const library = parseLibrary(text);

    expect(library).toBeNull();
  });
});
