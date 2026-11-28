import { VIEWS, type ContentView } from "@jforge/content";
import { TABS, type Tab } from "./tabs";

// What the codex remembers on this device: only where the reader was. The
// content itself is code (@jforge/content) and is never saved here.

const TAB_STORAGE_KEY = "jforge.char.tab";
const VIEW_STORAGE_KEY = "jforge.char.view";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Only a convenience.
  }
};

/** The tab open when the codex was last used, or Classes. */
export function loadTab(): Tab {
  const saved = read(TAB_STORAGE_KEY);
  return TABS.find((tab) => tab === saved) ?? "Classes";
}

/** Remembers the open tab; a browser that refuses just forgets it. */
export function saveTab(tab: Tab): void {
  write(TAB_STORAGE_KEY, tab);
}

/** The game whose content was shown last, or everything. */
export function loadView(): ContentView["id"] {
  const saved = read(VIEW_STORAGE_KEY);
  return VIEWS.find((view) => view.id === saved)?.id ?? "all";
}

/** Remembers the game shown; a browser that refuses just forgets it. */
export function saveView(id: ContentView["id"]): void {
  write(VIEW_STORAGE_KEY, id);
}
