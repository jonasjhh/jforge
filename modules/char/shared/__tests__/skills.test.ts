import { describe, expect, it } from "vitest";
import { content, type Skill } from "@jforge/melee/shared";
import { blankSkill } from "../library";
import { starterLibrary } from "../starter";
import {
  EDITABLE_EFFECTS,
  defaultEffect,
  defaultTarget,
  effectSummary,
  isEditable,
  skillProblems,
} from "../skills";

const withEffect = (
  effect: Skill["effect"],
  more: Partial<Skill> = {},
): Skill => ({
  ...blankSkill("s"),
  effect,
  ...more,
});

describe("defaultEffect", () => {
  it.each(EDITABLE_EFFECTS)("makes an editable, problem-free %s", (type) => {
    const effect = defaultEffect(type, starterLibrary());
    expect(effect.type).toBe(type);
    expect(isEditable(effect)).toBe(true);
    expect(
      skillProblems(withEffect(effect, { target: defaultTarget(effect) })),
    ).toEqual([]);
  });
});

describe("isEditable", () => {
  it("is true for every melee effect, false for unknown data", () => {
    expect(isEditable(content.cure.effect)).toBe(true);
    expect(isEditable(content.summonImp.effect)).toBe(true);
    expect(isEditable({ type: "nope" } as never)).toBe(false);
  });
});

describe("defaultTarget", () => {
  it("aims harm at enemies and help at allies", () => {
    expect(defaultTarget(defaultEffect("damage"))).toBe("enemy");
    expect(defaultTarget(defaultEffect("strike"))).toBe("enemy");
    expect(defaultTarget(defaultEffect("heal"))).toBe("ally");
    expect(defaultTarget(content.haste.effect)).toBe("ally");
    expect(defaultTarget(content.slow.effect)).toBe("enemy");
  });
});

describe("effectSummary", () => {
  it("says what each kind of effect does", () => {
    expect(effectSummary(content.fireball)).toBe("fire damage ×1.2, plus");
    expect(effectSummary(withEffect({ type: "strike", power: 1.5 }))).toBe(
      "weapon strike ×1.5",
    );
    expect(effectSummary(withEffect({ type: "heal", power: 2 }))).toBe(
      "heals ×2 magic",
    );
    expect(effectSummary(withEffect(defaultEffect("modify")))).toBe(
      "attack ×1.5 for 100",
    );
    expect(effectSummary(content.cure)).toBe(
      "removes harmful statuses and debuffs",
    );
  });

  it("shows added amounts with a sign", () => {
    const add = (value: number) =>
      effectSummary(
        withEffect({
          type: "modify",
          modifier: {
            name: "x",
            stat: "defense",
            op: "add",
            value,
            duration: 50,
            harmful: value < 0,
          },
        }),
      );
    expect(add(5)).toBe("defense +5 for 50");
    expect(add(-5)).toBe("defense -5 for 50");
  });
});

describe("skillProblems", () => {
  it("finds nothing wrong with melee's own skills of editable kinds", () => {
    for (const skill of [content.fireball, content.heal, content.cleave]) {
      expect(skillProblems(skill)).toEqual([]);
    }
  });

  it.each<[string, Skill]>([
    [
      "Give the skill a name.",
      withEffect(defaultEffect("damage"), { name: " " }),
    ],
    [
      "MP cost can't be negative.",
      withEffect(defaultEffect("damage"), { mpCost: -1 }),
    ],
    ["Power must be above 0.", withEffect({ type: "heal", power: 0 })],
    [
      "A weapon strike must target an enemy.",
      withEffect({ type: "strike", power: 1 }, { target: "ally" }),
    ],
    [
      "A buff or debuff needs a duration.",
      withEffect({
        type: "modify",
        modifier: {
          name: "x",
          stat: "speed",
          op: "mul",
          value: 2,
          duration: 0,
          harmful: false,
        },
      }),
    ],
  ])("reports: %s", (problem, skill) => {
    expect(skillProblems(skill)).toContain(problem);
  });
});
