/**
 * The version of everything saved in the browser: char's library, the
 * roster it publishes to melee and jrpg's run. Each is saved with it, and
 * a save with any other version is ignored, as if there were none. Raise
 * it whenever a change makes old saves stale (a class gains a skill, a
 * format changes): saves are dropped, never migrated.
 */
export const SAVE_VERSION = 26;
