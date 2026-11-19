import { describe, expect, it } from "vitest";
import {
  MELEE_CREATURES,
  emptyLibrary,
  meleeClassId,
  meleeCreatureId,
  meleeHeroId,
  type Character,
} from "@jforge/char/shared";
import { content, type Skill, type Stats } from "@jforge/melee/shared";
import {
  DEFAULT_GROWTH,
  DEFAULT_SPEED_GROWTH,
  SKILL_GROWTH,
  STAT_GROWTH,
  creatureAtLevel,
  levelledDef,
  numberAt,
  skillAtLevel,
  statGrowth,
} from "../growth";
import { statsAtLevel } from "../progression";
import { memberDef } from "../run";
import { withWorld } from "../world";

const world = withWorld(emptyLibrary());
const character = (archetypeId: string): Character =>
  world.characters.find((c) => c.archetypeId === archetypeId)!;
const summonOf = (skill: Skill) => {
  if (skill.effect.type !== "summon") throw new Error("not a summon");
  return skill.effect;
};

describe("STAT_GROWTH", () => {
  it("has a row for every melee class, melee creature and world enemy", () => {
    const ids = [
      ...content.playerTypes.map((d) => meleeClassId(d.id)),
      ...MELEE_CREATURES.map((d) => meleeCreatureId(d.id)),
      ...world.archetypes.filter((a) => a.kind === "enemy").map((a) => a.id),
    ];
    for (const id of ids) expect(STAT_GROWTH[id], id).toBeDefined();
  });

  it("names only types the world has", () => {
    const types = new Set(world.archetypes.map((a) => a.id));
    for (const id of Object.keys(STAT_GROWTH))
      expect(types.has(id), id).toBe(true);
  });
});

describe("statGrowth", () => {
  it("is the type's row when it has one", () => {
    const id = meleeClassId(content.fighter.id);
    expect(statGrowth(id, content.fighter.stats)).toBe(STAT_GROWTH[id]);
  });

  it("is a share of the level-1 stats for a type with no row", () => {
    const base: Stats = {
      maxHp: 100,
      maxMp: 50,
      attack: 20,
      magic: 10,
      defense: 10,
      spirit: 10,
      speed: 10,
    };
    const growth = statGrowth("type-designed", base);
    expect(growth.maxHp).toBeCloseTo(100 * DEFAULT_GROWTH);
    expect(growth.attack).toBeCloseTo(20 * DEFAULT_GROWTH);
    expect(growth.speed).toBeCloseTo(10 * DEFAULT_SPEED_GROWTH);
  });
});

describe("SKILL_GROWTH", () => {
  it("has a row for every skill of the world, and only those", () => {
    const skills = new Set(world.skills.map((s) => s.id));
    for (const id of skills) expect(SKILL_GROWTH[id], id).toBeDefined();
    for (const id of Object.keys(SKILL_GROWTH)) {
      expect(skills.has(id), id).toBe(true);
    }
  });

  it("grows only numbers the skill has", () => {
    for (const [id, row] of Object.entries(SKILL_GROWTH)) {
      const skill = world.skills.find((s) => s.id === id)!;
      for (const path of Object.keys(row)) {
        expect(numberAt(skill, path), `${id} ${path}`).toBeTypeOf("number");
      }
    }
  });
});

describe("skillAtLevel", () => {
  const bolt: Skill = { ...content.firebolt, id: "bolt" };
  const growth = {
    bolt: { "effect.power": 0.1, mpCost: 0.6, "effect.missing": 5 },
  };

  it("is the skill as designed at level 1", () => {
    expect(skillAtLevel(bolt, 1, growth)).toEqual(bolt);
  });

  it("adds its row once per level above 1, whole numbers staying whole", () => {
    const grown = skillAtLevel(bolt, 4, growth);
    const power = (s: Skill) => numberAt(s, "effect.power")!;
    expect(power(grown)).toBeCloseTo(power(bolt) + 0.3);
    expect(grown.mpCost).toBe(Math.round(bolt.mpCost + 1.8));
    expect(numberAt(grown, "effect.missing")).toBeUndefined();
    expect(bolt.mpCost).toBe(content.firebolt.mpCost);
  });

  it("leaves a skill with an empty row as it is", () => {
    expect(skillAtLevel(content.firebolt, 9)).toEqual(content.firebolt);
  });
});

describe("summons", () => {
  const warlock = world.archetypes.find(
    (a) => a.id === meleeClassId(content.warlock.id),
  )!;
  const imp = world.archetypes.find(
    (a) => a.id === meleeCreatureId(content.imp.id),
  )!;
  const impAt = (level: number) =>
    statsAtLevel(imp.baseStats, STAT_GROWTH[imp.id]!, level);

  it("grow a creature by its type's row", () => {
    const creature = summonOf(
      levelledDef(world, character(warlock.id), 1)!.skills!.find(
        (s) => s.effect.type === "summon",
      )!,
    ).creature;
    expect(creature.stats).toEqual(imp.baseStats);
    expect(creatureAtLevel(creature, 6).stats).toEqual(impAt(6));
  });

  it("match the summoner's level", () => {
    const member = {
      ...world.characters.find((c) => c.id === meleeHeroId("warlock"))!,
      level: 5,
      xp: 0,
    };
    const summon = memberDef(world, member)!.skills!.find(
      (s) => s.effect.type === "summon",
    );
    expect(summon).toBeDefined();
    expect(summonOf(summon!).creature.stats).toEqual(impAt(5));
  });
});

describe("levelledDef", () => {
  const witch = character("world-witch");

  it("is the type's own stats at level 1", () => {
    const type = world.archetypes.find((a) => a.id === "world-witch")!;
    expect(levelledDef(world, witch, 1)!.stats).toEqual(type.baseStats);
  });

  it("grows stats before gear goes on", () => {
    const hero = world.characters.find((c) => c.id === meleeHeroId("knight"))!;
    const low = levelledDef(world, hero, 1)!;
    const high = levelledDef(world, hero, 6)!;
    const row = STAT_GROWTH[meleeClassId(content.knight.id)]!;
    expect(high.stats.attack - low.stats.attack).toBe(
      Math.round(content.knight.stats.attack + row.attack * 5) -
        content.knight.stats.attack,
    );
  });

  it("makes a higher-level enemy hit harder and count for more", () => {
    const low = levelledDef(world, witch, 1)!;
    const high = levelledDef(world, witch, 5)!;
    expect(high.stats.magic).toBeGreaterThan(low.stats.magic);
    expect(high.threat!).toBeGreaterThan(low.threat!);
  });

  it("is null when the type is gone", () => {
    expect(levelledDef(world, { ...witch, archetypeId: "gone" }, 3)).toBeNull();
  });
});
