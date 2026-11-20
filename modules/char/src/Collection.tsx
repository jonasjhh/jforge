import { useEffect, useRef, useState, type ReactNode } from "react";

interface Named {
  id: string;
  name: string;
}

interface CollectionProps<T extends Named> {
  /** What one item is called: "skill", "class". */
  noun: string;
  /** What the list is called, as on its tab: "Skills", "Classes". */
  title: string;
  items: T[];
  /** A short note beside the name in the list. */
  note: (item: T) => string;
  /** The item being edited, or null for none. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Adds an item and returns its id; absent when nothing can be added. */
  onNew?: () => string;
  onDelete: (id: string) => void;
  /** The editor for the selected item. */
  children: (item: T) => ReactNode;
}

/** Whether an item's name or note contains the search, ignoring case. */
const matches = (query: string, ...texts: string[]) => {
  const q = query.trim().toLowerCase();
  return q === "" || texts.some((t) => t.toLowerCase().includes(q));
};

/**
 * A list of designs and the editor of the one picked. On a phone the editor
 * takes the list's place, with a way back; on a wide screen they sit side
 * by side (see index.css).
 */
export function Collection<T extends Named>({
  noun,
  title,
  items,
  note,
  selectedId,
  onSelect,
  onNew,
  onDelete,
  children,
}: CollectionProps<T>) {
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.id === selectedId);
  const shown = items.filter((item) => matches(query, item.name, note(item)));
  const editor = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const lastOpen = useRef<string | null>(null);

  // Bring the editor into view when an item opens, and the item back into
  // view in the list when its editor closes.
  const openId = selected?.id ?? null;
  useEffect(() => {
    if (openId) {
      lastOpen.current = openId;
      const top = editor.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) editor.current?.scrollIntoView?.({ block: "start" });
    } else if (lastOpen.current) {
      list.current
        ?.querySelector(`[data-id="${CSS.escape(lastOpen.current)}"]`)
        ?.scrollIntoView?.({ block: "center" });
      lastOpen.current = null;
    }
  }, [openId]);

  return (
    <div className={`collection${selected ? " has-selection" : ""}`}>
      <div className="browse">
        <input
          type="search"
          className="search"
          aria-label={`Search ${title.toLowerCase()}`}
          placeholder={`Search ${items.length} ${title.toLowerCase()}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="items" aria-label={`${noun} list`} ref={list}>
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-id={item.id}
                className={`item${item.id === selectedId ? " selected" : ""}`}
                aria-pressed={item.id === selectedId}
                onClick={() =>
                  onSelect(item.id === selectedId ? null : item.id)
                }
              >
                <span className="item-name">{item.name || "(unnamed)"}</span>
                <span className="item-note">{note(item)}</span>
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 && <p className="muted">Nothing here yet.</p>}
        {items.length > 0 && shown.length === 0 && (
          <p className="muted">Nothing matches “{query.trim()}”.</p>
        )}
        <button
          type="button"
          className="secondary"
          disabled={!onNew}
          onClick={() => {
            if (!onNew) return;
            setQuery("");
            onSelect(onNew());
          }}
        >
          New {noun}
        </button>
      </div>
      {selected ? (
        <section
          ref={editor}
          className="panel editor"
          aria-label={`Edit ${noun}`}
        >
          <button
            type="button"
            className="back-button"
            onClick={() => onSelect(null)}
          >
            ← {title}
          </button>
          {children(selected)}
          <DeleteButton
            key={selected.id}
            name={selected.name || noun}
            onDelete={() => {
              onDelete(selected.id);
              onSelect(null);
            }}
          />
        </section>
      ) : (
        <p className="panel no-selection muted">
          Pick a {noun} to edit it, or make a new one.
        </p>
      )}
    </div>
  );
}

interface DeleteButtonProps {
  name: string;
  onDelete: () => void;
}

/** Delete, after asking once. */
function DeleteButton({ name, onDelete }: DeleteButtonProps) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="danger" onClick={() => setAsking(true)}>
        Delete {name}
      </button>
    );
  }
  return (
    <div className="confirm" role="group" aria-label={`Delete ${name}?`}>
      <p>Delete {name}? This can't be undone.</p>
      <div className="button-row">
        <button type="button" className="danger" onClick={onDelete}>
          Yes, delete
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setAsking(false)}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
