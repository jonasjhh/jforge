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
  const typeOf = (id: string) =>
    library.archetypes.find((a) => a.id === meleeCreatureId(id));

  it.each(["imp", "boulder"])(
    "given the starter library, when melee's %s is looked up, then it is an enemy type",
    (id) => {
      const type = typeOf(id);

      expect(type?.kind).toBe("enemy");
    },
  );

  it("given the starter library, when the boulder is looked up, then it is an obstacle", () => {
    const boulder = typeOf("boulder");

    expect(boulder?.obstacle).toBe(true);
  });

  it.each([
    [content.summonImp.name, content.summonImp, content.imp],
    [content.raiseBoulder.name, content.raiseBoulder, content.boulder],
  ] as const)(
    "given the saved %s, when it is compiled, then it summons melee's own creature",
    (_, skill, def) => {
      const saved = library.skills.find((s) => s.id === skill.id)!;

      const creature = summonOf(compileSkill(library, saved)).creature;

      expect(summonOf(saved).source?.archetypeId).toBe(meleeCreatureId(def.id));
      expect(creature.stats).toEqual(def.stats);
      expect(creature.obstacle ?? false).toBe(def.obstacle ?? false);
      expect(creature.skills?.map((s) => s.id)).toEqual(
        (def.skills ?? []).map((s) => s.id),
      );
    },
  );
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

  it("given a summon of the goblin type, when its creature is made, then it is a goblin with the type's stats and no problems", () => {
    const skill = summon();

    const creature = summonOf(skill).creature;

    expect(creature.name).toBe("Goblin");
    expect(creature.stats).toEqual(goblin.baseStats);
    expect(skillProblems(skill, library)).toEqual([]);
  });

  it("given the goblin type made tougher after the summon was saved, when the summon is compiled, then the creature follows the edit", () => {
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

  it("given the summoned type is gone, when the summon is compiled, then the saved creature is kept", () => {
    const gone = { ...library, archetypes: [] };

    const compiled = compileSkill(gone, summon());

    expect(compiled).toEqual(summon());
  });

  it("given the summoned type is gone, when the summon is checked, then that is reported", () => {
    const gone = { ...library, archetypes: [] };

    const problems = skillProblems(summon(), gone);

    expect(problems).toEqual(["The enemy type it summons is gone."]);
  });

  it("given a summon with no type picked, when it is checked, then it asks for one", () => {
    const skill = { ...blankSkill("s"), effect: defaultEffect("summon") };

    const problems = skillProblems(skill);

    expect(problems).toEqual(["Pick an enemy type to summon."]);
  });

  it("given a type that summons itself, when the roster is compiled, then it compiles to a limited depth", () => {
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
    const monster = compileRoster(lib).monsters.find((m) => m.name === "Echo");

    expect(creature.name).toBe("Echo");
    expect(summonOf(monster!.skills![0]!).creature.name).toBe("Echo");
  });
});
