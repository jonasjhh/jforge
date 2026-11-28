import { RUN_STORAGE_KEY, parseRun, type Run } from "../shared";

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
