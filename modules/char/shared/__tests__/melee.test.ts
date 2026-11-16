import { describe, expect, it } from "vitest";
import { content, createBattle, isCombatantDef } from "@jforge/melee/shared";
import { toCombatantDef } from "../compile";
import { blankCharacter, emptyLibrary, parseLibrary } from "../library";
import {
  MELEE_CLASS_LEVEL,
  classFromMelee,
  meleeClassId,
  meleeClasses,
  withMeleeClasses,
} from "../melee";
import { statsAtLevel } from "../progression";
import { starterLibrary } from "../starter";

const { fighter, healer, playerTypes } = content;

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
