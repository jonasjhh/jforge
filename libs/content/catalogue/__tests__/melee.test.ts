import { describe, expect, it } from "vitest";
import { content, createBattle, isCombatantDef } from "@jforge/melee/shared";
import { toCombatantDef } from "@jforge/rules/core";
import { canUse } from "@jforge/rules/core";
import { blankCharacter, emptyLibrary, parseLibrary } from "@jforge/rules/core";
import {
  BASIC_ARMOUR,
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
import { catalogue as starterLibrary } from "..";
import { designedLibrary } from "./designed";

const { fighter, healer, mage, playerTypes } = content;

const playerIds = playerTypes.map((def) => [def.id, def] as const);

describe("classFromMelee", () => {
  it.each(playerIds)(
    "given melee's %s, when it is made a class, then it has melee's stats",
    (_, def) => {
      const type = classFromMelee(def);

      expect(type.baseStats).toEqual(def.stats);
    },
  );

  it("given melee's healer, when it is made a class, then it keeps the weapon, row, icon and skills", () => {
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
  it("given an empty library, when melee's classes are added, then each class and creature is there", () => {
    const library = withMeleeClasses(emptyLibrary());

    expect(library.archetypes.map((a) => a.id)).toEqual([
      ...playerTypes.map((def) => meleeClassId(def.id)),
      ...MELEE_CREATURES.map((def) => meleeCreatureId(def.id)),
    ]);
  });

  it("given an empty library, when melee's classes are added, then each skill they learn is there once", () => {
    const library = withMeleeClasses(emptyLibrary());

    const skills = new Set(library.skills.map((s) => s.id));
    expect(skills.size).toBe(library.skills.length);
    for (const type of meleeClasses()) {
      expect(type.skills.every((id) => skills.has(id))).toBe(true);
    }
  });

  it("given a library with a renamed melee class, when melee's classes are added, then the renamed one is kept", () => {
    const renamed = { ...classFromMelee(fighter), name: "Sellsword" };

    const library = withMeleeClasses({
      ...emptyLibrary(),
      archetypes: [renamed],
    });

    expect(library.archetypes[0]).toBe(renamed);
    expect(library.archetypes).toHaveLength(
      playerTypes.length + MELEE_CREATURES.length,
    );
  });

  it("given a library that has melee's classes, when they are added again, then it is unchanged", () => {
    const library = withMeleeClasses(emptyLibrary());

    const again = withMeleeClasses(library);

    expect(again).toBe(library);
  });

  it("given a designed class with no skills, when melee's classes are added, then its skills are left alone", () => {
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

  it("given the starter library, when melee's classes are added, then it already has them", () => {
    const starter = starterLibrary();

    const library = withMeleeClasses(starter);

    expect(library).toBe(starter);
  });

  it("given the starter library, when it is saved and parsed, then it reads back unchanged", () => {
    const starter = starterLibrary();

    const back = parseLibrary(JSON.stringify(starter));

    expect(back).toEqual(starter);
  });

  it.each(meleeClasses().map((type) => [type.name, type] as const))(
    "given a character of melee's %s class, when it is compiled and fielded, then melee accepts it",
    (_, type) => {
      const library = starterLibrary();

      const def = toCombatantDef(library, blankCharacter("x", type))!;
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

      expect(isCombatantDef(def)).toBe(true);
      expect(def.skills).toHaveLength(type.skills.length);
      expect(start).not.toThrow();
    },
  );
});

describe("basic gear", () => {
  it("given the fighter, when its basic weapon is made, then it is the fighter's own weapon adding to attack", () => {
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
  });

  it("given the mage, when its basic weapon is made, then it adds to magic, its best stat", () => {
    const staff = basicWeapon(mage);

    expect(staff.bonuses[0]!.stat).toBe("magic");
  });

  it.each(basicGear().map((gear) => [gear.name, gear] as const))(
    "given the basic %s, when its bonuses are looked at, then none makes a stat worse",
    (_, gear) => {
      const bonuses = gear.bonuses;

      expect(bonuses.every((b) => b.op === "add" && b.value > 0)).toBe(true);
    },
  );
});

describe("starterKit", () => {
  const library = withMeleeClasses(emptyLibrary());
  const type = (id: string) =>
    library.archetypes.find((a) => a.id === meleeClassId(id))!;

  it("given a bare fighter, when it gets its starter kit, then it wears its own weapon and a jerkin", () => {
    const bare = blankCharacter("a", type("fighter"));

    const kitted = starterKit(library, bare);

    expect(kitted.gear).toEqual({
      weapon: meleeWeaponId("fighter"),
      armour: "armour-travellers-jerkin",
    });
  });

  it("given a bare mage, when it gets its starter kit, then it wears a robe", () => {
    const bare = blankCharacter("b", type("mage"));

    const kitted = starterKit(library, bare);

    expect(kitted.gear.armour).toBe("armour-travellers-robe");
  });

  it("given a fighter already wearing armour, when it gets its starter kit, then the armour is kept", () => {
    const worn = {
      ...blankCharacter("a", type("fighter")),
      gear: { armour: "x" },
    };

    const kitted = starterKit(library, worn);

    expect(kitted.gear.armour).toBe("x");
  });

  it("given a library with no gear, when a fighter gets its starter kit, then it wears nothing", () => {
    const bare = { ...library, gear: [] };

    const kitted = starterKit(bare, blankCharacter("b", type("fighter")));

    expect(kitted.gear).toEqual({});
  });

  it("given a designed class, when one of its characters gets a starter kit, then it gets armour only", () => {
    const starter = designedLibrary();
    const sage = starter.archetypes.find((a) => a.id === "type-scholar")!;

    const kitted = starterKit(starter, blankCharacter("c", sage));

    expect(kitted.gear).toEqual({ armour: "armour-travellers-robe" });
  });
});

describe("melee heroes", () => {
  it("given an empty library, when melee's classes are added, then there is one hero per class", () => {
    const library = withMeleeClasses(emptyLibrary());

    expect(library.characters.map((c) => c.name)).toEqual(
      playerTypes.flatMap((def) => MELEE_HEROES[def.id] ?? []),
    );
  });

  it("given an empty library, when melee's classes are added, then each hero wears a weapon and armour, and the basic armour is added", () => {
    const library = withMeleeClasses(emptyLibrary());

    for (const hero of library.characters) {
      expect(hero.gear.weapon).toBeDefined();
      expect(hero.gear.armour).toBeDefined();
    }
    expect(library.gear.slice(-BASIC_ARMOUR.length)).toEqual(BASIC_ARMOUR);
  });

  it("given a hero whose gear was taken off, when melee's classes are added, then the edit is kept", () => {
    const library = withMeleeClasses(emptyLibrary());
    const edited = {
      ...library,
      characters: library.characters.map((c) =>
        c.id === meleeHeroId("fighter") ? { ...c, gear: {} } : c,
      ),
    };

    const again = withMeleeClasses(edited);

    expect(again).toBe(edited);
  });
});

describe("melee proficiencies", () => {
  it.each(playerIds)(
    "given melee's %s, when its class and hero are added, then it can use its own weapon and wears it with armour",
    (id, def) => {
      const library = withMeleeClasses(emptyLibrary());

      const type = library.archetypes.find((a) => a.id === meleeClassId(id))!;
      const hero = library.characters.find((c) => c.id === meleeHeroId(id))!;

      expect(type.proficiencies).toEqual(MELEE_PROFICIENCIES[id]);
      expect(canUse(type, basicWeapon(def))).toBe(true);
      expect(hero.gear.weapon).toBe(meleeWeaponId(id));
      expect(hero.gear.armour).toBeDefined();
    },
  );

  it("given an archer, who can't wear robes, when its hero is added, then it wears the jerkin", () => {
    const library = withMeleeClasses(emptyLibrary());

    const archer = library.characters.find(
      (c) => c.id === meleeHeroId("archer"),
    )!;

    expect(archer.gear.armour).toBe("armour-travellers-jerkin");
  });
});
