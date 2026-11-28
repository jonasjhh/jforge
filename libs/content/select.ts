import type { Library } from "@jforge/rules/core";

/**
 * What a game uses of `library`: the archetypes named, in `library`'s
 * order, and the characters of them. Skills and gear are all kept; a game
 * only meets those its archetypes and characters use.
 */
export function select(library: Library, archetypeIds: string[]): Library {
  const kept = new Set(archetypeIds);
  return {
    ...library,
    archetypes: library.archetypes.filter((a) => kept.has(a.id)),
    characters: library.characters.filter((c) => kept.has(c.archetypeId)),
  };
}
