/** The app's sections, in tab order. */
export const TABS = [
  "Roster",
  "Classes",
  "Paths",
  "Enemies",
  "Skills",
  "Gear",
] as const;
export type Tab = (typeof TABS)[number];
