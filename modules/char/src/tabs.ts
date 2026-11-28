/** The codex's sections, in tab order. */
export const TABS = [
  "Classes",
  "Paths",
  "Enemies",
  "Characters",
  "Skills",
  "Gear",
] as const;
export type Tab = (typeof TABS)[number];
