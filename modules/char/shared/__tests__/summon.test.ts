import { describe, expect, it } from "vitest";
import { content, type Skill, type SkillEffect } from "@jforge/melee/shared";
import { compileRoster, compileSkill, creatureOf } from "../compile";
import { blankCharacter, blankSkill } from "../library";
import { meleeCreatureId } from "../melee";
import { defaultEffect, skillProblems, withSummonSource } from "../skills";
import { starterLibrary } from "../starter";
import type { Archetype, Library } from "../types";

type Summon = Extract<SkillEffect, { type: "summon" }>;
const summonOf = (skill: Skill) => skill.effect as Summon;

describe("melee's creatures as enemy types", () => {
  const library = starterLibrary();

  it("keeps the Imp and the boulder as enemy types", () => {
    for (const id of ["imp", "boulder"]) {
      const type = library.archetypes.find((a) => a.id === meleeCreatureId(id));
      expect(type?.kind).toBe("enemy");
    }
    const boulder = library.archetypes.find(
      (a) => a.id === meleeCreatureId("boulder"),
    );
    expect(boulder?.obstacle).toBe(true);
  });

  it("compiles Summon Imp and Raise Boulder to melee's own creatures", () => {
    for (const [skill, def] of [
      [content.summonImp, content.imp],
      [content.raiseBoulder, content.boulder],
    ] as const) {
      const saved = library.skills.find((s) => s.id === skill.id)!;
      expect(summonOf(saved).source?.archetypeId).toBe(meleeCreatureId(def.id));
      const creature = summonOf(compileSkill(library, saved)).creature;
      expect(creature.stats).toEqual(def.stats);
      expect(creature.obstacle ?? false).toBe(def.obstacle ?? false);
      expect(creature.skills?.map((s) => s.id)).toEqual(
        (def.skills ?? []).map((s) => s.id),
      );
    }
  });
});

describe("designed summons", () => {
  const library = starterLibrary();
  const goblin = library.archetypes.find((a) => a.id === "type-goblin")!;
  const summon = (level: number): Skill => ({
    ...blankSkill("call"),
    name: "Call",
    target: "any",
    effect: withSummonSource(
      library,
      defaultEffect("summon") as Summon,
      goblin.id,
      level,
    ),
  });

  it("makes the creature from the type at the level", () => {
    const creature = summonOf(summon(4)).creature;
    expect(creature.name).toBe("Goblin");
    expect(creature.stats.maxHp).toBe(45 + 6 * 3);
    expect(skillProblems(summon(4), library)).toEqual([]);
  });

  it("follows later edits to the type when compiled", () => {
    const tougher: Library = {
      ...library,
      archetypes: library.archetypes.map((a) =>
        a.id === goblin.id
          ? { ...a, baseStats: { ...a.baseStats, maxHp: 100 } }
          : a,
      ),
    };
    const compiled = compileSkill(tougher, summon(1));
    expect(summonOf(compiled).creature.stats.maxHp).toBe(100);
  });

  it("keeps the saved creature and says so when the type is gone", () => {
    const gone = { ...library, archetypes: [] };
    expect(compileSkill(gone, summon(2))).toEqual(summon(2));
    expect(skillProblems(summon(2), gone)).toEqual([
      "The enemy type it summons is gone.",
    ]);
  });

  it("needs a type picked", () => {
    expect(
      skillProblems({ ...blankSkill("s"), effect: defaultEffect("summon") }),
    ).toEqual(["Pick an enemy type to summon."]);
  });

  it("compiles a type that summons itself, to a limited depth", () => {
    const echo: Archetype = {
      ...goblin,
      id: "type-echo",
      name: "Echo",
      skills: [{ skillId: "call-echo", level: 1 }],
    };
    const call: Skill = {
      ...summon(1),
      id: "call-echo",
      effect: {
        ...summonOf(summon(1)),
        source: { archetypeId: echo.id, level: 1 },
      },
    };
    const lib: Library = {
      ...library,
      archetypes: [...library.archetypes, echo],
      skills: [...library.skills, call],
      characters: [{ ...blankCharacter("c", echo), name: "Echo" }],
    };
    const creature = creatureOf(lib, echo.id, 1)!;
    expect(creature.name).toBe("Echo");
    const monster = compileRoster(lib).monsters.find((m) => m.name === "Echo");
    expect(summonOf(monster!.skills![0]!).creature.name).toBe("Echo");
  });
});
