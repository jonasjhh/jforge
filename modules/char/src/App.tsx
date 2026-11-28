import { useMemo, useState } from "react";
import { VIEWS, type ContentView } from "@jforge/content";
import {
  archetypeOf,
  effectSummary,
  sourcesOf,
  type Archetype,
} from "@jforge/rules/core";
import { meta } from "../meta";
import { ArchetypeView } from "./ArchetypeView";
import { CharacterView } from "./CharacterView";
import { Collection } from "./Collection";
import { GearView } from "./GearView";
import { PathsView } from "./PathsView";
import { SkillView } from "./SkillView";
import { KINDS, count } from "./labels";
import { loadTab, loadView, saveTab, saveView } from "./storage";
import { TABS, type Tab } from "./tabs";

/**
 * Char, the codex: jforge's content, read-only, all of it or what one game
 * uses. Content is written in code (@jforge/content), not here.
 */
export function App() {
  const [viewId, setViewIdState] = useState<ContentView["id"]>(loadView);
  const [tab, setTabState] = useState<Tab>(loadTab);
  // The item open in each tab; switching tabs keeps it.
  const [selected, setSelected] = useState<Partial<Record<Tab, string>>>({});
  const view = VIEWS.find((v) => v.id === viewId) ?? VIEWS[0]!;
  const library = useMemo(() => view.library(), [view]);

  const setView = (next: ContentView["id"]) => {
    setViewIdState(next);
    saveView(next);
  };
  const setTab = (next: Tab) => {
    setTabState(next);
    saveTab(next);
  };
  const select = (inTab: Tab) => (id: string | null) =>
    setSelected((open) => ({ ...open, [inTab]: id ?? undefined }));
  /** Jumps to an item in another tab and opens it. */
  const open = (inTab: Tab, id: string) => {
    setTab(inTab);
    select(inTab)(id);
  };
  const openArchetype = (a: Archetype) => open(KINDS[a.kind].tab, a.id);
  const selection = (inTab: Tab) => ({
    title: inTab,
    selectedId: selected[inTab] ?? null,
    onSelect: select(inTab),
  });

  const archetypes = (kind: Archetype["kind"]) => (
    <Collection
      noun={KINDS[kind].noun}
      {...selection(KINDS[kind].tab)}
      items={library.archetypes.filter((a) => a.kind === kind)}
      note={(a) => {
        const from = sourcesOf(library, a).map((s) => s.name);
        return `${a.baseStats.maxHp} HP · ${count(a.skills.length, "skill")}${from.length > 0 ? ` · from ${from.join(", ")}` : ""}`;
      }}
    >
      {(archetype) => (
        <ArchetypeView
          archetype={archetype}
          library={library}
          onOpenSkill={(id) => open("Skills", id)}
          onOpenClass={(id) => open("Classes", id)}
          onOpenCharacter={(c) => open("Characters", c.id)}
        />
      )}
    </Collection>
  );

  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">{meta.description}</p>

      <div className="segmented" role="radiogroup" aria-label="Game">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={v.id === view.id}
            className={v.id === view.id ? "selected" : ""}
            onClick={() => setView(v.id)}
          >
            {v.name}
          </button>
        ))}
      </div>

      <div className="segmented" role="tablist" aria-label="Section">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === tab}
            className={name === tab ? "selected" : ""}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "Classes" && archetypes("class")}
      {tab === "Paths" && (
        <PathsView
          library={library}
          onOpenClass={(id) => open("Classes", id)}
        />
      )}
      {tab === "Enemies" && archetypes("enemy")}
      {tab === "Summons" && archetypes("summon")}
      {tab === "Characters" && (
        <Collection
          noun="character"
          {...selection("Characters")}
          items={library.characters}
          note={(c) => archetypeOf(library, c)?.name ?? "?"}
        >
          {(character) => (
            <CharacterView
              character={character}
              library={library}
              onOpenArchetype={openArchetype}
              onOpenGear={(id) => open("Gear", id)}
            />
          )}
        </Collection>
      )}
      {tab === "Skills" && (
        <Collection
          noun="skill"
          {...selection("Skills")}
          items={library.skills}
          note={effectSummary}
        >
          {(skill) => (
            <SkillView
              skill={skill}
              library={library}
              onOpenArchetype={openArchetype}
            />
          )}
        </Collection>
      )}
      {tab === "Gear" && (
        <Collection
          noun="gear"
          {...selection("Gear")}
          items={library.gear}
          note={(g) =>
            `${g.slot} · ${count(g.bonuses.length, "bonus", "bonuses")}`
          }
        >
          {(gear) => (
            <GearView
              gear={gear}
              library={library}
              onOpenArchetype={openArchetype}
              onOpenCharacter={(c) => open("Characters", c.id)}
            />
          )}
        </Collection>
      )}
    </main>
  );
}
