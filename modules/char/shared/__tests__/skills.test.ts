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

  it("lists a strike's options in order", () => {
    const strike = (more: object) =>
      effectSummary(withEffect({ type: "strike", power: 1, ...more }));
    expect(
      strike({
        advance: true,
        push: 2,
        pin: true,
        ignite: true,
        bleed: true,
        weaken: 0.5,
        stagger: 0.25,
        armorPierce: 0.4,
        finisher: 2,
        mend: 0.3,
      }),
    ).toBe(
      "charging weapon strike ×1, pushes 2, pins, sets burning, bleeds, " +
        "weakens to ×0.5, staggers 25%, ignores 40% defense, " +
        "×2 below 30% HP, heals the most-hurt ally 30% of the damage",
    );
    expect(strike({ push: -1 })).toBe("weapon strike ×1, pulls 1");
    expect(strike({ finisher: 3, finishBelow: 0.5 })).toBe(
      "weapon strike ×1, ×3 below 50% HP",
    );
  });

  it("lists a damage spell's options, then its area", () => {
    expect(
      effectSummary(
        withEffect(
          {
            type: "damage",
            kind: "magical",
            element: "cold",
            power: 1,
            split: 2,
            vsEmpowered: 1.5,
            drain: 0.5,
            burnMp: 4,
            chill: true,
          },
          { area: "row" },
        ),
      ),
    ).toBe(
      "cold damage ×1 each, ×2 shared (×1.5 if empowered), drains 50%, " +
        "burns 4 MP, chills, row",
    );
  });

  it("says what heals, heaves and summons do", () => {
    expect(
      effectSummary(withEffect({ type: "heal", power: 1, of: "maxHp" })),
    ).toBe("heals ×1 max HP");
    expect(effectSummary(withEffect({ type: "heave", rows: 1 }))).toBe(
      "heaves back 1 row",
    );
    expect(effectSummary(withEffect({ type: "heave", rows: 2 }))).toBe(
      "heaves back 2 rows",
    );
    expect(effectSummary(withEffect({ type: "gauge", to: 0.5 }))).toBe(
      "sets the turn gauge to 50%",
    );
    expect(effectSummary(withEffect({ type: "restoreMp", amount: 3 }))).toBe(
      "restores 3 MP",
    );
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

describe("skillProblems at the edges", () => {
  /** The problems of a skill with `type`'s default effect, changed. */
  const problemsOf = (
    type: "gauge" | "heave" | "restoreMp",
    change: Record<string, number>,
  ) =>
    skillProblems(
      withEffect({ ...defaultEffect(type), ...change } as Skill["effect"]),
    );
  const GAUGE = "The gauge must be set above 0 and at most full.";

  it("takes a gauge set above 0 up to full", () => {
    expect(problemsOf("gauge", { to: 0 })).toContain(GAUGE);
    expect(problemsOf("gauge", { to: 0.01 })).not.toContain(GAUGE);
    expect(problemsOf("gauge", { to: 1 })).not.toContain(GAUGE);
    expect(problemsOf("gauge", { to: 1.01 })).toContain(GAUGE);
  });

  it("takes a heave of one row or more", () => {
    const HEAVE = "Heave at least one row.";
    expect(problemsOf("heave", { rows: 0 })).toContain(HEAVE);
    expect(problemsOf("heave", { rows: 1 })).not.toContain(HEAVE);
  });

  it("takes MP restored of 1 or more", () => {
    const MP = "Restore at least 1 MP.";
    expect(problemsOf("restoreMp", { amount: 0 })).toContain(MP);
    expect(problemsOf("restoreMp", { amount: 1 })).not.toContain(MP);
  });

  it("takes power above 0 and costs of 0", () => {
    const heal = (power: number) => withEffect({ type: "heal", power });
    expect(skillProblems(heal(0.01))).toEqual([]);
    expect(skillProblems({ ...heal(1), mpCost: 0, hpCost: 0 })).toEqual([]);
    expect(skillProblems({ ...heal(1), hpCost: -1 })).toContain(
      "HP cost can't be negative.",
    );
  });

  it("takes a buff or debuff lasting 1 or more, for sacrifices too", () => {
    const DURATION = "A buff or debuff needs a duration.";
    for (const type of ["modify", "sacrifice"] as const) {
      const effect = defaultEffect(type) as Extract<
        Skill["effect"],
        { type: "modify" | "sacrifice" }
      >;
      const lasting = (duration: number) =>
        skillProblems(
          withEffect({
            ...effect,
            modifier: { ...effect.modifier, duration },
          }),
        );
      expect(lasting(0)).toContain(DURATION);
      expect(lasting(1)).not.toContain(DURATION);
    }
  });

  it("takes a named status with a duration", () => {
    const effect = defaultEffect("status") as Extract<
      Skill["effect"],
      { type: "status" }
    >;
    const problems = (status: Partial<typeof effect.status>) =>
      skillProblems(
        withEffect({ ...effect, status: { ...effect.status, ...status } }),
      );
    const DURATION = "A status needs a duration.";
    expect(problems({})).toEqual([]);
    expect(problems({ name: "  " })).toContain("Name the status.");
    expect(problems({ interval: 0 })).toContain(DURATION);
    expect(problems({ ticks: 0 })).toContain(DURATION);
    expect(problems({ ticks: 1 })).not.toContain(DURATION);
  });

  it("reports nothing but the problem it found", () => {
    expect(problemsOf("heave", { rows: 0 })).toEqual([
      "Heave at least one row.",
    ]);
    expect(problemsOf("gauge", { to: 0 })).toEqual([GAUGE]);
  });
});
