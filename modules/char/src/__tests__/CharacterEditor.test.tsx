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

const set = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("CharacterEditor", () => {
  it("given a knight, when it is renamed, then it has the new name", () => {
    const character = edit(blankCharacter("unit-9", knight));

    set("Name", "Sir Bors");

    expect(character.current.name).toBe("Sir Bors");
  });

  it("given a knight, when its type becomes goblin, then it is a goblin", () => {
    const character = edit(blankCharacter("unit-9", knight));

    set("Class or enemy type", "type-goblin");

    expect(character.current.archetypeId).toBe("type-goblin");
  });

  it.each([
    ["Weapon", ["None", "Iron Sword"]],
    ["Armor", ["None", "Chain Mail"]],
    ["Accessory", ["None", "Swift Ring"]],
  ])(
    "given a knight of blades and heavy armor, when its %s options show, then only gear it can use is offered, plus any accessory",
    (slot, offered) => {
      edit(blankCharacter("unit-9", knight));

      const shown = options(slot);

      expect(shown).toEqual(offered);
    },
  );

  it("given a knight holding a bow, when its weapon options show, then the bow is kept on the list, marked", () => {
    edit({ ...blankCharacter("unit-9", knight), gear: { weapon: "gear-bow" } });

    const shown = options("Weapon");

    expect(shown).toEqual(["None", "Iron Sword", "Short Bow (can't use)"]);
  });

  it("given an unarmed knight, when the sword is equipped, then it is worn and its attack bonus is shown", () => {
    const character = edit(blankCharacter("unit-9", knight));

    set("Weapon", "gear-sword");

    expect(character.current.gear).toEqual({ weapon: "gear-sword" });
    expect(withGear("Attack").textContent).toBe("21");
    expect(withGear("Attack").className).toBe("good");
    expect(screen.getByText("Iron Sword", { selector: "strong" })).toBeTruthy();
  });

  it("given a knight with a sword, when the weapon is taken off, then it fights with fists", () => {
    const character = edit(blankCharacter("unit-9", knight));
    set("Weapon", "gear-sword");

    set("Weapon", "");

    expect(character.current.gear).toEqual({});
    expect(screen.getByText("Fists", { selector: "strong" })).toBeTruthy();
  });

  it("given a knight in chain mail, when its stats show, then the speed the mail lowers is marked", () => {
    edit({ ...blankCharacter("unit-9", knight), gear: { armor: "gear-mail" } });

    const speed = withGear("Speed");

    expect(speed.className).toBe("bad");
  });

  it("given a class with no skills, when its character is edited, then it says there are none yet", () => {
    edit(blankCharacter("unit-9", knight));

    const note = screen.getByText(/Skills: none yet\./);

    expect(note).toBeTruthy();
  });

  it("given a class with a skill, when its character is edited, then the skill is listed", () => {
    const lib = library();
    const mage = { ...knight, skills: [lib.skills[0]!.id] };
    lib.archetypes = lib.archetypes.map((a) => (a.id === mage.id ? mage : a));

    edit(blankCharacter("unit-9", mage), lib);

    expect(
      screen.getByText(new RegExp(`Skills: ${lib.skills[0]!.name}\\.`)),
    ).toBeTruthy();
  });

  it("given an enemy, when it is edited, then its threat is shown", () => {
    const lib = library();
    const goblin = lib.archetypes.find((a) => a.id === "type-goblin")!;

    edit(blankCharacter("unit-9", goblin), lib);

    expect(screen.getByText(/^Threat/)).toBeTruthy();
  });

  it("given a class character, when it is edited, then no threat is shown", () => {
    edit(blankCharacter("unit-9", knight));

    const threat = screen.queryByText(/^Threat/);

    expect(threat).toBeNull();
  });

  it("given a character whose type is gone, when it is edited, then no stats are shown", () => {
    edit({ ...blankCharacter("unit-9", knight), archetypeId: "type-gone" });

    const stats = screen.queryByRole("table", { name: "Stats" });

    expect(stats).toBeNull();
  });
});
