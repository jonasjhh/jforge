import { describe, expect, it } from "vitest";
import {
  MAX_PARTY_SIZE,
  createBattle,
  estimateThreat,
  isCombatantDef,
} from "@jforge/melee/shared";
import {
  archetypeOf,
  characterStats,
  characterWeapon,
  compileRoster,
  toCombatantDef,
  archetypeSkills,
} from "@jforge/rules/core";
import { designedLibrary } from "./designed";
import type { Character } from "@jforge/rules/core";

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

describe("toCombatantDef", () => {
  it("given a party character, when it is compiled, then it is a combatant melee accepts, with no threat", () => {
    const def = toCombatantDef(library, mira)!;

    expect(isCombatantDef(def)).toBe(true);
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
    expect(def.threat).toBeUndefined();
  });

  it("given an enemy character, when it is compiled, then its threat is estimated from what it fights with", () => {
    const def = toCombatantDef(library, goblin)!;

    const { threat, ...rest } = def;
    expect(threat).toBe(estimateThreat(rest));
  });

  it("given an enemy with doubled stats, when it is compiled, then it is a bigger threat than the plain one", () => {
    const type = archetypeOf(library, goblin)!;
    const doubled = Object.fromEntries(
      Object.entries(type.baseStats).map(([stat, v]) => [stat, v * 2]),
    ) as typeof type.baseStats;
    const low = toCombatantDef(library, goblin)!;

    const high = toCombatantDef(library, goblin, doubled)!;

    expect(high.stats.attack).toBe(type.baseStats.attack * 2);
    expect(high.threat!).toBeGreaterThan(low.threat!);
  });

  it("given a character whose type is gone, when it is compiled, then there is no combatant", () => {
    const def = toCombatantDef(library, orphan);

    expect(def).toBeNull();
  });
});

describe("compileRoster", () => {
  it("given heroes and monsters, when the roster is compiled, then they are sorted into the party and the monster pool", () => {
    const roster = compileRoster(library);

    expect(roster.party.map((d) => d.name)).toEqual([
      "Bram",
      "Ilse",
      ...library.characters.slice(3).map((c) => c.name),
    ]);
    expect(roster.monsters.map((d) => d.name)).toEqual(["Goblin"]);
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
