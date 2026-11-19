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

describe("SkillEditor", () => {
  it("edits the name, description, costs and flags", () => {
    const skill = edit();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Zap" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Zaps." },
    });
    fireEvent.change(screen.getByLabelText("MP cost"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByLabelText("Not on itself"));
    expect(skill.current).toMatchObject({
      name: "Zap",
      description: "Zaps.",
      mpCost: 7,
      notSelf: true,
    });
  });

  it("gives a new kind of effect its defaults and its usual target", () => {
    const skill = edit();
    pick("Kind", "heal", effectGroup());
    expect(skill.current.effect.type).toBe("heal");
    expect(skill.current.target).toBe("ally");
  });

  it("gives a new status the skill's id", () => {
    const skill = edit();
    pick("Kind", "status", effectGroup());
    const { effect } = skill.current;
    expect(effect.type === "status" && effect.status.id).toBe("skill-1");
    expect(skill.current.target).toBe("enemy");
  });

  it("re-aims the skill when its status changes kind, and only then", () => {
    const skill = edit();
    pick("Kind", "status", effectGroup());
    fireEvent.change(within(effectGroup()).getByLabelText("Shown as"), {
      target: { value: "Rot" },
    });
    expect(skill.current.target).toBe("enemy");
    pick("Status", "heal", effectGroup());
    const { effect } = skill.current;
    expect(effect.type === "status" && effect.status.effect).toBe("heal");
    expect(skill.current.target).toBe("ally");
  });

  it("keeps the target when another field of the effect changes", () => {
    const skill = edit({ ...blankSkill("skill-1"), target: "any" });
    pick("Damage type", "cold", effectGroup());
    const { effect } = skill.current;
    expect(effect.type === "damage" && effect.element).toBe("cold");
    expect(skill.current.target).toBe("any");
  });

  it("summons the creature of the enemy type picked", () => {
    const skill = edit();
    pick("Kind", "summon", effectGroup());
    pick("Creature (enemy type)", "type-goblin", effectGroup());
    const { effect } = skill.current;
    expect(effect.type === "summon" && effect.source).toEqual({
      archetypeId: "type-goblin",
    });
    expect(effect.type === "summon" && effect.creature.name).toBe("Goblin");
  });

  it("shows what stops the skill from being usable", () => {
    edit({ ...blankSkill("skill-1"), name: " " });
    expect(
      screen.getAllByRole("alert").map((alert) => alert.textContent),
    ).toContain("Give the skill a name.");
  });

  it("leaves an unknown effect alone", () => {
    edit({
      ...blankSkill("skill-1"),
      effect: { type: "mystery" } as unknown as Skill["effect"],
    });
    expect(screen.queryByRole("group", { name: "Effect" })).toBeNull();
    expect(screen.getByText(/effect \(mystery\) is unknown here/)).toBeTruthy();
  });
});
