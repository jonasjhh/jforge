import { describe, expect, it } from "vitest";
import { content, type Skill, type SkillEffect } from "@jforge/melee/shared";
import {
  EFFECTS,
  EFFECT_TYPES,
  SKILL_FIELDS,
  STATUS_KINDS,
  effectFields,
  makeStatus,
  readField,
  writeField,
  type FieldSpec,
} from "../effectFields";
import { blankSkill } from "../library";
import { effectSummary, skillProblems } from "../skills";
import { starterLibrary } from "../starter";

const library = starterLibrary();
const spec = (effect: SkillEffect, key: string): FieldSpec =>
  effectFields(effect).find((s) => s.path.join(".") === key)!;
const strike = (more = {}): SkillEffect => ({
  type: "strike",
  power: 1,
  ...more,
});

describe("the field table", () => {
  it("given melee's skills, when their effect kinds are collected, then the table covers each of them", () => {
    const skills = [...Object.values(content)].filter(
      (v): v is Skill => !!v && typeof v === "object" && "effect" in v,
    );

    const used = new Set(skills.map((s) => s.effect.type));

    for (const type of used) expect(EFFECT_TYPES).toContain(type);
  });

  it.each(library.skills.map((s) => [s.name, s] as const))(
    "given the starter skill %s, when each field is read and written back, then the skill is unchanged",
    (_, skill) => {
      const fields = effectFields(skill.effect).filter(
        (f) => f.kind !== "statusKind" && f.kind !== "creature",
      );

      const skillBack = SKILL_FIELDS.map((field) =>
        writeField(skill, field, readField(skill, field)),
      );
      const effectBack = fields.map((field) =>
        writeField(skill.effect, field, readField(skill.effect, field)),
      );

      for (const back of skillBack) expect(back).toEqual(skill);
      for (const back of effectBack) expect(back).toEqual(skill.effect);
    },
  );

  it.each(library.skills.map((s) => [s.name, s] as const))(
    "given the starter skill %s, when it is checked and summed up, then nothing is wrong with it",
    (_, skill) => {
      const problems = skillProblems(skill, library);
      const summary = effectSummary(skill);

      expect(problems).toEqual([]);
      expect(summary).not.toMatch(/undefined|NaN/);
    },
  );

  it("given a strike that weakens, when weaken is set to 0, then the option is left out", () => {
    const weak = strike({ weaken: 0.75 });

    const written = writeField(weak, spec(strike(), "weaken"), 0);

    expect(written).not.toHaveProperty("weaken");
  });

  it("given a strike without finishBelow, when the field is read, then it shows the default 0.3", () => {
    const finish = spec(strike(), "finishBelow");

    const value = readField(strike(), finish);

    expect(value).toBe(0.3);
  });

  it("given a strike, when finishBelow is set to its default, then the option is left out", () => {
    const finish = spec(strike(), "finishBelow");

    const written = writeField(strike(), finish, 0.3);

    expect(written).not.toHaveProperty("finishBelow");
  });

  it("given a strike, when finishBelow is set off its default, then it is kept", () => {
    const finish = spec(strike(), "finishBelow");

    const written = writeField(strike(), finish, 0.5);

    expect(written).toMatchObject({ finishBelow: 0.5 });
  });

  it("given a strike that pins, when pin is cleared, then the flag is left out", () => {
    const pinned = strike({ pin: true });

    const written = writeField(pinned, spec(strike(), "pin"), false);

    expect(written).toEqual(strike());
  });

  it("given a buff, when its required harmful flag is cleared, then it is kept as false", () => {
    const buff = EFFECTS.modify.make();

    const written = writeField(buff, spec(buff, "modifier.harmful"), false);

    expect(written).toMatchObject({ modifier: { harmful: false } });
  });

  it("given an effect, when a field is written, then the effect itself is unchanged", () => {
    const before = strike();

    writeField(before, spec(before, "push"), 1);

    expect(before).toEqual(strike());
  });
});

describe("statuses", () => {
  const status = (kind: (typeof STATUS_KINDS)[number]): Skill => {
    const effect: SkillEffect = { type: "status", status: makeStatus(kind) };
    return {
      ...blankSkill("s"),
      effect,
      target: effect.status.harmful ? "enemy" : "ally",
    };
  };

  it.each(STATUS_KINDS)(
    "given a new %s status skill, when it is checked, then it has no problems",
    (kind) => {
      const skill = status(kind);

      const problems = skillProblems(skill);

      expect(problems).toEqual([]);
    },
  );

  it("given a bless, when its fields are listed, then its own strengths show with their defaults and no others", () => {
    const bless = status("bless").effect;

    const dealt = readField(bless, spec(bless, "status.dealt"));
    const taken = readField(bless, spec(bless, "status.taken"));

    expect(dealt).toBe(1.2);
    expect(taken).toBe(0.8);
    expect(spec(bless, "status.defense")).toBeUndefined();
  });

  it("given a bless, when its dealt strength is lowered, then the summary shows the new strength", () => {
    const bless = status("bless").effect;

    const lesser = writeField(bless, spec(bless, "status.dealt"), 1.1);

    expect(effectSummary({ ...status("bless"), effect: lesser })).toBe(
      "blesses: deals ×1.1, takes ×0.8 for 150",
    );
  });

  it("given a status with its own id and power, when its kind is switched, then it starts from the new kind's defaults, keeping the id", () => {
    const effect: SkillEffect = {
      type: "status",
      status: { ...makeStatus("damage"), id: "mine", power: 9 },
    };

    const next = writeField(effect, spec(effect, "status.effect"), "petrify");

    expect(next).toEqual({
      type: "status",
      status: { ...makeStatus("petrify"), id: "mine" },
    });
  });
});
