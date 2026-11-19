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
  const summon = (): Skill => ({
    ...blankSkill("call"),
    name: "Call",
    target: "any",
    effect: withSummonSource(
      library,
      defaultEffect("summon") as Summon,
      goblin.id,
    ),
  });

  it("makes the creature from the type", () => {
    const creature = summonOf(summon()).creature;
    expect(creature.name).toBe("Goblin");
    expect(creature.stats).toEqual(goblin.baseStats);
    expect(skillProblems(summon(), library)).toEqual([]);
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
    const compiled = compileSkill(tougher, summon());
    expect(summonOf(compiled).creature.stats.maxHp).toBe(100);
  });

  it("keeps the saved creature and says so when the type is gone", () => {
    const gone = { ...library, archetypes: [] };
    expect(compileSkill(gone, summon())).toEqual(summon());
    expect(skillProblems(summon(), gone)).toEqual([
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
      skills: ["call-echo"],
    };
    const call: Skill = {
      ...summon(),
      id: "call-echo",
      effect: {
        ...summonOf(summon()),
        source: { archetypeId: echo.id },
      },
    };
    const lib: Library = {
      ...library,
      archetypes: [...library.archetypes, echo],
      skills: [...library.skills, call],
      characters: [{ ...blankCharacter("c", echo), name: "Echo" }],
    };
    const creature = creatureOf(lib, echo.id)!;
    expect(creature.name).toBe("Echo");
    const monster = compileRoster(lib).monsters.find((m) => m.name === "Echo");
    expect(summonOf(monster!.skills![0]!).creature.name).toBe("Echo");
  });
});
