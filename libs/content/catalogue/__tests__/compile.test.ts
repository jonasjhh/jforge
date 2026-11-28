import { describe, expect, it } from "vitest";
import { MAX_PARTY_SIZE, createBattle } from "@jforge/melee/shared";
import {
  archetypeOf,
  archetypeSkills,
  characterStats,
  characterWeapon,
  compileRoster,
  isCreature,
  toCreature,
  type Character,
} from "@jforge/rules/core";
import { WORLD_ENEMIES } from "..";
import { designedLibrary } from "./designed";

const library = designedLibrary();
const [aldric, mira, goblin] = library.characters as [
  Character,
  Character,
  Character,
];
const knight = library.archetypes.find((a) => a.id === "type-squire")!;
const sage = library.archetypes.find((a) => a.id === "type-scholar")!;
const orphan: Character = { ...aldric, id: "lost", archetypeId: "gone" };

describe("archetypeOf", () => {
  it("given a character of a known type, when its type is looked up, then that type is found", () => {
    const found = archetypeOf(library, aldric);

    expect(found).toBe(knight);
  });

  it("given a character whose type is gone, when its type is looked up, then nothing is found", () => {
    const found = archetypeOf(library, orphan);

    expect(found).toBeUndefined();
  });
});

describe("characterStats", () => {
  it("given a squire with a sword and chain mail, when its stats are worked out, then the gear's bonuses go on top of the type's stats", () => {
    const stats = characterStats(library, aldric)!;

    // Squire: 16 attack; Iron Sword +6.
    expect(stats.base.attack).toBe(16);
    expect(stats.total.attack).toBe(22);
    // Chain Mail: +8 defense, speed x0.9.
    expect(stats.base.defense).toBe(12);
    expect(stats.total.defense).toBe(20);
    expect(stats.total.speed).toBe(Math.round(stats.base.speed * 0.9));
  });

  it("given a character with no gear on, when its stats are worked out, then they equal the type's stats", () => {
    const unarmed = { ...aldric, gear: {} };

    const stats = characterStats(library, unarmed)!;

    expect(stats.total).toEqual(knight.baseStats);
  });

  it("given stats to start from, when a character's stats are worked out, then the gear goes on top of those instead", () => {
    const base = { ...knight.baseStats, attack: 30 };

    const stats = characterStats(library, aldric, base)!;

    expect(stats.base).toEqual(base);
    expect(stats.total.attack).toBe(36);
  });

  it("given a character whose type is gone, when its stats are worked out, then there are none", () => {
    const stats = characterStats(library, orphan);

    expect(stats).toBeNull();
  });
});

describe("archetypeSkills", () => {
  it("given an archetype with skills, when its skills are listed, then each one comes in the order listed", () => {
    const skills = archetypeSkills(library, sage);

    expect(skills.map((s) => s.name)).toEqual(["Firebolt", "Heal", "Fireball"]);
  });

  it("given an archetype listing a skill that no longer exists, when its skills are listed, then that skill is skipped", () => {
    const type = { ...sage, skills: ["gone"] };

    const skills = archetypeSkills(library, type);

    expect(skills).toEqual([]);
  });
});

describe("characterWeapon", () => {
  it("given a character with a weapon equipped, when its weapon is found, then it is that weapon", () => {
    const weapon = characterWeapon(library, knight, aldric);

    expect(weapon.name).toBe("Iron Sword");
  });

  it("given a character with no weapon, when its weapon is found, then it is the type's own attack", () => {
    const unarmed = { ...aldric, gear: {} };

    const weapon = characterWeapon(library, knight, unarmed);

    expect(weapon).toBe(knight.weapon);
  });
});

describe("toCreature", () => {
  it("given a party character, when it is compiled, then it is a creature a battle accepts", () => {
    const def = toCreature(library, mira)!;

    expect(isCreature(def)).toBe(true);
    expect(def).toMatchObject({
      id: "char-unit-2",
      name: "Ilse",
      portrait: "mage",
      preferredRow: 2,
      stats: characterStats(library, mira)!.total,
    });
    expect(def.skills?.map((s) => s.name)).toEqual([
      "Firebolt",
      "Heal",
      "Fireball",
    ]);
  });

  it("given an enemy character, when it is compiled, then it carries no threat, which each game estimates", () => {
    const def = toCreature(library, goblin)!;

    expect(def).not.toHaveProperty("threat");
    expect(def).not.toHaveProperty("targeting");
  });

  it("given an enemy with doubled stats, when it is compiled, then it fights with the doubled stats", () => {
    const type = archetypeOf(library, goblin)!;
    const doubled = Object.fromEntries(
      Object.entries(type.baseStats).map(([stat, v]) => [stat, v * 2]),
    ) as typeof type.baseStats;

    const high = toCreature(library, goblin, doubled)!;

    expect(high.stats).toEqual(characterStats(library, goblin, doubled)!.total);
    expect(high.stats.attack).toBeGreaterThan(type.baseStats.attack);
  });

  it("given a character whose type is gone, when it is compiled, then there is no creature", () => {
    const def = toCreature(library, orphan);

    expect(def).toBeNull();
  });
});

describe("compileRoster", () => {
  it("given heroes and monsters, when the roster is compiled, then they are sorted into the party and the monster pool", () => {
    const roster = compileRoster(library);

    expect(roster.party.map((d) => d.name)).toEqual([
      "Bram",
      "Ilse",
      ...library.characters.slice(3, -WORLD_ENEMIES.length).map((c) => c.name),
    ]);
    expect(roster.monsters.map((d) => d.name)).toEqual([
      "Goblin",
      ...WORLD_ENEMIES.map((a) => a.name),
    ]);
  });

  it("given a character whose type is gone, when the roster is compiled, then it is left out", () => {
    const roster = compileRoster({ ...library, characters: [orphan] });

    expect(roster).toEqual({ party: [], monsters: [] });
  });

  it("given the compiled roster, when a battle is started from it, then it starts", () => {
    const { party, monsters } = compileRoster(library);

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
