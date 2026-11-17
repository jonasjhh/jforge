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
import { useLibrary } from "./useLibrary";

const TABS = ["Roster", "Classes", "Enemies", "Skills", "Gear"] as const;
type Tab = (typeof TABS)[number];

const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function App() {
  const { library, update, saved } = useLibrary();
  const [tab, setTab] = useState<Tab>("Roster");
  const roster = compileRoster(library);

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
      items={library.archetypes.filter((a) => a.kind === kind)}
      note={(a) =>
        `${a.baseStats.maxHp} HP · ${count(a.skills.length, "skill")}`
      }
      onNew={() => add("archetypes", (id) => blankArchetype(id, kind))}
      onDelete={drop("archetypes")}
    >
      {(archetype) => (
        <ArchetypeEditor
          archetype={archetype}
          skills={library.skills}
          onChange={save("archetypes")}
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
          items={library.characters}
          note={(c) => {
            const archetype = archetypeOf(library, c);
            return `Lv ${c.level} ${archetype?.name ?? "?"}`;
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
            />
          )}
        </Collection>
      )}
      {tab === "Classes" && archetypes("class")}
      {tab === "Enemies" && archetypes("enemy")}
      {tab === "Skills" && (
        <Collection
          noun="skill"
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
        <h2>In melee and jrpg</h2>
        <p role="status">
          {saved ? (
            <>
              Published: <strong>{roster.party.length}</strong> party members
              and <strong>{roster.monsters.length}</strong> enemies. Characters
              of a class join the party; characters of an enemy type join the
              monster pool.
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
