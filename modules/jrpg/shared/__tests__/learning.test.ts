import { describe, expect, it } from "vitest";
import { meleeClassId } from "@jforge/char/shared";
import { content } from "@jforge/melee/shared";
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
  it("orders exactly the skills of every melee class", () => {
    // A class that gains a skill fails here until its order is rebalanced.
    for (const def of playerTypes) {
      const order = LEARNING_ORDER[meleeClassId(def.id)];
      expect(order, def.id).toBeDefined();
      expect([...order!].sort(), def.id).toEqual(
        def.skills!.map((s) => s.id).sort(),
      );
    }
  });
});

describe("skillsLearnedAt", () => {
  it("is two at level 1 and one more each level after", () => {
    expect(skillsLearnedAt(1)).toBe(FIRST_LEVEL_SKILLS);
    expect(skillsLearnedAt(2)).toBe(3);
    expect(skillsLearnedAt(5)).toBe(6);
  });
});

describe("withLearnedSkills", () => {
  it("keeps the skills learned by the level, in the order learned", () => {
    expect(names(1)).toEqual(["Cleave", "Provoke"]);
    expect(names(3)).toEqual([
      "Cleave",
      "Provoke",
      "Iron Stance",
      "Second Wind",
    ]);
  });

  it("keeps every skill once the order runs out", () => {
    expect(names(5)).toHaveLength(fighter.skills!.length);
    expect(names(20)).toHaveLength(fighter.skills!.length);
  });

  it("follows the order, not the order the skills are listed in", () => {
    const shuffled = { ...fighter, skills: [...fighter.skills!].reverse() };
    expect(
      withLearnedSkills(shuffled, FIGHTER, 1).skills!.map((s) => s.name),
    ).toEqual(["Cleave", "Provoke"]);
  });

  it("leaves a class with no order knowing every skill it has", () => {
    expect(names(1, "type-designed")).toEqual(
      fighter.skills!.map((s) => s.name),
    );
  });
});
