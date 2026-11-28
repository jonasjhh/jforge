import { sourcesOf, type Archetype, type Library } from "@jforge/rules/core";

/** The classes by how many steps they are from a base class. */
export interface PathColumns {
  /** Column n holds the classes n steps from a base class. */
  columns: Archetype[][];
  /** Base classes nothing leads on from, and that come from nothing. */
  apart: Archetype[];
}

/**
 * The class graph laid out by depth: a class sits one column after the
 * deepest class it comes from. Classes linked to nothing are set apart.
 */
export function pathColumns(library: Library): PathColumns {
  const classes = library.archetypes.filter((a) => a.kind === "class");
  const leadsOn = new Set(classes.flatMap((a) => a.comesFrom ?? []));
  const depth = new Map<string, number>();
  const depthOf = (a: Archetype): number => {
    const known = depth.get(a.id);
    if (known !== undefined) return known;
    depth.set(a.id, 0); // The graph has no loops; this only guards bad data.
    const d = Math.max(0, ...sourcesOf(library, a).map((s) => depthOf(s) + 1));
    depth.set(a.id, d);
    return d;
  };
  const columns: Archetype[][] = [];
  const apart: Archetype[] = [];
  for (const a of classes) {
    if (sourcesOf(library, a).length === 0 && !leadsOn.has(a.id)) {
      apart.push(a);
      continue;
    }
    const d = depthOf(a);
    (columns[d] ??= []).push(a);
  }
  return { columns: Array.from(columns, (c) => c ?? []), apart };
}
