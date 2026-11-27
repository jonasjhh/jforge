import { useState } from "react";
import { meta } from "../meta";
import {
  archetypeOf,
  blankArchetype,
  blankCharacter,
  blankGear,
  blankSkill,
  compileRoster,
  effectSummary,
  nextId,
  remove,
  sourcesOf,
  upsert,
  type Archetype,
  type Collection as CollectionName,
  type Library,
} from "../shared";
import { ArchetypeEditor } from "./ArchetypeEditor";
import { CharacterEditor } from "./CharacterEditor";
import { Collection } from "./Collection";
import { GearEditor } from "./GearEditor";
import { SkillEditor } from "./SkillEditor";
import { Transfer } from "./Transfer";
import { loadTab, saveTab } from "./storage";
import { TABS, type Tab } from "./tabs";
import { useLibrary } from "./useLibrary";

const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function App() {
  const { library, update, saved } = useLibrary();
  const [tab, setTabState] = useState<Tab>(loadTab);
  // The item open in each tab; switching tabs keeps it.
  const [selected, setSelected] = useState<Partial<Record<Tab, string>>>({});
  const roster = compileRoster(library);

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
  const selection = (inTab: Tab) => ({
    title: inTab,
    selectedId: selected[inTab] ?? null,
    onSelect: select(inTab),
  });

  /** Adds a new item to a list and returns its id, for the list to select. */
  const add = <K extends CollectionName>(
    collection: K,
    make: (id: string) => Library[K][number],
  ) => {
    const id = nextId(library, collection);
    update((lib) => upsert(lib, collection, make(id)));
    return id;
  };
  const save =
    <K extends CollectionName>(collection: K) =>
    (item: Library[K][number]) =>
      update((lib) => upsert(lib, collection, item));
  const drop = (collection: CollectionName) => (id: string) =>
    update((lib) => remove(lib, collection, id));

  const archetypes = (kind: Archetype["kind"]) => (
    <Collection
      noun={kind === "class" ? "class" : "enemy type"}
      {...selection(kind === "class" ? "Classes" : "Enemies")}
      items={library.archetypes.filter((a) => a.kind === kind)}
      note={(a) => {
        const from = sourcesOf(library, a).map((s) => s.name);
        return `${a.baseStats.maxHp} HP · ${count(a.skills.length, "skill")}${from.length > 0 ? ` · from ${from.join(", ")}` : ""}`;
      }}
      onNew={() => add("archetypes", (id) => blankArchetype(id, kind))}
      onDelete={drop("archetypes")}
    >
      {(archetype) => (
        <ArchetypeEditor
          archetype={archetype}
          library={library}
          onChange={save("archetypes")}
          onOpenSkill={(id) => open("Skills", id)}
          onOpenClass={(id) => open("Classes", id)}
        />
      )}
    </Collection>
  );

  const firstArchetype = library.archetypes[0];
  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">{meta.description}</p>

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

      {tab === "Roster" && (
        <Collection
          noun="character"
          {...selection("Roster")}
          items={library.characters}
          note={(c) => {
            const archetype = archetypeOf(library, c);
            return archetype?.name ?? "?";
          }}
          onNew={
            firstArchetype &&
            (() =>
              add("characters", (id) => blankCharacter(id, firstArchetype)))
          }
          onDelete={drop("characters")}
        >
          {(character) => (
            <CharacterEditor
              library={library}
              character={character}
              onChange={save("characters")}
              onOpenArchetype={(archetype) =>
                open(
                  archetype.kind === "class" ? "Classes" : "Enemies",
                  archetype.id,
                )
              }
            />
          )}
        </Collection>
      )}
      {tab === "Classes" && archetypes("class")}
      {tab === "Enemies" && archetypes("enemy")}
      {tab === "Skills" && (
        <Collection
          noun="skill"
          {...selection("Skills")}
          items={library.skills}
          note={effectSummary}
          onNew={() => add("skills", blankSkill)}
          onDelete={drop("skills")}
        >
          {(skill) => (
            <SkillEditor
              skill={skill}
              library={library}
              onChange={save("skills")}
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
          onNew={() => add("gear", blankGear)}
          onDelete={drop("gear")}
        >
          {(gear) => <GearEditor gear={gear} onChange={save("gear")} />}
        </Collection>
      )}

      <section className="panel">
        <h2>In melee, jrpg and autob</h2>
        <p role="status">
          {saved ? (
            <>
              Published: <strong>{roster.party.length}</strong> party members
              and <strong>{roster.monsters.length}</strong> enemies. Characters
              of a class join the party; characters of an enemy type join the
              monster pool. Autob's shop sells your classes.
            </>
          ) : (
            <span className="bad">
              Could not save on this device; changes will be lost.
            </span>
          )}
        </p>
        <div className="button-row">
          <a className="primary" href="/melee/">
            Test in Melee
          </a>
          <a className="secondary" href="/jrpg/">
            Open JRPG
          </a>
          <a className="secondary" href="/autob/">
            Open Autob
          </a>
        </div>
        <p className="muted small">In Melee, choose the Custom roster.</p>
      </section>

      <Transfer
        library={library}
        onImport={(imported) => update(() => imported)}
      />
    </main>
  );
}
