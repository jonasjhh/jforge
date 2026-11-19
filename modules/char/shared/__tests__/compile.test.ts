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
} from "../compile";
import { designedLibrary } from "./designed";
import type { Character } from "../types";

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
  it("finds a character's type, or nothing", () => {
    expect(archetypeOf(library, aldric)).toBe(knight);
    expect(archetypeOf(library, orphan)).toBeUndefined();
  });
});

describe("characterStats", () => {
  it("puts gear on top of the type's own stats", () => {
    const stats = characterStats(library, aldric)!;
    // Squire: 16 attack; Iron Sword +6.
    expect(stats.base.attack).toBe(16);
    expect(stats.total.attack).toBe(22);
    // Chain Mail: +8 defense, speed x0.9.
    expect(stats.base.defense).toBe(12);
    expect(stats.total.defense).toBe(20);
    expect(stats.total.speed).toBe(Math.round(stats.base.speed * 0.9));
  });

  it("equals the type's stats with no gear on", () => {
    const stats = characterStats(library, { ...aldric, gear: {} })!;
    expect(stats.total).toEqual(knight.baseStats);
  });

  it("puts gear on top of the stats it is given instead", () => {
    const base = { ...knight.baseStats, attack: 30 };
    const stats = characterStats(library, aldric, base)!;
    expect(stats.base).toEqual(base);
    expect(stats.total.attack).toBe(36);
  });

  it("is null when the type is gone", () => {
    expect(characterStats(library, orphan)).toBeNull();
  });
});

describe("archetypeSkills", () => {
  it("gives every skill the archetype has, as listed", () => {
    expect(archetypeSkills(library, sage).map((s) => s.name)).toEqual([
      "Firebolt",
      "Heal",
      "Fireball",
    ]);
  });

  it("skips skills that no longer exist", () => {
    const type = { ...sage, skills: ["gone"] };
    expect(archetypeSkills(library, type)).toEqual([]);
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

  it("gives enemies a threat estimated from what they fight with", () => {
    const def = toCombatantDef(library, goblin)!;
    const { threat, ...rest } = def;
    expect(threat).toBe(estimateThreat(rest));
  });

  it("makes an enemy with stronger stats a bigger threat", () => {
    const type = archetypeOf(library, goblin)!;
    const doubled = Object.fromEntries(
      Object.entries(type.baseStats).map(([stat, v]) => [stat, v * 2]),
    ) as typeof type.baseStats;
    const low = toCombatantDef(library, goblin)!;
    const high = toCombatantDef(library, goblin, doubled)!;
    expect(high.stats.attack).toBe(type.baseStats.attack * 2);
    expect(high.threat!).toBeGreaterThan(low.threat!);
  });

  it("is null when the type is gone", () => {
    expect(toCombatantDef(library, orphan)).toBeNull();
  });
});

describe("compileRoster", () => {
  it("sorts characters into the party and the monster pool", () => {
    const roster = compileRoster(library);
    expect(roster.party.map((d) => d.name)).toEqual([
      "Bram",
      "Ilse",
      ...library.characters.slice(3).map((c) => c.name),
    ]);
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
            ...party.slice(0, MAX_PARTY_SIZE).map((def, col) => ({
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
