import { describe, expect, it } from "vitest";
import { meleeClassId } from "@jforge/content/catalogue";
import * as content from "@jforge/content/starter";
import {
  FIRST_LEVEL_SKILLS,
  LEARNING_ORDER,
  skillsLearnedAt,
  withLearnedSkills,
} from "../learning";

const { fighter, playerTypes } = content;
const FIGHTER = meleeClassId(fighter.id);
const names = (level: number, classId = FIGHTER) =>
  withLearnedSkills(fighter, classId, level).skills!.map((s) => s.name);

describe("LEARNING_ORDER", () => {
  // A class that gains a skill fails here until its order is rebalanced.
  it.each(playerTypes.map((def) => [def.id, def] as const))(
    "given melee's %s, when its learning order is looked up, then it orders exactly the class's skills",
    (_, def) => {
      const order = LEARNING_ORDER[meleeClassId(def.id)];

      expect(order).toBeDefined();
      expect([...order!].sort()).toEqual(def.skills!.map((s) => s.id).sort());
    },
  );
});

describe("skillsLearnedAt", () => {
  it.each([
    [1, FIRST_LEVEL_SKILLS],
    [2, 3],
    [5, 6],
  ])(
    "given level %i, when the skills learned are counted, then there are %i",
    (level, count) => {
      const learned = skillsLearnedAt(level);

      expect(learned).toBe(count);
    },
  );
});

describe("withLearnedSkills", () => {
  it("given a level-1 fighter, when its skills are learned, then it knows the first two", () => {
    const learned = names(1);

    expect(learned).toEqual(["Cleave", "Provoke"]);
  });

  it("given a level-3 fighter, when its skills are learned, then it knows four, in the order learned", () => {
    const learned = names(3);

    expect(learned).toEqual([
      "Cleave",
      "Provoke",
      "Iron Stance",
      "Second Wind",
    ]);
  });

  it.each([5, 20])(
    "given a level-%i fighter, past the end of its order, when its skills are learned, then it knows all of them",
    (level) => {
      const learned = names(level);

      expect(learned).toHaveLength(fighter.skills!.length);
    },
  );

  it("given a fighter whose skills are listed backwards, when its skills are learned, then the learning order still decides", () => {
    const shuffled = { ...fighter, skills: [...fighter.skills!].reverse() };

    const learned = withLearnedSkills(shuffled, FIGHTER, 1).skills!;

    expect(learned.map((s) => s.name)).toEqual(["Cleave", "Provoke"]);
  });

  it("given a class with no learning order, when its skills are learned, then it knows every skill it has", () => {
    const learned = names(1, "type-designed");

    expect(learned).toEqual(fighter.skills!.map((s) => s.name));
  });
});
