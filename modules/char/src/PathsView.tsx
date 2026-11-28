import { sourcesOf, type Library } from "@jforge/rules/core";
import { pathColumns } from "./paths";

interface PathsViewProps {
  library: Library;
  onOpenClass: (id: string) => void;
}

/** The class graph: base classes first, each step on in the next column. */
export function PathsView({ library, onOpenClass }: PathsViewProps) {
  const { columns, apart } = pathColumns(library);
  return (
    <div className="paths">
      {columns.length === 0 && (
        <p className="muted">No class here leads to another.</p>
      )}
      <div className="path-columns">
        {columns.map((column, depth) => (
          <section
            key={depth}
            className="path-column"
            aria-label={depth === 0 ? "Base classes" : `Step ${depth}`}
          >
            <h2>{depth === 0 ? "Base" : `Step ${depth}`}</h2>
            {column.map((a) => {
              const from = sourcesOf(library, a).map((s) => s.name);
              return (
                <button
                  key={a.id}
                  type="button"
                  className="class-card"
                  onClick={() => onOpenClass(a.id)}
                >
                  <span className="class-card-name">{a.name}</span>
                  {from.length > 0 && (
                    <span className="class-card-note">
                      from {from.join(" or ")}
                    </span>
                  )}
                </button>
              );
            })}
          </section>
        ))}
      </div>
      {apart.length > 0 && (
        <section className="panel" aria-label="Not on a path">
          <h2>Not on a path yet</h2>
          <div className="chips">
            {apart.map((a) => (
              <button
                key={a.id}
                type="button"
                className="class-card"
                onClick={() => onOpenClass(a.id)}
              >
                <span className="class-card-name">{a.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
