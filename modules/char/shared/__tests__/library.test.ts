import { describe, expect, it } from "vitest";
import {
  blankArchetype,
  blankCharacter,
  blankGear,
  blankSkill,
  emptyLibrary,
  flatStats,
  nextId,
  parseLibrary,
  remove,
  upsert,
} from "../library";
import { compileRoster } from "../compile";
import { starterLibrary } from "../starter";
import { designedLibrary } from "./designed";

describe("flatStats", () => {
  it("given a value, when flat stats are made, then each of the seven stats has it", () => {
    const stats = flatStats(7);

    expect(new Set(Object.values(stats))).toEqual(new Set([7]));
    expect(Object.keys(stats)).toHaveLength(7);
  });
});

describe("nextId", () => {
  it.each([
    ["skills", "skill-1"],
    ["archetypes", "type-1"],
  ] as const)(
    "given an empty library, when the next id for %s is drawn, then it counts from 1",
    (list, id) => {
      const next = nextId(emptyLibrary(), list);

      expect(next).toBe(id);
    },
  );

  it("given gear-1 and gear-3, when the next gear id is drawn, then it fills the gap", () => {
    let library = emptyLibrary();
    library = upsert(library, "gear", blankGear("gear-1"));
    library = upsert(library, "gear", blankGear("gear-3"));

    const next = nextId(library, "gear");

    expect(next).toBe("gear-2");
  });

  it("given characters unit-1 to unit-3, when the next character id is drawn, then it skips those in use", () => {
    const library = designedLibrary();

    const next = nextId(library, "characters");

    expect(next).toBe("unit-4");
  });
});

describe("upsert", () => {
  it("given a skill with a new id, when it is upserted, then it is added at the end", () => {
    const library = upsert(starterLibrary(), "skills", blankSkill("new"));

    expect(library.skills.at(-1)?.id).toBe("new");
  });

  it("given gear with an id in use, when it is upserted, then it replaces that item in place", () => {
    const before = starterLibrary();
    const renamed = { ...before.gear[0]!, name: "Renamed" };

    const after = upsert(before, "gear", renamed);

    expect(after.gear).toHaveLength(before.gear.length);
    expect(after.gear[0]?.name).toBe("Renamed");
  });

  it("given a library, when an item is upserted, then the library given is unchanged", () => {
    const before = starterLibrary();

    upsert(before, "skills", blankSkill("new"));

    expect(before.skills.some((s) => s.id === "new")).toBe(false);
  });
});

describe("remove", () => {
  const library = designedLibrary();

  it("given a class others come from, when it is removed, then their links to it go and the rest stay", () => {
    const [a, b, c] = ["path-a", "path-b", "path-c"].map((id) =>
      blankArchetype(id, "class"),
    );
    const linked = {
      ...emptyLibrary(),
      archetypes: [
        a!,
        b!,
        { ...c!, comesFrom: ["path-a", "path-b"] },
        { ...blankArchetype("path-d", "class"), comesFrom: ["path-a"] },
      ],
    };

    const after = remove(linked, "archetypes", "path-a");

    expect(after.archetypes.map((t) => t.comesFrom)).toEqual([
      undefined,
      ["path-b"],
      undefined,
    ]);
  });

  it("given a skill classes know, when it is removed, then it is gone and no class knows it", () => {
    const after = remove(library, "skills", "heal");

    expect(after.skills.some((s) => s.id === "heal")).toBe(false);
    expect(
      after.archetypes.flatMap((a) => a.skills).some((id) => id === "heal"),
    ).toBe(false);
  });

  it("given a sword someone wears, when it is removed, then it is taken off them", () => {
    const after = remove(library, "gear", "gear-sword");

    expect(after.characters[0]?.gear).toEqual({ armor: "gear-mail" });
  });

  it("given a type with characters, when it is removed, then its characters go too", () => {
    const after = remove(library, "archetypes", "type-squire");

    expect(after.characters.map((c) => c.name)).toEqual(
      library.characters.slice(1).map((c) => c.name),
    );
  });

  it("given a character, when it is removed, then only the character goes", () => {
    const after = remove(library, "characters", "unit-1");

    expect(after.characters).toHaveLength(library.characters.length - 1);
    expect(after.archetypes).toHaveLength(library.archetypes.length);
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
    ["another version", broken((lib) => ({ ...lib, version: 2 }))],
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
