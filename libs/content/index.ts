import type { Library } from "@jforge/rules/core";
import { autobLibrary } from "./autob";
import { catalogue } from "./catalogue";
import { jrpgLibrary } from "./jrpg";

// @jforge/content: jforge's content as code. The catalogue holds all of it;
// each game's folder says what that game uses. Content is data: it imports
// only types and helpers from @jforge/rules (see README.md, Layout).

/** A view of the content: all of it, or what one game uses. */
export interface ContentView {
  id: "all" | "jrpg" | "autob";
  name: string;
  library: () => Library;
}

/** The views char's codex offers, the whole catalogue first. */
export const VIEWS: ContentView[] = [
  { id: "all", name: "Everything", library: catalogue },
  { id: "jrpg", name: "JRPG", library: jrpgLibrary },
  { id: "autob", name: "Autob", library: autobLibrary },
];
