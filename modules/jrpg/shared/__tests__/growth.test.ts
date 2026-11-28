import { describe, expect, it } from "vitest";
import { type Character } from "@jforge/rules/core";
import {
  MELEE_CREATURES,
  WORLD_ENEMY_IDS,
  meleeClassId,
  meleeCreatureId,
  meleeHeroId,
} from "@jforge/content/catalogue";
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
import { jrpgLibrary } from "@jforge/content/jrpg";
import { statsAtLevel } from "../progression";
import { memberDef } from "../run";

const world = jrpgLibrary();
const character = (archetypeId: string): Character =>
  world.characters.find((c) => c.archetypeId === archetypeId)!;
const summonOf = (skill: Skill) => {
  if (skill.effect.type !== "summon") throw new Error("not a summon");
  return skill.effect;
};

describe("STAT_GROWTH", () => {
  it("given melee's classes and creatures and the world's enemies, when their growth rows are looked up, then each has one", () => {
    const ids = [
      ...content.playerTypes.map((d) => meleeClassId(d.id)),
      ...MELEE_CREATURES.map((d) => meleeCreatureId(d.id)),
      ...WORLD_ENEMY_IDS,
    ];

    const missing = ids.filter((id) => STAT_GROWTH[id] === undefined);

    expect(missing).toEqual([]);
  });

  it("given the growth table, when its types are looked up in the world, then each is there", () => {
    const types = new Set(world.archetypes.map((a) => a.id));

    const unknown = Object.keys(STAT_GROWTH).filter((id) => !types.has(id));

    expect(unknown).toEqual([]);
  });
});

describe("statGrowth", () => {
  it("given a type with a growth row, when its growth is found, then it is that row", () => {
    const id = meleeClassId(content.fighter.id);

    const growth = statGrowth(id, content.fighter.stats);

    expect(growth).toBe(STAT_GROWTH[id]);
  });

  it("given a type with no growth row, when its growth is found, then it is a share of its level-1 stats", () => {
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
  const skills = new Set(world.skills.map((s) => s.id));

  it("given the world's skills, when their growth rows are looked up, then each has one", () => {
    const missing = [...skills].filter((id) => SKILL_GROWTH[id] === undefined);

    expect(missing).toEqual([]);
  });

  it("given the skill growth table, when its skills are looked up in the world, then each is there", () => {
    const unknown = Object.keys(SKILL_GROWTH).filter((id) => !skills.has(id));

    expect(unknown).toEqual([]);
  });

  it("given the skill growth table, when each grown number is read from its skill, then the skill has it", () => {
    const paths = Object.entries(SKILL_GROWTH).flatMap(([id, row]) =>
      Object.keys(row).map((path) => [id, path] as const),
    );

    const missing = paths.filter(
      ([id, path]) =>
        typeof numberAt(
          world.skills.find((s) => s.id === id)!,
          path,
        ) !== "number",
    );

    expect(missing).toEqual([]);
  });
});

describe("skillAtLevel", () => {
  const bolt: Skill = { ...content.firebolt, id: "bolt" };
  const growth = {
    bolt: { "effect.power": 0.1, mpCost: 0.6, "effect.missing": 5 },
  };
  const power = (s: Skill) => numberAt(s, "effect.power")!;

  it("given a skill with a growth row, when it is taken at level 1, then it is as designed", () => {
    const grown = skillAtLevel(bolt, 1, growth);

    expect(grown).toEqual(bolt);
  });

  it("given a skill with a growth row, when it is taken at level 4, then its row is added three times, whole numbers staying whole", () => {
    const grown = skillAtLevel(bolt, 4, growth);

    expect(power(grown)).toBeCloseTo(power(bolt) + 0.3);
    expect(grown.mpCost).toBe(Math.round(bolt.mpCost + 1.8));
  });

  it("given a growth row naming a number the skill lacks, when it is grown, then that number isn't added", () => {
    const grown = skillAtLevel(bolt, 4, growth);

    expect(numberAt(grown, "effect.missing")).toBeUndefined();
  });

  it("given a skill, when it is grown, then the skill given is unchanged", () => {
    skillAtLevel(bolt, 4, growth);

    expect(bolt.mpCost).toBe(content.firebolt.mpCost);
  });

  it("given a skill with no growth row, when it is taken at level 9, then it is as designed", () => {
    const grown = skillAtLevel(content.firebolt, 9);

    expect(grown).toEqual(content.firebolt);
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
  const impOf = () =>
    summonOf(
      levelledDef(world, character(warlock.id), 1)!.skills!.find(
        (s) => s.effect.type === "summon",
      )!,
    ).creature;

  it("given a level-1 warlock, when its imp is summoned, then the imp has its type's level-1 stats", () => {
    const creature = impOf();

    expect(creature.stats).toEqual(imp.baseStats);
  });

  it("given an imp, when it is taken to level 6, then it grows by the imp's row", () => {
    const creature = impOf();

    const grown = creatureAtLevel(creature, 6);

    expect(grown.stats).toEqual(impAt(6));
  });

  it("given a level-5 warlock in the party, when its skills are compiled, then its imp is level 5 too", () => {
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

  it("given a witch, when it is taken at level 1, then it has its type's own stats", () => {
    const type = world.archetypes.find((a) => a.id === "world-witch")!;

    const def = levelledDef(world, witch, 1)!;

    expect(def.stats).toEqual(type.baseStats);
  });

  it("given a geared knight, when it goes from level 1 to 6, then its attack grows by its row before gear goes on", () => {
    const hero = world.characters.find((c) => c.id === meleeHeroId("knight"))!;
    const row = STAT_GROWTH[meleeClassId(content.knight.id)]!;
    const low = levelledDef(world, hero, 1)!;

    const high = levelledDef(world, hero, 6)!;

    expect(high.stats.attack - low.stats.attack).toBe(
      Math.round(content.knight.stats.attack + row.attack * 5) -
        content.knight.stats.attack,
    );
  });

  it("given a witch, when it is taken at level 5, then it hits harder and is a bigger threat than at level 1", () => {
    const low = levelledDef(world, witch, 1)!;

    const high = levelledDef(world, witch, 5)!;

    expect(high.stats.magic).toBeGreaterThan(low.stats.magic);
    expect(high.threat!).toBeGreaterThan(low.threat!);
  });

  it("given a character whose type is gone, when it is levelled, then there is no def", () => {
    const lost = { ...witch, archetypeId: "gone" };

    const def = levelledDef(world, lost, 3);

    expect(def).toBeNull();
  });
});
