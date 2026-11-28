import { describe, expect, it } from "vitest";
import { graphProblems, skillProblems } from "@jforge/rules/core";
import { VIEWS } from "..";
import { AUTOB_ARCHETYPES } from "../autob";
import { JRPG_ARCHETYPES } from "../jrpg";

describe.each(VIEWS.map((v) => [v.name, v] as const))(
  "the %s content",
  (_, view) => {
    const library = view.library();

    it("given its classes, when their paths are checked, then nothing is wrong", () => {
      const problems = graphProblems(library);

      expect(problems).toEqual([]);
    });

    it("given its skills, when each is checked, then nothing is wrong", () => {
      const problems = library.skills.flatMap((s) =>
        skillProblems(s, library).map((p) => `${s.name}: ${p}`),
      );

      expect(problems).toEqual([]);
    });

    it("given its archetypes, when their skills are looked up, then each exists", () => {
      const ids = new Set(library.skills.map((s) => s.id));

      const missing = library.archetypes.flatMap((a) =>
        a.skills.filter((id) => !ids.has(id)).map((id) => `${a.name}: ${id}`),
      );

      expect(missing).toEqual([]);
    });

    it("given its characters, when their archetypes are looked up, then each exists", () => {
      const ids = new Set(library.archetypes.map((a) => a.id));

      const orphans = library.characters.filter((c) => !ids.has(c.archetypeId));

      expect(orphans).toEqual([]);
    });
  },
);

describe.each([
  ["jrpg", JRPG_ARCHETYPES],
  ["autob", AUTOB_ARCHETYPES],
] as const)("the %s picks", (id, picks) => {
  it("given the picks, when the game's content is read, then it holds exactly those archetypes", () => {
    const view = VIEWS.find((v) => v.id === id)!;

    const ids = view.library().archetypes.map((a) => a.id);

    expect([...ids].sort()).toEqual([...picks].sort());
  });
});
