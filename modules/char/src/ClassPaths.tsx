import {
  nextClasses,
  sourcesOf,
  type Archetype,
  type Library,
} from "@jforge/rules/core";

interface ClassPathsProps {
  archetype: Archetype;
  library: Library;
  /** Opens another class. */
  onOpen?: (id: string) => void;
}

/**
 * Where a class sits in the class graph: what it comes from and becomes.
 * The Paths tab shows the whole graph.
 */
export function ClassPaths({ archetype, library, onOpen }: ClassPathsProps) {
  const name = (a: Archetype) => a.name || "(unnamed)";
  const list = (label: string, classes: Archetype[], none: string) =>
    classes.length === 0 ? (
      <p className="muted small">{none}</p>
    ) : (
      <ul className="known" aria-label={label}>
        {classes.map((a) => (
          <li key={a.id} className="known-skill path">
            {onOpen ? (
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
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <fieldset className="group">
      <legend>Class paths</legend>
      <div className="field-label">Comes from (any one)</div>
      {list(
        "Comes from",
        sourcesOf(library, archetype),
        "Nothing: it is a base class.",
      )}
      <div className="field-label">Becomes</div>
      {list("Becomes", nextClasses(library, archetype.id), "Nothing yet.")}
      <p className="muted small">
        A game decides when a character may take a path.
      </p>
    </fieldset>
  );
}
