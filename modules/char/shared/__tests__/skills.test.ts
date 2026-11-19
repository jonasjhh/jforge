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
  it.each(EDITABLE_EFFECTS)(
    "given the %s kind, when its default effect is made, then it is editable and problem-free",
    (type) => {
      const effect = defaultEffect(type, starterLibrary());

      const skill = withEffect(effect, { target: defaultTarget(effect) });

      expect(effect.type).toBe(type);
      expect(isEditable(effect)).toBe(true);
      expect(skillProblems(skill)).toEqual([]);
    },
  );
});

describe("isEditable", () => {
  it.each([
    ["melee's cure", content.cure.effect, true],
    ["melee's summon imp", content.summonImp.effect, true],
    ["an unknown kind", { type: "nope" } as never, false],
  ] as const)(
    "given %s, when it is checked, then editable is %s",
    (_, effect, editable) => {
      const result = isEditable(effect);

      expect(result).toBe(editable);
    },
  );
});

describe("defaultTarget", () => {
  it.each([
    ["damage", defaultEffect("damage"), "enemy"],
    ["a strike", defaultEffect("strike"), "enemy"],
    ["a heal", defaultEffect("heal"), "ally"],
    ["haste", content.haste.effect, "ally"],
    ["slow", content.slow.effect, "enemy"],
  ] as const)(
    "given %s, when its default target is chosen, then it aims at an %s",
    (_, effect, target) => {
      const result = defaultTarget(effect);

      expect(result).toBe(target);
    },
  );
});

describe("effectSummary", () => {
  const add = (value: number) =>
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
    });
  const strike = (more: object) =>
    withEffect({ type: "strike", power: 1, ...more });

  it.each<[string, Skill, string]>([
    ["melee's fireball", content.fireball, "fire damage ×1.2, plus"],
    [
      "a strike",
      withEffect({ type: "strike", power: 1.5 }),
      "weapon strike ×1.5",
    ],
    ["a heal", withEffect({ type: "heal", power: 2 }), "heals ×2 magic"],
    ["a buff", withEffect(defaultEffect("modify")), "attack ×1.5 for 100"],
    ["melee's cure", content.cure, "removes harmful statuses and debuffs"],
    ["a gain of 5", add(5), "defense +5 for 50"],
    ["a loss of 5", add(-5), "defense -5 for 50"],
    ["a pull", strike({ push: -1 }), "weapon strike ×1, pulls 1"],
    [
      "a finisher under half HP",
      strike({ finisher: 3, finishBelow: 0.5 }),
      "weapon strike ×1, ×3 below 50% HP",
    ],
    [
      "a heal of max HP",
      withEffect({ type: "heal", power: 1, of: "maxHp" }),
      "heals ×1 max HP",
    ],
    [
      "a heave of one row",
      withEffect({ type: "heave", rows: 1 }),
      "heaves back 1 row",
    ],
    [
      "a heave of two rows",
      withEffect({ type: "heave", rows: 2 }),
      "heaves back 2 rows",
    ],
    [
      "a gauge set",
      withEffect({ type: "gauge", to: 0.5 }),
      "sets the turn gauge to 50%",
    ],
    [
      "an MP restore",
      withEffect({ type: "restoreMp", amount: 3 }),
      "restores 3 MP",
    ],
  ])(
    "given %s, when it is summed up, then it reads as said",
    (_, skill, text) => {
      const summary = effectSummary(skill);

      expect(summary).toBe(text);
    },
  );

  it("given a strike with every option, when it is summed up, then the options come in order", () => {
    const skill = strike({
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
    });

    const summary = effectSummary(skill);

    expect(summary).toBe(
      "charging weapon strike ×1, pushes 2, pins, sets burning, bleeds, " +
        "weakens to ×0.5, staggers 25%, ignores 40% defense, " +
        "×2 below 30% HP, heals the most-hurt ally 30% of the damage",
    );
  });

  it("given a row spell with every damage option, when it is summed up, then the options come before the area", () => {
    const skill = withEffect(
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
    );

    const summary = effectSummary(skill);

    expect(summary).toBe(
      "cold damage ×1 each, ×2 shared (×1.5 if empowered), drains 50%, " +
        "burns 4 MP, chills, row",
    );
  });
});

