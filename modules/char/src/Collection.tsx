import { useState, type ReactNode } from "react";

interface Named {
  id: string;
  name: string;
}

interface CollectionProps<T extends Named> {
  /** What one item is called: "skill", "class". */
  noun: string;
  items: T[];
  /** A short note beside the name in the list. */
  note: (item: T) => string;
  /** Adds an item and returns its id; absent when nothing can be added. */
  onNew?: () => string;
  onDelete: (id: string) => void;
  /** The editor for the selected item. */
  children: (item: T) => ReactNode;
}

/** A list of designs: pick one to edit it below, add or delete. */
export function Collection<T extends Named>({
  noun,
  items,
  note,
  onNew,
  onDelete,
  children,
}: CollectionProps<T>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId);
  return (
    <>
      <ul className="items" aria-label={`${noun} list`}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`item${item.id === selectedId ? " selected" : ""}`}
              aria-pressed={item.id === selectedId}
              onClick={() =>
                setSelectedId(item.id === selectedId ? null : item.id)
              }
            >
              <span className="item-name">{item.name || "(unnamed)"}</span>
              <span className="item-note">{note(item)}</span>
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="muted">Nothing here yet.</p>}
      <button
        type="button"
        className="secondary"
        disabled={!onNew}
        onClick={() => onNew && setSelectedId(onNew())}
      >
        New {noun}
      </button>
      {selected && (
        <section className="panel editor" aria-label={`Edit ${noun}`}>
          {children(selected)}
          <button
            type="button"
            className="danger"
            onClick={() => {
              onDelete(selected.id);
              setSelectedId(null);
            }}
          >
            Delete {selected.name || noun}
          </button>
        </section>
      )}
    </>
  );
}
