/** The codex's sections, in tab order. */
export const TABS = [
  "Classes",
  "Paths",
  "Enemies",
  "Summons",
  "Characters",
  "Skills",
  "Gear",
] as const;
export type Tab = (typeof TABS)[number];
