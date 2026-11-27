import { describe, expect, it } from "vitest";
import {
  isBaseClass,
  linkProblem,
  nextClasses,
  possibleSources,
  sourcesOf,
  withSource,
  withoutLinks,
  withoutSource,
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

describe("possibleSources", () => {
  it("given fighter, when its possible sources are read, then classes after it are left out so no loop forms", () => {
    const lib = graph();

    const options = possibleSources(lib, get(lib, "fighter"));

    expect(ids(options)).toEqual(["mage"]);
  });

  it("given spellblade, when its possible sources are read, then every class but itself and its source is offered", () => {
    const lib = graph();

    const options = possibleSources(lib, get(lib, "spellblade"));

    expect(ids(options)).toEqual(["fighter", "mage"]);
  });

  it("given an enemy type, when its possible sources are read, then there are none", () => {
    const lib = graph();

    const options = possibleSources(lib, get(lib, "goblin"));

    expect(options).toEqual([]);
  });
});

describe("withSource", () => {
  it("given a base class, when a source is added, then it comes from it", () => {
    const lib = graph();

    const mage = withSource(lib, get(lib, "mage"), "fighter");

    expect(mage.comesFrom).toEqual(["fighter"]);
  });

  it("given fighter, when spellblade is added as its source, then nothing changes because it would loop", () => {
    const lib = graph();
    const fighter = get(lib, "fighter");

    const after = withSource(lib, fighter, "spellblade");

    expect(after).toBe(fighter);
  });
});

describe("withoutSource", () => {
  it("given a class from two classes, when one is removed, then it comes from the other", () => {
    const lib = graph();

    const after = withoutSource(get(lib, "battle-mage"), "fighter");

    expect(after.comesFrom).toEqual(["mage"]);
  });

  it("given a class from one class, when it is removed, then it is a base class with no list", () => {
    const lib = graph();

    const after = withoutSource(get(lib, "spellblade"), "battle-mage");

    expect("comesFrom" in after).toBe(false);
  });
});

describe("linkProblem", () => {
  it("given mage and spellblade, when mage is to lead to spellblade, then nothing stands in the way", () => {
    const lib = graph();

    const problem = linkProblem(lib, "mage", "spellblade");

    expect(problem).toBeNull();
  });

  it.each([
    ["fighter", "fighter", "A class can't lead to itself."],
    ["fighter", "goblin", "Only classes can be linked."],
    ["fighter", "battle-mage", "already leads to"],
    ["spellblade", "fighter", "so this would make a loop"],
  ])(
    "given %s to %s, when the link is checked, then it says why not",
    (source, target, expected) => {
      const lib = graph();

      const problem = linkProblem(lib, source, target);

      expect(problem).toContain(expected);
    },
  );
});

describe("withoutLinks", () => {
  it("given battle mage in the middle of a path, when its links are removed, then it comes from nothing and leads to nothing", () => {
    const lib = graph();

    const next = withoutLinks(lib, "battle-mage");

    expect("comesFrom" in get(next, "battle-mage")).toBe(false);
    expect("comesFrom" in get(next, "spellblade")).toBe(false);
    expect(get(next, "fighter")).toBe(get(lib, "fighter"));
  });
});
