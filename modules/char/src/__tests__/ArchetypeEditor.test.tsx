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

const set = (label: string, value: string, within_ = document.body) =>
  fireEvent.change(within(within_).getByLabelText(label), {
    target: { value },
  });

describe("ArchetypeEditor", () => {
  it.each([
    ["Name", "Knight", { name: "Knight" }],
    ["Icon", "archer", { portrait: "archer" }],
    ["Preferred row", "2", { preferredRow: 2 }],
  ] as const)(
    "given a blank class, when %s is set to %s, then the class has it",
    (label, value, change) => {
      const type = edit();

      set(label, value);

      expect(type.current).toMatchObject(change);
    },
  );

  it("given a blank class, when its speed is set to 14, then only speed changes", () => {
    const type = edit();

    set("Speed", "14", group("Stats at level 1"));

    expect(type.current.baseStats.speed).toBe(14);
    expect(type.current.baseStats.maxHp).toBe(100);
  });

  it("given a blank class, when its weapon is renamed, then its unarmed attack has the name", () => {
    const type = edit();

    set("Weapon name", "Kick");

    expect(type.current.weapon.name).toBe("Kick");
  });

  it("given a class that knows Fireball, when Heal is added, then it knows both, in that order", () => {
    const type = edit();
    fireEvent.click(screen.getByRole("button", { name: "Add Fireball" }));

    fireEvent.click(screen.getByRole("button", { name: "Add Heal" }));

    expect(type.current.skills).toEqual([content.fireball.id, content.heal.id]);
  });

  it("given a class that knows Fireball and Heal, when Fireball is removed, then it knows only Heal", () => {
    const type = edit();
    fireEvent.click(screen.getByRole("button", { name: "Add Fireball" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Heal" }));

    fireEvent.click(screen.getByRole("button", { name: "Remove Fireball" }));

    expect(type.current.skills).toEqual([content.heal.id]);
  });

  it("given no skills designed, when a class is edited, then it says there are none to learn", () => {
    renderControlled(blankArchetype("type-1", "class"), (value, onChange) => (
      <ArchetypeEditor archetype={value} skills={[]} onChange={onChange} />
    ));

    const note = screen.getByText("No skills designed yet.");

    expect(note).toBeTruthy();
  });

  describe("gear it can use", () => {
    const gear = () => group("Gear it can use");
    const toggle = (label: string) =>
      fireEvent.click(within(gear()).getByLabelText(label));

    it("given a class that can use any gear, when it is edited, then no categories are offered", () => {
      edit();

      const bow = within(gear()).queryByLabelText("Bow");

      expect(bow).toBeNull();
    });

    it("given a class that can use any gear, when Any gear is unticked, then it is limited to every category", () => {
      const type = edit();

      toggle("Any gear");

      expect(type.current.proficiencies).toEqual(ALL_GEAR_CATEGORIES);
    });

    it("given a limited class, when Bow is unticked, then it can't use bows", () => {
      const type = edit();
      toggle("Any gear");

      toggle("Bow");

      expect(type.current.proficiencies).not.toContain("bow");
    });

    it("given a class that can't use bows, when Bow is ticked, then it can", () => {
      const type = edit();
      toggle("Any gear");
      toggle("Bow");

      toggle("Bow");

      expect(type.current.proficiencies).toContain("bow");
    });

    it("given a limited class, when Any gear is ticked, then the limit is lifted", () => {
      const type = edit();
      toggle("Any gear");

      toggle("Any gear");

      expect("proficiencies" in type.current).toBe(false);
    });
  });

  it("given an enemy type, when beast is ticked, then it has the trait", () => {
    const type = edit("enemy");
    const traits = group("Traits (default resistances)");

    fireEvent.click(within(traits).getByLabelText("beast"));

    expect(type.current.traits).toEqual(["beast"]);
  });

  it("given a beast, when beast is unticked, then it has no traits", () => {
    const type = edit("enemy");
    const traits = () => group("Traits (default resistances)");
    fireEvent.click(within(traits()).getByLabelText("beast"));

    fireEvent.click(within(traits()).getByLabelText("beast"));

    expect(type.current.traits).toEqual([]);
  });
});
