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
  /** The item open, or null for none. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** What the open item shows. */
  children: (item: T) => ReactNode;
}

/** Whether an item's name or note contains the search, ignoring case. */
const matches = (query: string, ...texts: string[]) => {
  const q = query.trim().toLowerCase();
  return q === "" || texts.some((t) => t.toLowerCase().includes(q));
};

/**
 * A list of content and the page of the one picked. On a phone the page
 * takes the list's place, with a way back; on a wide screen they sit side
 * by side (see index.css). Read-only: content is changed in code.
 */
export function Collection<T extends Named>({
  noun,
  title,
  items,
  note,
  selectedId,
  onSelect,
  children,
}: CollectionProps<T>) {
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.id === selectedId);
  const shown = items.filter((item) => matches(query, item.name, note(item)));
  const editor = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const lastOpen = useRef<string | null>(null);

  // Bring the page into view when an item opens, and the item back into
  // view in the list when its page closes.
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
      </div>
      {selected ? (
        <section
          ref={editor}
          className="panel editor"
          aria-label={selected.name}
        >
          <button
            type="button"
            className="back-button"
            onClick={() => onSelect(null)}
          >
            ← {title}
          </button>
          {children(selected)}
        </section>
      ) : (
        <p className="panel no-selection muted">Pick a {noun} to see it.</p>
      )}
    </div>
  );
}
