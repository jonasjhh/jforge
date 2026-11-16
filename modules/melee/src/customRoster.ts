import { EMPTY_ROSTER, readRoster, type Roster } from "../shared";

/** The roster the char module published on this device, if any. */
export function loadRoster(): Roster {
  try {
    return readRoster(localStorage);
  } catch {
    return EMPTY_ROSTER;
  }
}