describe("skillProblems", () => {
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
  ])(
    "given a skill that breaks a rule, when it is checked, then it reports: %s",
    (problem, skill) => {
      const problems = skillProblems(skill);

      expect(problems).toContain(problem);
    },
  );
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
  const HEAVE = "Heave at least one row.";
  const MP = "Restore at least 1 MP.";

  it.each([
    ["gauge", { to: 0 }, GAUGE, true],
    ["gauge", { to: 0.01 }, GAUGE, false],
    ["gauge", { to: 1 }, GAUGE, false],
    ["gauge", { to: 1.01 }, GAUGE, true],
    ["heave", { rows: 0 }, HEAVE, true],
    ["heave", { rows: 1 }, HEAVE, false],
    ["restoreMp", { amount: 0 }, MP, true],
    ["restoreMp", { amount: 1 }, MP, false],
  ] as const)(
    "given a %s set to %o, when it is checked, then '%s' is reported: %s",
    (type, change, problem, reported) => {
      const problems = problemsOf(type, change);

      expect(problems.includes(problem)).toBe(reported);
    },
  );

  const heal = (power: number) => withEffect({ type: "heal", power });

  it.each<[string, Skill]>([
    ["a heal of power just above 0", heal(0.01)],
    ["a heal costing no MP or HP", { ...heal(1), mpCost: 0, hpCost: 0 }],
  ])("given %s, when it is checked, then nothing is wrong", (_, skill) => {
    const problems = skillProblems(skill);

    expect(problems).toEqual([]);
  });

  it("given a negative HP cost, when it is checked, then it is reported", () => {
    const skill = { ...heal(1), hpCost: -1 };

    const problems = skillProblems(skill);

    expect(problems).toContain("HP cost can't be negative.");
  });

  const DURATION = "A buff or debuff needs a duration.";
  const lasting = (type: "modify" | "sacrifice", duration: number) => {
    const effect = defaultEffect(type) as Extract<
      Skill["effect"],
      { type: "modify" | "sacrifice" }
    >;
    return withEffect({
      ...effect,
      modifier: { ...effect.modifier, duration },
    });
  };

  it.each([
    ["modify", 0, true],
    ["modify", 1, false],
    ["sacrifice", 0, true],
    ["sacrifice", 1, false],
  ] as const)(
    "given a %s lasting %d, when it is checked, then a missing duration is reported: %s",
    (type, duration, reported) => {
      const skill = lasting(type, duration);

      const problems = skillProblems(skill);

      expect(problems.includes(DURATION)).toBe(reported);
    },
  );

  const status = (change: object) => {
    const effect = defaultEffect("status") as Extract<
      Skill["effect"],
      { type: "status" }
    >;
    return withEffect({ ...effect, status: { ...effect.status, ...change } });
  };

  it("given a default status, when it is checked, then nothing is wrong", () => {
    const skill = status({});

    const problems = skillProblems(skill);

    expect(problems).toEqual([]);
  });

  it.each([
    ["a blank name", { name: "  " }, "Name the status.", true],
    ["an interval of 0", { interval: 0 }, "A status needs a duration.", true],
    ["no ticks", { ticks: 0 }, "A status needs a duration.", true],
    ["one tick", { ticks: 1 }, "A status needs a duration.", false],
  ] as const)(
    "given a status with %s, when it is checked, then '%s' is reported: %s",
    (_, change, problem, reported) => {
      const skill = status(change);

      const problems = skillProblems(skill);

      expect(problems.includes(problem)).toBe(reported);
    },
  );

  it.each([
    ["heave", { rows: 0 }, [HEAVE]],
    ["gauge", { to: 0 }, [GAUGE]],
  ] as const)(
    "given a %s with one problem, when it is checked, then only that problem is reported",
    (type, change, expected) => {
      const problems = problemsOf(type, change);

      expect(problems).toEqual(expected);
    },
  );
});
