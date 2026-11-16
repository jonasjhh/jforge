import { describe, expect, it } from "vitest";
import { content, createBattle, isCombatantDef } from "@jforge/melee/shared";
import { toCombatantDef } from "../compile";
import { canUse } from "../gear";
import { blankCharacter, emptyLibrary, parseLibrary } from "../library";
import {
  BASIC_ARMOR,
  MELEE_CLASS_LEVEL,
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
} from "../melee";
import { statsAtLevel } from "../progression";
import { starterLibrary } from "../starter";
import { DESIGNED_CLASSES, designedLibrary } from "./designed";

const { fighter, healer, mage, playerTypes } = content;

describe("classFromMelee", () => {
  it("has melee's stats at the reference level, give or take rounding", () => {
    for (const def of playerTypes) {
      const type = classFromMelee(def);
      const stats = statsAtLevel(
        type.baseStats,
        type.growth,
        MELEE_CLASS_LEVEL,
      );
      for (const [stat, value] of Object.entries(def.stats)) {
        expect(
          Math.abs(stats[stat as keyof typeof stats] - value),
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("grows with level and is weaker below the reference level", () => {
    const type = classFromMelee(fighter);
    const at = (level: number) =>
      statsAtLevel(type.baseStats, type.growth, level);
    expect(at(1).maxHp).toBeLessThan(fighter.stats.maxHp);
    expect(at(10).attack).toBeGreaterThan(fighter.stats.attack);
  });

  it("keeps the weapon, row, icon and skills, learned one after another", () => {
    const type = classFromMelee(healer);
    expect(type).toMatchObject({
      id: "melee-healer",
      name: "Healer",
      kind: "class",
      portrait: "healer",
      preferredRow: healer.preferredRow,
      weapon: healer.weapon,
    });
    expect(type.skills.map((u) => u.skillId)).toEqual(
      healer.skills!.map((s) => s.id),
    );
    const levels = type.skills.map((u) => u.level);
    expect(levels[0]).toBe(1);
    expect(levels).toEqual([...new Set(levels)].sort((a, b) => a - b));
  });
});

describe("withMeleeClasses", () => {
  it("adds every melee class and the skills they learn", () => {
    const library = withMeleeClasses(emptyLibrary());
    expect(library.archetypes.map((a) => a.id)).toEqual(
      playerTypes.map((def) => meleeClassId(def.id)),
    );
    const skills = new Set(library.skills.map((s) => s.id));
    expect(skills.size).toBe(library.skills.length);
    for (const type of meleeClasses()) {
      expect(type.skills.every((u) => skills.has(u.skillId))).toBe(true);
    }
  });

  it("keeps what the library already has, edited or not", () => {
    const renamed = { ...classFromMelee(fighter), name: "Sellsword" };
    const library = withMeleeClasses({
      ...emptyLibrary(),
      archetypes: [renamed],
    });
    expect(library.archetypes[0]).toBe(renamed);
    expect(library.archetypes).toHaveLength(playerTypes.length);
    expect(withMeleeClasses(library)).toBe(library);
  });

  it("gives a saved melee class the skills melee has added since", () => {
    const current = classFromMelee(fighter);
    const [first, ...added] = current.skills;
    const saved = {
      ...current,
      name: "Sellsword",
      skills: [{ ...first!, level: 5 }],
    };
    const library = withMeleeClasses({
      ...emptyLibrary(),
      archetypes: [saved],
    });
    const updated = library.archetypes.find((a) => a.id === current.id)!;
    expect(updated.name).toBe("Sellsword");
    expect(updated.skills).toEqual([{ ...first!, level: 5 }, ...added]);
    expect(added.length).toBeGreaterThan(0);
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

  it("turns the starter's former Knight and Sage into melee's", () => {
    const former = (id: string, name: string) => ({
      ...DESIGNED_CLASSES[0]!,
      id,
      name,
    });
    const person = (id: string, name: string, archetypeId: string) => ({
      id,
      name,
      archetypeId,
      level: 4,
      xp: 20,
      gear: { weapon: "gear-sword" },
    });
    const library = withMeleeClasses({
      ...emptyLibrary(),
      archetypes: [
        former("type-knight", "Knight"),
        former("type-sage", "Sage"),
      ],
      characters: [
        person("unit-1", "Aldric", "type-knight"),
        person("unit-2", "Mira", "type-sage"),
        person("unit-7", "Gareth", "type-knight"),
      ],
    });
    expect(library.archetypes.map((a) => a.id)).not.toContain("type-knight");
    expect(library.archetypes.map((a) => a.id)).not.toContain("type-sage");
    const of = (name: string) =>
      library.characters.filter((c) => c.name === name);
    expect(of("Aldric")).toEqual([
      { ...person(meleeHeroId("knight"), "Aldric", meleeClassId("knight")) },
    ]);
    expect(of("Mira")).toHaveLength(1);
    expect(of("Mira")[0]).toMatchObject({
      id: meleeHeroId("sage"),
      archetypeId: meleeClassId("sage"),
      level: 4,
    });
    expect(of("Gareth")[0]).toMatchObject({
      id: "unit-7",
      archetypeId: meleeClassId("knight"),
    });
    expect(withMeleeClasses(library)).toBe(library);
  });

  it("is part of the starter library, which still saves and loads", () => {
    const starter = starterLibrary();
    expect(withMeleeClasses(starter)).toBe(starter);
    expect(parseLibrary(JSON.stringify(starter))).toEqual(starter);
  });

  it("makes characters of every class that melee can field", () => {
    const library = starterLibrary();
    for (const type of meleeClasses()) {
      const def = toCombatantDef(library, {
        ...blankCharacter("x", type),
        level: 12,
      })!;
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

  it("fills in what a library saved before categories lacks", () => {
    const current = withMeleeClasses(emptyLibrary());
    const old = {
      ...current,
      archetypes: current.archetypes.map((a) => {
        const was = { ...a };
        delete was.proficiencies;
        return was;
      }),
      gear: current.gear.map((g) => {
        const was = { ...g };
        delete was.category;
        return was;
      }),
    };
    expect(withMeleeClasses(old)).toEqual(current);
  });
});
