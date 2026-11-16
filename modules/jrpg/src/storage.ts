import {
  LIBRARY_STORAGE_KEY,
  parseLibrary,
  type Library,
} from "@jforge/char/shared";
import { RUN_STORAGE_KEY, parseRun, type Run } from "../shared";

/** The library designed in char on this device, if any. */
export function loadLibrary(): Library | null {
  try {
    return parseLibrary(localStorage.getItem(LIBRARY_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** The run in progress on this device, if any. */
export function loadRun(): Run | null {
  try {
    return parseRun(localStorage.getItem(RUN_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Saves the run, or forgets it (null). Ignored if the browser refuses. */
export function saveRun(run: Run | null): void {
  try {
    if (run) localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_STORAGE_KEY);
  } catch {
    // Playing on without a save is better than not playing.
  }
}
