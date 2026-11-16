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
import { MAX_LEVEL } from "../progression";
import { starterLibrary } from "../starter";

describe("flatStats", () => {
  it("gives every stat the same value", () => {
    expect(new Set(Object.values(flatStats(7)))).toEqual(new Set([7]));
    expect(Object.keys(flatStats(7))).toHaveLength(7);
  });
});

describe("nextId", () => {
  it("counts up from 1 within a list", () => {
    expect(nextId(emptyLibrary(), "skills")).toBe("skill-1");
    expect(nextId(emptyLibrary(), "archetypes")).toBe("type-1");
  });

  it("skips ids in use and fills gaps", () => {
    let library = emptyLibrary();
    library = upsert(library, "gear", blankGear("gear-1"));
    library = upsert(library, "gear", blankGear("gear-3"));
    expect(nextId(library, "gear")).toBe("gear-2");
    // The starter library already has unit-1 to unit-3.
    expect(nextId(starterLibrary(), "characters")).toBe("unit-4");
  });
});

describe("upsert", () => {
  it("adds a new item at the end", () => {
    const library = upsert(starterLibrary(), "skills", blankSkill("new"));
    expect(library.skills.at(-1)?.id).toBe("new");
  });

  it("replaces the item with the same id, in place", () => {
    const before = starterLibrary();
    const renamed = { ...before.gear[0]!, name: "Renamed" };
    const after = upsert(before, "gear", renamed);
    expect(after.gear).toHaveLength(before.gear.length);
    expect(after.gear[0]?.name).toBe("Renamed");
  });

  it("leaves the library it was given alone", () => {
    const before = starterLibrary();
    upsert(before, "skills", blankSkill("new"));
    expect(before.skills.some((s) => s.id === "new")).toBe(false);
  });
});

describe("remove", () => {
  const library = starterLibrary();

  it("removes a skill and unlearns it everywhere", () => {
    const after = remove(library, "skills", "heal");
    expect(after.skills.some((s) => s.id === "heal")).toBe(false);
    expect(
      after.archetypes
        .flatMap((a) => a.skills)
        .some((u) => u.skillId === "heal"),
    ).toBe(false);
  });

  it("removes gear and takes it off whoever wore it", () => {
    const after = remove(library, "gear", "gear-sword");
    expect(after.characters[0]?.gear).toEqual({ armor: "gear-mail" });
  });

  it("removes a type together with its characters", () => {
    const after = remove(library, "archetypes", "type-knight");
    expect(after.characters.map((c) => c.name)).toEqual(
      library.characters.slice(1).map((c) => c.name),
    );
  });

  it("removes just the character", () => {
    const after = remove(library, "characters", "unit-1");
    expect(after.characters).toHaveLength(library.characters.length - 1);
    expect(after.archetypes).toHaveLength(library.archetypes.length);
  });
});

describe("blank designs", () => {
  it("make a character melee can use straight away", () => {
    for (const kind of ["class", "enemy"] as const) {
      const archetype = blankArchetype("t", kind);
      const library = {
        ...emptyLibrary(),
        archetypes: [archetype],
        characters: [blankCharacter("c", archetype)],
      };
      expect(parseLibrary(JSON.stringify(library))).toEqual(library);
      const roster = compileRoster(library);
      expect(roster.party).toHaveLength(kind === "class" ? 1 : 0);
      expect(roster.monsters).toHaveLength(kind === "enemy" ? 1 : 0);
    }
  });
});

describe("parseLibrary", () => {
  const starter = starterLibrary();
  const broken = (
    change: (lib: ReturnType<typeof starterLibrary>) => unknown,
  ) => JSON.stringify(change(starterLibrary()));

  it("reads back an exported library", () => {
    expect(parseLibrary(JSON.stringify(starter))).toEqual(starter);
  });

  it("brings levels back into range", () => {
    const text = broken((lib) => {
      lib.characters[0]!.level = 999;
      return lib;
    });
    expect(parseLibrary(text)?.characters[0]?.level).toBe(MAX_LEVEL);
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
      "a character with no level",
      broken((lib) => ({
        ...lib,
        characters: [{ ...lib.characters[0], level: "3" }],
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
  ])("gives null for %s", (_, text) => {
    expect(parseLibrary(text)).toBeNull();
  });
});
