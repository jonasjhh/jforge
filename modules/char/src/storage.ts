import { writeRoster } from "@jforge/melee/shared";
import {
  LIBRARY_STORAGE_KEY,
  compileRoster,
  parseLibrary,
  starterLibrary,
  type Library,
} from "../shared";

/** The library saved on this device, or the starter one. */
export function loadLibrary(): Library {
  try {
    return (
      parseLibrary(localStorage.getItem(LIBRARY_STORAGE_KEY)) ??
      starterLibrary()
    );
  } catch {
    return starterLibrary();
  }
}

/**
 * Saves the library and publishes its characters to melee and jrpg, which
 * share this origin's storage. False if the browser refused either.
 */
export function saveLibrary(library: Library): boolean {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
    return writeRoster(localStorage, compileRoster(library));
  } catch {
    return false;
  }
}
