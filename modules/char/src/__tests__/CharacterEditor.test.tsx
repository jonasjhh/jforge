// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import {
  blankArchetype,
  blankCharacter,
  starterLibrary,
  type Archetype,
  type Character,
  type Library,
} from "../../shared";
import { CharacterEditor } from "../CharacterEditor";
import { renderControlled } from "./controlled";

afterEach(cleanup);

const knight: Archetype = {
  ...blankArchetype("type-knight", "class"),
  name: "Knight",
  proficiencies: ["blade", "heavy"],
};
const library = (): Library => {
  // Only the starter's own pieces, not the gear of every melee class.
  const lib = starterLibrary();
  return {
    ...lib,
    gear: lib.gear.filter((g) => g.id.startsWith("gear-")),
    archetypes: [...lib.archetypes, knight],
  };
};
const edit = (character: Character, lib = library()) =>
  renderControlled(character, (value, onChange) => (
    <CharacterEditor library={lib} character={value} onChange={onChange} />
  ));
const options = (label: string) =>
  Array.from(
    (screen.getByLabelText(label) as HTMLSelectElement).options,
    (o) => o.textContent,
  );
const withGear = (stat: string) =>
  within(screen.getByRole("table", { name: "Stats" }))
    .getByRole("row", { name: new RegExp(`^${stat} `) })
    .querySelectorAll("td")[1]!;

describe("CharacterEditor", () => {
  it("renames the character and changes its type", () => {
    const character = edit(blankCharacter("unit-9", knight));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Sir Bors" },
    });
    fireEvent.change(screen.getByLabelText("Class or enemy type"), {
      target: { value: "type-goblin" },
    });
    expect(character.current).toMatchObject({
      name: "Sir Bors",
      archetypeId: "type-goblin",
    });
  });

  it("offers only the gear its class can use, plus anyone's accessories", () => {
    edit(blankCharacter("unit-9", knight));
    expect(options("Weapon")).toEqual(["None", "Iron Sword"]);
    expect(options("Armor")).toEqual(["None", "Chain Mail"]);
    expect(options("Accessory")).toEqual(["None", "Swift Ring"]);
  });

  it("keeps gear it can no longer use on the list, marked", () => {
    edit({ ...blankCharacter("unit-9", knight), gear: { weapon: "gear-bow" } });
    expect(options("Weapon")).toEqual([
      "None",
      "Iron Sword",
      "Short Bow (can't use)",
    ]);
  });

  it("equips and unequips gear, and shows what it adds", () => {
    const character = edit(blankCharacter("unit-9", knight));
    fireEvent.change(screen.getByLabelText("Weapon"), {
      target: { value: "gear-sword" },
    });
    expect(character.current.gear).toEqual({ weapon: "gear-sword" });
    expect(withGear("Attack").textContent).toBe("21");
    expect(withGear("Attack").className).toBe("good");
    expect(screen.getByText("Iron Sword", { selector: "strong" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Weapon"), {
      target: { value: "" },
    });
    expect(character.current.gear).toEqual({});
    expect(screen.getByText("Fists", { selector: "strong" })).toBeTruthy();
  });

  it("marks a stat that gear lowers", () => {
    edit({
      ...blankCharacter("unit-9", knight),
      gear: { armor: "gear-mail" },
    });
    expect(withGear("Speed").className).toBe("bad");
  });

  it("lists the skills of its type, or says there are none", () => {
    edit(blankCharacter("unit-9", knight));
    expect(screen.getByText(/Skills: none yet\./)).toBeTruthy();
    cleanup();
    const lib = library();
    const mage = { ...knight, skills: [lib.skills[0]!.id] };
    lib.archetypes = lib.archetypes.map((a) => (a.id === mage.id ? mage : a));
    edit(blankCharacter("unit-9", mage), lib);
    expect(
      screen.getByText(new RegExp(`Skills: ${lib.skills[0]!.name}\\.`)),
    ).toBeTruthy();
  });

  it("shows an enemy's threat, and no threat for a class", () => {
    const lib = library();
    const goblin = lib.archetypes.find((a) => a.id === "type-goblin")!;
    edit(blankCharacter("unit-9", goblin), lib);
    expect(screen.getByText(/^Threat/)).toBeTruthy();
    cleanup();
    edit(blankCharacter("unit-9", knight));
    expect(screen.queryByText(/^Threat/)).toBeNull();
  });

  it("shows no stats for a character whose type is gone", () => {
    edit({ ...blankCharacter("unit-9", knight), archetypeId: "type-gone" });
    expect(screen.queryByRole("table", { name: "Stats" })).toBeNull();
  });
});
