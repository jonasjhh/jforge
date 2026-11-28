import { describe, expect, it } from "vitest";
import {
  blankArchetype,
  emptyLibrary,
  type Archetype,
  type Library,
} from "@jforge/rules/core";
import { pathColumns } from "../paths";

const type = (
  id: string,
  comesFrom?: string[],
  kind: Archetype["kind"] = "class",
): Archetype => ({
  ...blankArchetype(id, kind),
  ...(comesFrom ? { comesFrom } : {}),
});
const library = (...archetypes: Archetype[]): Library => ({
  ...emptyLibrary(),
  archetypes,
});
const ids = (list: Archetype[]) => list.map((a) => a.id);

describe("pathColumns", () => {
  it("given a base, a step and a step after it, when laid out, then each is a column further", () => {
    const lib = library(type("a"), type("b", ["a"]), type("c", ["b"]));

    const { columns } = pathColumns(lib);

    expect(columns.map(ids)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("given a class from a base and from a step, when laid out, then it sits after the deeper one", () => {
    const lib = library(type("a"), type("b", ["a"]), type("c", ["a", "b"]));

    const { columns } = pathColumns(lib);

    expect(columns.map(ids)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("given a class linked to nothing and an enemy, when laid out, then the class is set apart and the enemy left out", () => {
    const lib = library(
      type("a"),
      type("b", ["a"]),
      type("lone"),
      type("goblin", undefined, "enemy"),
    );

    const { columns, apart } = pathColumns(lib);

    expect(columns.flat().map((a) => a.id)).toEqual(["a", "b"]);
    expect(ids(apart)).toEqual(["lone"]);
  });

  it("given two classes that lead to each other, when laid out, then it still ends", () => {
    const lib = library(type("a", ["b"]), type("b", ["a"]));

    const { columns } = pathColumns(lib);

    expect(columns.flat()).toHaveLength(2);
  });
});
