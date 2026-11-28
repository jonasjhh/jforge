import { describe, expect, it } from "vitest";
import { content } from "@jforge/melee/shared";
import { effectSummary, skillProblems, type Skill } from "@jforge/rules/core";

describe("melee's skills in words", () => {
  it.each<[string, Skill, string]>([
    ["melee's fireball", content.fireball, "fire damage ×1.2, plus"],
    ["melee's cure", content.cure, "removes harmful statuses and debuffs"],
  ])(
    "given %s, when it is summed up, then it reads as said",
    (_, skill, words) => {
      const summary = effectSummary(skill);

      expect(summary).toBe(words);
    },
  );

  it.each(
    [content.fireball, content.heal, content.cleave].map(
      (s) => [s.name, s] as const,
    ),
  )(
    "given melee's %s, when it is checked, then nothing is wrong",
    (_, skill) => {
      const problems = skillProblems(skill);

      expect(problems).toEqual([]);
    },
  );
});
