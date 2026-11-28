import { describe, expect, it } from "vitest";
import { emptyLibrary } from "@jforge/rules/core";
import {
  WORLD_ENEMIES,
  WORLD_ENEMY_IDS,
  WORLD_GEAR,
  WORLD_SKILLS,
  catalogue,
  withWorldContent,
} from "..";

describe("withWorldContent", () => {
  it("given an empty library, when the world is added, then it has the world's enemies, a character of each, its gear and skills", () => {
    const library = withWorldContent(emptyLibrary());

    expect(library.archetypes).toEqual(WORLD_ENEMIES);
    expect(library.characters.map((c) => c.archetypeId)).toEqual(
      WORLD_ENEMY_IDS,
    );
    expect(library.gear).toEqual(WORLD_GEAR);
    expect(library.skills.map((s) => s.id)).toEqual(
      WORLD_SKILLS.map((s) => s.id),
    );
  });

  it("given a library that has one of the world's skills, when the world is added, then that skill is not added again", () => {
    const own = { ...WORLD_SKILLS[0]!, name: "Own" };

    const library = withWorldContent({ ...emptyLibrary(), skills: [own] });

    const ids = library.skills.map((s) => s.id);
    expect(ids.filter((id) => id === own.id)).toHaveLength(1);
    expect(library.skills[0]).toBe(own);
  });

  it("given the catalogue, when its enemy types are listed, then the world's are last", () => {
    const ids = catalogue().archetypes.map((a) => a.id);

    const last = ids.slice(-WORLD_ENEMY_IDS.length);

    expect(last).toEqual(WORLD_ENEMY_IDS);
  });
});
