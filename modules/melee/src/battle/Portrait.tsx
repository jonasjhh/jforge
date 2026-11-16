import { PORTRAITS } from "./portraitIcons";

/** A unit's icon, by its def id. Decorative: the name says who it is. */
export function Portrait({
  defId,
  className = "",
}: {
  defId: string;
  className?: string;
}) {
  const d = PORTRAITS[defId];
  if (!d) return null;
  return (
    <svg
      className={`portrait ${className}`}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
