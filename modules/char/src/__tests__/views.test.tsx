// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { catalogue } from "@jforge/content/catalogue";
import { characterStats } from "@jforge/rules/core";
import { ArchetypeView } from "../ArchetypeView";
import { CharacterView } from "../CharacterView";
import { GearView } from "../GearView";
import { SkillView } from "../SkillView";

afterEach(cleanup);

const library = catalogue();

describe("CharacterView", () => {
  it("given a character in gear, when it shows, then its stats with gear show beside its base", () => {
    const character = library.characters.find((c) => c.gear.weapon)!;
    const stats = characterStats(library, character)!;

    render(
      <CharacterView
        character={character}
        library={library}
        onOpenArchetype={vi.fn()}
        onOpenGear={vi.fn()}
      />,
    );

    const attack = within(
      screen.getByRole("table", { name: "Stats" }),
    ).getByRole("row", { name: /Attack/ });
    expect(attack.textContent).toContain(String(stats.base.attack));
    expect(attack.textContent).toContain(String(stats.total.attack));
  });

  it("given a character whose archetype is gone, when it shows, then it says so", () => {
    const orphan = { ...library.characters[0]!, archetypeId: "nobody" };

    render(
      <CharacterView
        character={orphan}
        library={library}
        onOpenArchetype={vi.fn()}
        onOpenGear={vi.fn()}
      />,
    );

    expect(screen.getByText(/is gone/)).toBeTruthy();
  });
});

describe("SkillView", () => {
  it("given a skill a class has, when its holder is pressed, then that class is opened", () => {
    const holder = library.archetypes.find((a) => a.skills.length > 0)!;
    const skill = library.skills.find((s) => s.id === holder.skills[0])!;
    const onOpenArchetype = vi.fn();
    render(
      <SkillView
        skill={skill}
        library={library}
        onOpenArchetype={onOpenArchetype}
      />,
    );

    const known = screen.getByRole("list", { name: "Known by" });
    fireEvent.click(within(known).getAllByRole("button")[0]!);

    expect(onOpenArchetype).toHaveBeenCalledOnce();
    expect(
      library.archetypes
        .filter((a) => a.skills.includes(skill.id))
        .map((a) => a.id),
    ).toContain(onOpenArchetype.mock.calls[0]![0].id);
  });
});

describe("GearView", () => {
  it("given a sword, when it shows, then its bonuses and the classes that can use it show", () => {
    const sword = library.gear.find((g) => g.weapon)!;

    render(
      <GearView
        gear={sword}
        library={library}
        onOpenArchetype={vi.fn()}
        onOpenCharacter={vi.fn()}
      />,
    );

    expect(screen.getByText("Gives:")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Usable by" })).toBeTruthy();
  });
});

describe("summons", () => {
  const imp = library.archetypes.find(
    (a) => a.kind === "summon" && a.name === "Imp",
  )!;
  const summonImp = library.skills.find(
    (s) =>
      s.effect.type === "summon" && s.effect.source?.archetypeId === imp.id,
  )!;

  it("given the Imp summon, when it shows, then it is a summon and the skill that puts it in can be opened", () => {
    const onOpenSkill = vi.fn();

    render(
      <ArchetypeView
        archetype={imp}
        library={library}
        onOpenSkill={onOpenSkill}
        onOpenClass={vi.fn()}
        onOpenCharacter={vi.fn()}
      />,
    );
    fireEvent.click(
      within(screen.getByRole("list", { name: "Summoned by" })).getByRole(
        "button",
        { name: `Open ${summonImp.name}` },
      ),
    );

    expect(screen.getByText(/^Summon ·/)).toBeTruthy();
    expect(onOpenSkill).toHaveBeenCalledWith(summonImp.id);
  });

  it("given a skill that summons, when what it puts in is pressed, then that summon is opened", () => {
    const onOpenArchetype = vi.fn();
    render(
      <SkillView
        skill={summonImp}
        library={library}
        onOpenArchetype={onOpenArchetype}
      />,
    );

    fireEvent.click(
      within(screen.getByRole("list", { name: "Puts in" })).getByRole(
        "button",
        { name: `Open ${imp.name}` },
      ),
    );

    expect(onOpenArchetype).toHaveBeenCalledWith(imp);
  });
});
