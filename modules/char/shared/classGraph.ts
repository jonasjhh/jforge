import type { Archetype, Library } from "./types";

// The class graph: which class can be reached from which. A class lists
// the classes it comes from, and any one of them is enough. Links carry no
// levels, costs or conditions: char knows no progression, and a game that
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
 * The classes `archetype` could come from: every other class it doesn't
 * come from yet whose link would not make a loop.
 */
export function possibleSources(
  library: Library,
  archetype: Archetype,
): Archetype[] {
  if (archetype.kind !== "class") return [];
  return classes(library).filter(
    (a) =>
      a.id !== archetype.id &&
      !archetype.comesFrom?.includes(a.id) &&
      !reaches(library, archetype.id, a.id),
  );
}

/** `archetype` coming from `sourceId` too, unless that would make a loop. */
export function withSource(
  library: Library,
  archetype: Archetype,
  sourceId: string,
): Archetype {
  const allowed = possibleSources(library, archetype).some(
    (a) => a.id === sourceId,
  );
  return allowed
    ? { ...archetype, comesFrom: [...(archetype.comesFrom ?? []), sourceId] }
    : archetype;
}

/** `archetype` no longer coming from `sourceId`; a base class if none left. */
export function withoutSource(
  archetype: Archetype,
  sourceId: string,
): Archetype {
  const next = { ...archetype };
  const left = (archetype.comesFrom ?? []).filter((id) => id !== sourceId);
  if (left.length > 0) next.comesFrom = left;
  else delete next.comesFrom;
  return next;
}

/** Why `targetId` can't come from `sourceId`, or null if it can. */
export function linkProblem(
  library: Library,
  sourceId: string,
  targetId: string,
): string | null {
  const all = classes(library);
  const source = all.find((a) => a.id === sourceId);
  const target = all.find((a) => a.id === targetId);
  if (!source || !target) return "Only classes can be linked.";
  if (sourceId === targetId) return "A class can't lead to itself.";
  const name = (a: Archetype) => a.name || "(unnamed)";
  if (target.comesFrom?.includes(sourceId))
    return `${name(source)} already leads to ${name(target)}.`;
  if (reaches(library, targetId, sourceId))
    return `${name(target)} already leads to ${name(source)}, so this would make a loop.`;
  return null;
}

/** The library with every link to and from the class `id` removed. */
export function withoutLinks(library: Library, id: string): Library {
  const unlinked = (a: Archetype): Archetype => {
    if (a.id !== id)
      return a.comesFrom?.includes(id) ? withoutSource(a, id) : a;
    const next = { ...a };
    delete next.comesFrom;
    return next;
  };
  return { ...library, archetypes: library.archetypes.map(unlinked) };
}
