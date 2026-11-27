import type { Game, Library } from "./types";

// Which designs each game reads. A class or enemy type reaches a game only
// if it lists that game, so a design in progress (jrpg2's classes, say)
// stays in char. Each game reads its library through forGame; skills and
// gear stay, since only what an included design uses matters.

/**
 * `library` as the game `game` sees it: only the classes and enemy types
 * that list it, and only the characters of those.
 */
export function forGame(library: Library, game: Game): Library {
  const archetypes = library.archetypes.filter((a) => a.games.includes(game));
  const kept = new Set(archetypes.map((a) => a.id));
  return {
    ...library,
    archetypes,
    characters: library.characters.filter((c) => kept.has(c.archetypeId)),
  };
}
