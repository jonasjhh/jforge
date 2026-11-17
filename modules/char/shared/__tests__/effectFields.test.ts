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
  it("covers every effect kind melee has", () => {
    const used = new Set(
      [...Object.values(content)]
        .filter(
          (v): v is Skill => !!v && typeof v === "object" && "effect" in v,
        )
        .map((s) => s.effect.type),
    );
    for (const type of used) expect(EFFECT_TYPES).toContain(type);
  });

  it.each(library.skills.map((s) => [s.name, s] as const))(
    "reads and writes back %s unchanged",
    (_, skill) => {
      for (const field of SKILL_FIELDS) {
        expect(writeField(skill, field, readField(skill, field))).toEqual(
          skill,
        );
      }
      for (const field of effectFields(skill.effect)) {
        if (field.kind === "statusKind" || field.kind === "creature") continue;
        const back = writeField(
          skill.effect,
          field,
          readField(skill.effect, field),
        );
        expect(back).toEqual(skill.effect);
      }
    },
  );

  it("finds nothing wrong with any skill in the starter library", () => {
    for (const skill of library.skills) {
      expect(skillProblems(skill, library)).toEqual([]);
      expect(effectSummary(skill)).not.toMatch(/undefined|NaN/);
    }
  });

  it("leaves an option out at its default and keeps required flags", () => {
    const weak = writeField(
      strike({ weaken: 0.75 }),
      spec(strike(), "weaken"),
      0,
    );
    expect(weak).not.toHaveProperty("weaken");
    const finish = spec(strike(), "finishBelow");
    expect(readField(strike(), finish)).toBe(0.3);
    expect(writeField(strike(), finish, 0.3)).not.toHaveProperty("finishBelow");
    expect(writeField(strike(), finish, 0.5)).toMatchObject({
      finishBelow: 0.5,
    });
    expect(
      writeField(strike({ pin: true }), spec(strike(), "pin"), false),
    ).toEqual(strike());
    const buff = EFFECTS.modify.make();
    const harmful = spec(buff, "modifier.harmful");
    expect(writeField(buff, harmful, false)).toMatchObject({
      modifier: { harmful: false },
    });
  });

  it("does not change the effect it writes to", () => {
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

  it.each(STATUS_KINDS)("a new %s is problem-free", (kind) => {
    expect(skillProblems(status(kind))).toEqual([]);
  });

  it("shows a kind's strengths with their defaults, and only its own", () => {
    const bless = status("bless").effect;
    expect(readField(bless, spec(bless, "status.dealt"))).toBe(1.2);
    expect(readField(bless, spec(bless, "status.taken"))).toBe(0.8);
    expect(spec(bless, "status.defense")).toBeUndefined();
    const lesser = writeField(bless, spec(bless, "status.dealt"), 1.1);
    expect(effectSummary({ ...status("bless"), effect: lesser })).toBe(
      "blesses: deals ×1.1, takes ×0.8 for 150",
    );
  });

  it("switching the kind starts from its defaults, keeping the id", () => {
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
