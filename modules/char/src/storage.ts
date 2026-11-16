import { writeRoster } from "@jforge/melee/shared";
import {
  LIBRARY_STORAGE_KEY,
  compileRoster,
  parseLibrary,
  starterLibrary,
  withMeleeClasses,
  type Library,
} from "../shared";

/**
 * The library saved on this device, or the starter one. A library saved
 * before melee's classes came to char gets them now.
 */
export function loadLibrary(): Library {
  try {
    const saved = parseLibrary(localStorage.getItem(LIBRARY_STORAGE_KEY));
    return saved ? withMeleeClasses(saved) : starterLibrary();
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
