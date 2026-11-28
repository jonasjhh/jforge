/**
 * The version of jrpg's saved run. A save with any other version is
 * ignored, as if there were none. Raise it whenever a change makes old
 * runs stale (a class gains a skill, a format changes): saves are dropped,
 * never migrated. Each game has its own.
 */
export const SAVE_VERSION = 45;
