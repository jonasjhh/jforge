import { describe, expect, it } from "vitest";
import { nextClasses } from "@jforge/rules/core";
import { parseLibrary } from "@jforge/rules/core";
import { catalogue as starterLibrary } from "..";

const names = (ids: { name: string }[]) => ids.map((a) => a.name).sort();

describe("starterLibrary's class graph", () => {
  it.each([
    ["class-squire", ["Fighter", "Spearman", "Warrior"]],
    ["class-scout", ["Archer", "Duelist", "Hunter", "Thief"]],
    ["class-apprentice", ["Enchanter", "Healer", "Mage", "Summoner"]],
  ])(
    "given the starter library, when %s's next classes are asked, then they are %j",
    (base, expected) => {
      const library = starterLibrary();

      const next = nextClasses(library, base);

      expect(names(next)).toEqual(expected);
    },
  );

  it("given the starter library, when its second-level classes are read, then none has skills", () => {
    const library = starterLibrary();

    const second = library.archetypes.filter((a) =>
      (a.comesFrom ?? []).some((id) => id.startsWith("class-")),
    );

    expect(second).toHaveLength(11);
    expect(second.every((a) => a.skills.length === 0)).toBe(true);
  });

  it("given the starter library, when it is saved and read back, then it parses", () => {
    const library = starterLibrary();

    const parsed = parseLibrary(JSON.stringify(library));

    expect(parsed).toEqual(library);
  });
});
