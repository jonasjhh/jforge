/** The app's sections, in tab order. */
export const TABS = ["Roster", "Classes", "Enemies", "Skills", "Gear"] as const;
export type Tab = (typeof TABS)[number];
