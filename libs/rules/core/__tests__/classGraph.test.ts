import { describe, expect, it } from "vitest";
import {
  graphProblems,
  isBaseClass,
  nextClasses,
  sourcesOf,
} from "../classGraph";
import { blankArchetype, emptyLibrary } from "../library";
import type { Archetype, Library } from "../types";

const type = (
  id: string,
  comesFrom?: string[],
  kind: Archetype["kind"] = "class",
): Archetype => ({
  ...blankArchetype(id, kind),
  ...(comesFrom ? { comesFrom } : {}),
});

/** Fighter and Mage at the base; Battle Mage from either; Spellblade after it. */
const graph = (): Library => ({
  ...emptyLibrary(),
  archetypes: [
    type("fighter"),
    type("mage"),
    type("battle-mage", ["fighter", "mage"]),
    type("spellblade", ["battle-mage"]),
    type("goblin", undefined, "enemy"),
  ],
});
const get = (lib: Library, id: string) =>
  lib.archetypes.find((a) => a.id === id)!;
const ids = (types: Archetype[]) => types.map((a) => a.id);

describe("sourcesOf", () => {
  it("given a class from two classes, when its sources are read, then both come back in its order", () => {
    const lib = graph();

    const sources = sourcesOf(lib, get(lib, "battle-mage"));

    expect(ids(sources)).toEqual(["fighter", "mage"]);
  });

  it("given a link to a class that is gone or an enemy type, when the sources are read, then it is left out", () => {
    const lib = graph();

    const sources = sourcesOf(lib, type("odd", ["gone", "goblin", "mage"]));

    expect(ids(sources)).toEqual(["mage"]);
  });
});

describe("nextClasses", () => {
  it("given fighter, when the classes after it are read, then only battle mage comes back", () => {
    const lib = graph();

    const next = nextClasses(lib, "fighter");

    expect(ids(next)).toEqual(["battle-mage"]);
  });
});

describe("isBaseClass", () => {
  it.each([
    ["fighter", true],
    ["battle-mage", false],
    ["goblin", false],
  ])("given %s, when asked if it is a base class, then %s", (id, base) => {
    const lib = graph();

    const result = isBaseClass(lib, get(lib, id));

    expect(result).toBe(base);
  });
});

describe("graphProblems", () => {
  it("given a sound graph, when it is checked, then there are no problems", () => {
    const lib = graph();

    const problems = graphProblems(lib);

    expect(problems).toEqual([]);
  });

  it.each([
    [
      "a class that comes from itself",
      type("fighter", ["fighter"]),
      "comes from itself",
    ],
    [
      "an enemy that comes from a class",
      type("goblin", ["fighter"], "enemy"),
      "is not a class",
    ],
    [
      "a class from an unknown id",
      type("fighter", ["nobody"]),
      "which is no class",
    ],
    ["a loop", type("fighter", ["spellblade"]), "lead to each other"],
  ])(
    "given %s, when the graph is checked, then it says what is wrong",
    (_, changed, expected) => {
      const lib = graph();
      const broken = {
        ...lib,
        archetypes: lib.archetypes.map((a) =>
          a.id === changed.id ? changed : a,
        ),
      };

      const problems = graphProblems(broken);

      expect(problems.join(" ")).toContain(expected);
    },
  );
});
