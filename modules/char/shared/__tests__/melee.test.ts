import { describe, expect, it } from "vitest";
import { content, createBattle, isCombatantDef } from "@jforge/melee/shared";
import { toCombatantDef } from "../compile";
import { canUse } from "../gear";
import { blankCharacter, emptyLibrary, parseLibrary } from "../library";
import {
  BASIC_ARMOR,
  MELEE_CREATURES,
  MELEE_HEROES,
  MELEE_PROFICIENCIES,
  basicGear,
  basicWeapon,
  classFromMelee,
  meleeClassId,
  meleeClasses,
  meleeHeroId,
  meleeWeaponId,
  starterKit,
  withMeleeClasses,
  meleeCreatureId,
} from "../melee";
import { starterLibrary } from "../starter";
import { designedLibrary } from "./designed";

const { fighter, healer, mage, playerTypes } = content;

describe("classFromMelee", () => {
  it("has melee's stats", () => {
    for (const def of playerTypes) {
      expect(classFromMelee(def).baseStats).toEqual(def.stats);
    }
  });

  it("keeps the weapon, row, icon and skills", () => {
    const type = classFromMelee(healer);
    expect(type).toMatchObject({
      id: "melee-healer",
      name: "Healer",
      kind: "class",
      portrait: "healer",
      preferredRow: healer.preferredRow,
      weapon: healer.weapon,
    });
    expect(type.skills).toEqual(healer.skills!.map((s) => s.id));
  });
});

describe("withMeleeClasses", () => {
  it("adds every melee class and the skills they learn", () => {
    const library = withMeleeClasses(emptyLibrary());
    expect(library.archetypes.map((a) => a.id)).toEqual([
      ...playerTypes.map((def) => meleeClassId(def.id)),
      ...MELEE_CREATURES.map((def) => meleeCreatureId(def.id)),
    ]);
    const skills = new Set(library.skills.map((s) => s.id));
    expect(skills.size).toBe(library.skills.length);
    for (const type of meleeClasses()) {
      expect(type.skills.every((id) => skills.has(id))).toBe(true);
    }
  });

  it("keeps what the library already has, edited or not", () => {
    const renamed = { ...classFromMelee(fighter), name: "Sellsword" };
    const library = withMeleeClasses({
      ...emptyLibrary(),
      archetypes: [renamed],
    });
    expect(library.archetypes[0]).toBe(renamed);
    expect(library.archetypes).toHaveLength(
      playerTypes.length + MELEE_CREATURES.length,
    );
    expect(withMeleeClasses(library)).toBe(library);
  });

  it("leaves a designed class's skills alone", () => {
    const designed = {
      ...classFromMelee(fighter),
      id: "sellsword",
      skills: [],
    };
    const library = withMeleeClasses({
      ...emptyLibrary(),
      archetypes: [designed],
    });
    expect(library.archetypes.find((a) => a.id === "sellsword")).toBe(designed);
  });

  it("is part of the starter library, which still saves and loads", () => {
    const starter = starterLibrary();
    expect(withMeleeClasses(starter)).toBe(starter);
    expect(parseLibrary(JSON.stringify(starter))).toEqual(starter);
  });

  it("makes characters of every class that melee can field", () => {
    const library = starterLibrary();
    for (const type of meleeClasses()) {
      const def = toCombatantDef(library, blankCharacter("x", type))!;
      expect(isCombatantDef(def)).toBe(true);
      expect(def.skills).toHaveLength(type.skills.length);
      expect(() =>
        createBattle(
          {
            placements: [
              { def, side: "player", position: { col: 0, row: 0 } },
              { def, side: "enemy", position: { col: 0, row: 0 } },
            ],
          },
          1,
        ),
      ).not.toThrow();
    }
  });
});

