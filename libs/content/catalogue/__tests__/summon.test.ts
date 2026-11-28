import { describe, expect, it } from "vitest";
import { content, type Skill, type SkillEffect } from "@jforge/melee/shared";
import {
  blankCharacter,
  compileRoster,
  compileSkill,
  creatureOf,
  skillProblems,
  type Archetype,
  type Library,
} from "@jforge/rules/core";
import { meleeCreatureId } from "../melee";
import { catalogue as starterLibrary } from "..";

type Summon = Extract<SkillEffect, { type: "summon" }>;
const summonOf = (skill: Skill) => skill.effect as Summon;

/** A summon with no enemy type picked yet. */
const unpicked = (): Summon => ({
  type: "summon",
  creature: {
    id: "nothing",
    name: "Nothing",
    stats: {
      maxHp: 1,
      maxMp: 0,
      attack: 0,
      magic: 0,
      defense: 0,
      spirit: 0,
      speed: 0,
    },
    weapon: structuredClone(content.noWeapon),
  },
});
const skill = (id: string, effect: SkillEffect): Skill => ({
  id,
  name: "New skill",
  description: "",
  mpCost: 5,
  target: "enemy",
  area: "single",
  effect,
});

describe("melee's creatures as summons", () => {
  const library = starterLibrary();
  const typeOf = (id: string) =>
    library.archetypes.find((a) => a.id === meleeCreatureId(id));

  it.each(["imp", "boulder"])(
    "given the catalogue, when melee's %s is looked up, then it is a summon",
    (id) => {
      const type = typeOf(id);

      expect(type?.kind).toBe("summon");
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
  const catalogue = starterLibrary();
  /** A summon shaped like the goblin enemy type. */
  const goblin: Archetype = {
    ...catalogue.archetypes.find((a) => a.id === "enemy-goblin")!,
    id: "summon-goblin",
    kind: "summon",
  };
  const library: Library = {
    ...catalogue,
    archetypes: [...catalogue.archetypes, goblin],
  };
  const summon = (): Skill => ({
    ...skill("call", {
      ...unpicked(),
      source: { archetypeId: goblin.id },
      creature: creatureOf(library, goblin.id)!,
    }),
    name: "Call",
    target: "any",
  });

  it("given a summon of the goblin type, when its creature is made, then it is a goblin with the type's stats and no problems", () => {
    const call = summon();

    const creature = summonOf(call).creature;

    expect(creature.name).toBe("Goblin");
    expect(creature.stats).toEqual(goblin.baseStats);
    expect(skillProblems(call, library)).toEqual([]);
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

    expect(problems).toEqual(["The summon it puts in is gone."]);
  });

  it("given a summon with no type picked, when it is checked, then it asks for one", () => {
    const none = skill("s", unpicked());

    const problems = skillProblems(none);

    expect(problems).toEqual(["Pick a summon for it to put in."]);
  });

  it("given a summon of an enemy type, when it is checked, then it says that is no summon", () => {
    const enemy = library.archetypes.find((a) => a.id === "enemy-goblin")!;
    const call = skill("call", {
      ...unpicked(),
      source: { archetypeId: enemy.id },
    });

    const problems = skillProblems(call, library);

    expect(problems).toEqual(["Goblin is not a summon."]);
  });

  it("given a summon with a character, when the roster is compiled, then it is in neither the party nor the monsters", () => {
    const lib: Library = {
      ...library,
      characters: [{ ...blankCharacter("c", goblin), name: "Pet" }],
    };

    const roster = compileRoster(lib);

    expect(roster).toEqual({ party: [], monsters: [] });
  });

  it("given a type that summons itself, when the roster is compiled, then it compiles to a limited depth", () => {
    const echo: Archetype = {
      ...goblin,
      kind: "enemy",
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
