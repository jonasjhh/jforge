// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { content } from "@jforge/melee/shared";
import { ALL_GEAR_CATEGORIES, blankArchetype } from "../../shared";
import { ArchetypeEditor } from "../ArchetypeEditor";
import { renderControlled } from "./controlled";

afterEach(cleanup);

const skills = [content.fireball, content.heal];
const edit = (kind: "class" | "enemy" = "class") =>
  renderControlled(blankArchetype("type-1", kind), (value, onChange) => (
    <ArchetypeEditor archetype={value} skills={skills} onChange={onChange} />
  ));
const group = (name: string) => screen.getByRole("group", { name });

describe("ArchetypeEditor", () => {
  it("edits the name, icon, row and stats", () => {
    const type = edit();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Knight" },
    });
    fireEvent.change(screen.getByLabelText("Icon"), {
      target: { value: "archer" },
    });
    fireEvent.change(screen.getByLabelText("Preferred row"), {
      target: { value: "2" },
    });
    fireEvent.change(
      within(group("Stats at level 1")).getByLabelText("Speed"),
      { target: { value: "14" } },
    );
    expect(type.current).toMatchObject({
      name: "Knight",
      portrait: "archer",
      preferredRow: 2,
    });
    expect(type.current.baseStats.speed).toBe(14);
    expect(type.current.baseStats.maxHp).toBe(100);
  });

  it("edits its unarmed attack", () => {
    const type = edit();
    fireEvent.change(screen.getByLabelText("Weapon name"), {
      target: { value: "Kick" },
    });
    expect(type.current.weapon.name).toBe("Kick");
  });

  it("learns and forgets skills", () => {
    const type = edit();
    fireEvent.click(within(group("Skills")).getByLabelText("Fireball"));
    fireEvent.click(within(group("Skills")).getByLabelText("Heal"));
    expect(type.current.skills).toEqual([content.fireball.id, content.heal.id]);
    fireEvent.click(within(group("Skills")).getByLabelText("Fireball"));
    expect(type.current.skills).toEqual([content.heal.id]);
  });

  it("says when there are no skills to learn", () => {
    renderControlled(blankArchetype("type-1", "class"), (value, onChange) => (
      <ArchetypeEditor archetype={value} skills={[]} onChange={onChange} />
    ));
    expect(screen.getByText("No skills designed yet.")).toBeTruthy();
  });

  it("limits the gear it can use, and lifts the limit again", () => {
    const type = edit();
    const gear = () => group("Gear it can use");
    expect(within(gear()).queryByLabelText("Bow")).toBeNull();
    fireEvent.click(within(gear()).getByLabelText("Any gear"));
    expect(type.current.proficiencies).toEqual(ALL_GEAR_CATEGORIES);
    fireEvent.click(within(gear()).getByLabelText("Bow"));
    expect(type.current.proficiencies).not.toContain("bow");
    fireEvent.click(within(gear()).getByLabelText("Bow"));
    expect(type.current.proficiencies).toContain("bow");
    fireEvent.click(within(gear()).getByLabelText("Any gear"));
    expect("proficiencies" in type.current).toBe(false);
  });

  it("adds and removes traits", () => {
    const type = edit("enemy");
    const traits = () => group("Traits (default resistances)");
    fireEvent.click(within(traits()).getByLabelText("beast"));
    expect(type.current.traits).toEqual(["beast"]);
    fireEvent.click(within(traits()).getByLabelText("beast"));
    expect(type.current.traits).toEqual([]);
  });
});