describe("basic gear", () => {
  it("is each class's own weapon, adding a little to its best stat", () => {
    const sword = basicWeapon(fighter);
    expect(sword).toMatchObject({
      id: meleeWeaponId("fighter"),
      name: `Fighter's ${fighter.weapon.name}`,
      slot: "weapon",
      bonuses: [{ stat: "attack", op: "add" }],
    });
    expect(sword.weapon).toMatchObject({
      kind: fighter.weapon.kind,
      columns: fighter.weapon.columns,
      depth: fighter.weapon.depth,
      damageType: fighter.weapon.damageType,
    });
    expect(basicWeapon(mage).bonuses[0]!.stat).toBe("magic");
  });

  it("has nothing that makes a stat worse", () => {
    for (const gear of basicGear()) {
      expect(gear.bonuses.every((b) => b.op === "add" && b.value > 0)).toBe(
        true,
      );
    }
  });
});

describe("starterKit", () => {
  const library = withMeleeClasses(emptyLibrary());
  const type = (id: string) =>
    library.archetypes.find((a) => a.id === meleeClassId(id))!;

  it("gives a melee class its weapon and armor for its role", () => {
    const fighterKit = starterKit(
      library,
      blankCharacter("a", type("fighter")),
    );
    expect(fighterKit.gear).toEqual({
      weapon: meleeWeaponId("fighter"),
      armor: "melee-gear-jerkin",
    });
    expect(
      starterKit(library, blankCharacter("b", type("mage"))).gear.armor,
    ).toBe("melee-gear-robe");
  });

  it("keeps what is worn and gives only gear the library has", () => {
    const worn = {
      ...blankCharacter("a", type("fighter")),
      gear: { armor: "x" },
    };
    expect(starterKit(library, worn).gear.armor).toBe("x");
    const bare = { ...library, gear: [] };
    expect(starterKit(bare, blankCharacter("b", type("fighter"))).gear).toEqual(
      {},
    );
  });

  it("gives a designed class armor only", () => {
    const starter = designedLibrary();
    const sage = starter.archetypes.find((a) => a.id === "type-scholar")!;
    expect(starterKit(starter, blankCharacter("c", sage)).gear).toEqual({
      armor: "melee-gear-robe",
    });
  });
});

describe("melee heroes", () => {
  it("are one per class, in basic gear, and come back if missing", () => {
    const library = withMeleeClasses(emptyLibrary());
    expect(library.characters.map((c) => c.name)).toEqual(
      playerTypes.flatMap((def) => MELEE_HEROES[def.id] ?? []),
    );
    for (const hero of library.characters) {
      expect(hero.gear.weapon).toBeDefined();
      expect(hero.gear.armor).toBeDefined();
    }
    expect(library.gear.slice(-BASIC_ARMOR.length)).toEqual(BASIC_ARMOR);
    const edited = {
      ...library,
      characters: library.characters.map((c) =>
        c.id === meleeHeroId("fighter") ? { ...c, gear: {} } : c,
      ),
    };
    expect(withMeleeClasses(edited)).toBe(edited);
  });
});

describe("melee proficiencies", () => {
  it("cover every class, its own weapon and an armor its kit can give", () => {
    const library = withMeleeClasses(emptyLibrary());
    for (const def of playerTypes) {
      const type = library.archetypes.find(
        (a) => a.id === meleeClassId(def.id),
      )!;
      expect(type.proficiencies).toEqual(MELEE_PROFICIENCIES[def.id]);
      expect(canUse(type, basicWeapon(def))).toBe(true);
      const hero = library.characters.find(
        (c) => c.id === meleeHeroId(def.id),
      )!;
      expect(hero.gear.weapon).toBe(meleeWeaponId(def.id));
      expect(hero.gear.armor).toBeDefined();
    }
  });

  it("gives an archer, who can't wear robes, the jerkin", () => {
    const library = withMeleeClasses(emptyLibrary());
    const archer = library.characters.find(
      (c) => c.id === meleeHeroId("archer"),
    )!;
    expect(archer.gear.armor).toBe("melee-gear-jerkin");
  });
});
