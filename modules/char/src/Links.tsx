interface Linked {
  id: string;
  name: string;
}

interface LinksProps<T extends Linked> {
  /** What the list is, for screen readers: "Skills". */
  label: string;
  items: T[];
  /** Shown when the list is empty. */
  none: string;
  /** A short note after a name. */
  note?: (item: T) => string;
  onOpen: (item: T) => void;
}

/** A list of other content, each opening where it is shown. */
export function Links<T extends Linked>({
  label,
  items,
  none,
  note,
  onOpen,
}: LinksProps<T>) {
  if (items.length === 0) return <p className="muted small">{none}</p>;
  return (
    <ul className="known" aria-label={label}>
      {items.map((item) => (
        <li key={item.id} className="known-skill path">
          <button
            type="button"
            className="link-button"
            aria-label={`Open ${item.name}`}
            onClick={() => onOpen(item)}
          >
            {item.name}
          </button>
          {note && <span className="muted small"> {note(item)}</span>}
        </li>
      ))}
    </ul>
  );
}
