import type { Archetype, Library } from "./types";

// The class graph: which class can be reached from which. A class lists
// the classes it comes from, and any one of them is enough. Links carry no
// levels, costs or conditions: the content knows no progression, and a game that
// uses the graph (jrpg2) decides when and how a link may be taken. Links go
// forward only, so the graph never loops; it can be any depth. Enemy types
// take no part.

const classes = (library: Library) =>
  library.archetypes.filter((a) => a.kind === "class");

/** The classes `archetype` comes from that exist, in its order. */
export function sourcesOf(library: Library, archetype: Archetype): Archetype[] {
  const all = classes(library);
  return (archetype.comesFrom ?? []).flatMap((id) => {
    const source = all.find((a) => a.id === id);
    return source ? [source] : [];
  });
}

/** The classes that can be reached from the class `id`. */
export function nextClasses(library: Library, id: string): Archetype[] {
  return classes(library).filter((a) => a.comesFrom?.includes(id));
}

/** Whether a class comes from no other: where a path starts. */
export function isBaseClass(library: Library, archetype: Archetype): boolean {
  return (
    archetype.kind === "class" && sourcesOf(library, archetype).length === 0
  );
}

/** Whether the class `to` can be reached from `from`, along any path. */
function reaches(library: Library, from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...nextClasses(library, id).map((a) => a.id));
  }
  return false;
}

/**
 * What is wrong with the graph, in words; empty when it is sound. A link
 * must name another class that exists, and links must never loop.
 */
export function graphProblems(library: Library): string[] {
  const all = classes(library);
  const ids = new Set(all.map((a) => a.id));
  const problems: string[] = [];
  for (const archetype of library.archetypes) {
    for (const id of archetype.comesFrom ?? []) {
      if (archetype.kind !== "class") {
        problems.push(`${archetype.name} is not a class but comes from ${id}.`);
      } else if (id === archetype.id) {
        problems.push(`${archetype.name} comes from itself.`);
      } else if (!ids.has(id)) {
        problems.push(`${archetype.name} comes from ${id}, which is no class.`);
      } else if (reaches(library, archetype.id, id)) {
        problems.push(`${archetype.name} and ${id} lead to each other.`);
      }
    }
  }
  return problems;
}
