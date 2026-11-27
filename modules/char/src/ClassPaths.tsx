import {
  nextClasses,
  possibleSources,
  sourcesOf,
  withSource,
  withoutSource,
  type Archetype,
  type Library,
} from "../shared";
import { SelectField } from "./fields";

interface ClassPathsProps {
  archetype: Archetype;
  library: Library;
  onChange: (archetype: Archetype) => void;
  /** Opens another class in its editor. */
  onOpen?: (id: string) => void;
}

/** Where a class sits in the class graph: what it comes from and becomes. */
export function ClassPaths({
  archetype,
  library,
  onChange,
  onOpen,
}: ClassPathsProps) {
  const sources = sourcesOf(library, archetype);
  const next = nextClasses(library, archetype.id);
  const options = possibleSources(library, archetype);
  const name = (a: Archetype) => a.name || "(unnamed)";
  const open = (a: Archetype) =>
    onOpen ? (
      <button
        type="button"
        className="link-button"
        aria-label={`Open ${name(a)}`}
        onClick={() => onOpen(a.id)}
      >
        {name(a)}
      </button>
    ) : (
      <span>{name(a)}</span>
    );

  return (
    <fieldset className="group">
      <legend>Class paths</legend>
      <div className="field-label">Comes from (any one)</div>
      {sources.length === 0 ? (
        <p className="muted small">Nothing: it is a base class.</p>
      ) : (
        <ul className="known" aria-label="Comes from">
          {sources.map((source) => (
            <li key={source.id} className="known-skill">
              {open(source)}
              <button
                type="button"
                className="remove"
                aria-label={`No longer from ${name(source)}`}
                onClick={() => onChange(withoutSource(archetype, source.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {options.length > 0 && (
        <SelectField
          label="Add a class it comes from"
          value=""
          options={[
            ["", "Pick a class"] as const,
            ...options.map((a) => [a.id, name(a)] as const),
          ]}
          onChange={(id) => {
            if (id) onChange(withSource(library, archetype, id));
          }}
        />
      )}
      <div className="field-label">Becomes</div>
      {next.length === 0 ? (
        <p className="muted small">Nothing yet.</p>
      ) : (
        <ul className="known" aria-label="Becomes">
          {next.map((a) => (
            <li key={a.id} className="known-skill path">
              {open(a)}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        A game decides when a character may take a path. A class that can be
        reached should have stand-ins for its source's key skills.
      </p>
    </fieldset>
  );
}
