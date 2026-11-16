import { describe, expect, it } from "vitest";
import { createBattle, isCombatantDef } from "@jforge/melee/shared";
import {
  archetypeOf,
  characterStats,
  characterWeapon,
  compileRoster,
  toCombatantDef,
  unlockedSkills,
} from "../compile";
import { starterLibrary } from "../starter";
import type { Character } from "../types";

const library = starterLibrary();
const [aldric, mira, goblin] = library.characters as [
  Character,
  Character,
  Character,
];
const knight = library.archetypes.find((a) => a.id === "type-knight")!;
const sage = library.archetypes.find((a) => a.id === "type-sage")!;
const orphan: Character = { ...aldric, id: "lost", archetypeId: "gone" };

describe("archetypeOf", () => {
  it("finds a character's type, or nothing", () => {
    expect(archetypeOf(library, aldric)).toBe(knight);
    expect(archetypeOf(library, orphan)).toBeUndefined();
  });
});

describe("characterStats", () => {
  it("levels first, then puts gear on top", () => {
    const stats = characterStats(library, aldric)!;
    // Knight level 3: 16 + 2 x 2 attack; Iron Sword +6.
    expect(stats.leveled.attack).toBe(20);
    expect(stats.total.attack).toBe(26);
    // Chain Mail: +8 defense, speed x0.9.
    expect(stats.leveled.defense).toBe(15);
    expect(stats.total.defense).toBe(23);
    expect(stats.total.speed).toBe(Math.round(stats.leveled.speed * 0.9));
  });

  it("equals the levelled stats with no gear on", () => {
    const stats = characterStats(library, { ...aldric, gear: {} })!;
    expect(stats.total).toEqual(stats.leveled);
  });

  it("grows with level", () => {
    const low = characterStats(library, { ...aldric, level: 1 })!;
    const high = characterStats(library, { ...aldric, level: 10 })!;
    expect(high.total.maxHp).toBeGreaterThan(low.total.maxHp);
  });

  it("is null when the type is gone", () => {
    expect(characterStats(library, orphan)).toBeNull();
  });
});

describe("unlockedSkills", () => {
  const names = (level: number) =>
    unlockedSkills(library, sage, level).map((s) => s.name);

  it("gives the skills learned up to that level, earliest first", () => {
    expect(names(1)).toEqual(["Firebolt"]);
    expect(names(3)).toEqual(["Firebolt", "Heal"]);
    expect(names(4)).toEqual(["Firebolt", "Heal", "Fireball"]);
  });

  it("skips skills that no longer exist", () => {
    const type = { ...sage, skills: [{ skillId: "gone", level: 1 }] };
    expect(unlockedSkills(library, type, 5)).toEqual([]);
  });
});

describe("characterWeapon", () => {
  it("is the equipped weapon", () => {
    expect(characterWeapon(library, knight, aldric).name).toBe("Iron Sword");
  });

  it("falls back to the type's own attack", () => {
    const unarmed = { ...aldric, gear: {} };
    expect(characterWeapon(library, knight, unarmed)).toBe(knight.weapon);
  });
});

describe("toCombatantDef", () => {
  it("builds a combatant melee accepts", () => {
    const def = toCombatantDef(library, mira)!;
    expect(isCombatantDef(def)).toBe(true);
    expect(def).toMatchObject({
      id: "char-unit-2",
      name: "Mira",
      portrait: "mage",
      preferredRow: 2,
      stats: characterStats(library, mira)!.total,
    });
    expect(def.skills?.map((s) => s.name)).toEqual(["Firebolt", "Heal"]);
    expect(def.threat).toBeUndefined();
  });

  it("gives enemies their threat", () => {
    expect(toCombatantDef(library, goblin)?.threat).toBe(2);
  });

  it("is null when the type is gone", () => {
    expect(toCombatantDef(library, orphan)).toBeNull();
  });
});

describe("compileRoster", () => {
  it("sorts characters into the party and the monster pool", () => {
    const roster = compileRoster(library);
    expect(roster.party.map((d) => d.name)).toEqual(["Aldric", "Mira"]);
    expect(roster.monsters.map((d) => d.name)).toEqual(["Goblin"]);
  });

  it("leaves out characters whose type is gone", () => {
    const roster = compileRoster({ ...library, characters: [orphan] });
    expect(roster).toEqual({ party: [], monsters: [] });
  });

  it("produces a roster a battle can start from", () => {
    const { party, monsters } = compileRoster(library);
    expect(() =>
      createBattle(
        {
          placements: [
            ...party.map((def, col) => ({
              def,
              side: "player" as const,
              position: { col, row: 0 },
            })),
            { def: monsters[0]!, side: "enemy", position: { col: 0, row: 0 } },
          ],
        },
        1,
      ),
    ).not.toThrow();
  });
});
