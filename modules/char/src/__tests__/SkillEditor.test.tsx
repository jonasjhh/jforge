// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { Skill } from "@jforge/melee/shared";
import { blankSkill, starterLibrary } from "../../shared";
import { SkillEditor } from "../SkillEditor";
import { renderControlled } from "./controlled";

afterEach(cleanup);

const library = starterLibrary();

function edit(skill: Skill = blankSkill("skill-1")) {
  return renderControlled(skill, (value, onChange) => (
    <SkillEditor skill={value} library={library} onChange={onChange} />
  ));
}
const effectGroup = () => screen.getByRole("group", { name: "Effect" });
const pick = (label: string, value: string, within_ = document.body) =>
  fireEvent.change(within(within_).getAllByLabelText(label)[0]!, {
    target: { value },
  });

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("SkillEditor", () => {
  it.each([
    ["Name", "Zap", { name: "Zap" }],
    ["Description", "Zaps.", { description: "Zaps." }],
    ["MP cost", "7", { mpCost: 7 }],
  ] as const)(
    "given a blank skill, when %s is set to %s, then the skill has it",
    (label, value, change) => {
      const skill = edit();

      type(label, value);

      expect(skill.current).toMatchObject(change);
    },
  );

  it("given a blank skill, when Not on itself is ticked, then the skill has the flag", () => {
    const skill = edit();

    fireEvent.click(screen.getByLabelText("Not on itself"));

    expect(skill.current.notSelf).toBe(true);
  });

  it("given a blank skill, when its effect kind becomes heal, then it gets heal's defaults and aims at allies", () => {
    const skill = edit();

    pick("Kind", "heal", effectGroup());

    expect(skill.current.effect.type).toBe("heal");
    expect(skill.current.target).toBe("ally");
  });

  it("given a blank skill, when its effect kind becomes status, then the status takes the skill's id and aims at enemies", () => {
    const skill = edit();

    pick("Kind", "status", effectGroup());

    const { effect } = skill.current;
    expect(effect.type === "status" && effect.status.id).toBe("skill-1");
    expect(skill.current.target).toBe("enemy");
  });

  it("given a status skill, when the status is renamed, then the target is kept", () => {
    const skill = edit();
    pick("Kind", "status", effectGroup());

    fireEvent.change(within(effectGroup()).getByLabelText("Shown as"), {
      target: { value: "Rot" },
    });

    expect(skill.current.target).toBe("enemy");
  });

  it("given a status skill aimed at enemies, when its status becomes a heal, then it is re-aimed at allies", () => {
    const skill = edit();
    pick("Kind", "status", effectGroup());

    pick("Status", "heal", effectGroup());

    const { effect } = skill.current;
    expect(effect.type === "status" && effect.status.effect).toBe("heal");
    expect(skill.current.target).toBe("ally");
  });

  it("given a damage skill aimed at anyone, when its damage type changes, then the target is kept", () => {
    const skill = edit({ ...blankSkill("skill-1"), target: "any" });

    pick("Damage type", "cold", effectGroup());

    const { effect } = skill.current;
    expect(effect.type === "damage" && effect.element).toBe("cold");
    expect(skill.current.target).toBe("any");
  });

  it("given a summon skill, when the goblin type is picked, then it summons a goblin", () => {
    const skill = edit();
    pick("Kind", "summon", effectGroup());

    pick("Creature (enemy type)", "type-goblin", effectGroup());

    const { effect } = skill.current;
    expect(effect.type === "summon" && effect.source).toEqual({
      archetypeId: "type-goblin",
    });
    expect(effect.type === "summon" && effect.creature.name).toBe("Goblin");
  });

  it("given a skill with a blank name, when it is edited, then the problem is shown", () => {
    edit({ ...blankSkill("skill-1"), name: " " });

    const alerts = screen.getAllByRole("alert").map((a) => a.textContent);

    expect(alerts).toContain("Give the skill a name.");
  });

  it("given a skill with an unknown effect, when it is edited, then the effect is left alone", () => {
    edit({
      ...blankSkill("skill-1"),
      effect: { type: "mystery" } as unknown as Skill["effect"],
    });

    const group = screen.queryByRole("group", { name: "Effect" });

    expect(group).toBeNull();
    expect(screen.getByText(/effect \(mystery\) is unknown here/)).toBeTruthy();
  });
});
