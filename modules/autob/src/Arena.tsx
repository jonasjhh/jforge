import type { ReactNode } from "react";
import { ARENA_ROWS, BOARD_COLUMNS, BOARD_ROWS, type Hex } from "../shared";
import { hexName } from "./hexName";

const ROWS = Array.from({ length: ARENA_ROWS }, (_, row) => row);
const COLUMNS = Array.from({ length: BOARD_COLUMNS }, (_, col) => col);

/** What a hex shows. */
export interface HexView {
  content?: ReactNode;
  /** Names what stands there; the hex's own name follows it. */
  label?: string;
  className?: string;
  pressed?: boolean;
  /** Tapping it; without, the hex is not a button. */
  onTap?: () => void;
}

interface ArenaProps {
  label: string;
  view: (hex: Hex) => HexView;
}

/**
 * The hex arena: the enemy's side on top, the player's below, each
 * BOARD_ROWS rows of BOARD_COLUMNS. Odd rows sit half a hex to the right.
 */
export function Arena({ label, view }: ArenaProps) {
  return (
    <div className="arena" role="grid" aria-label={label}>
      {ROWS.map((row) => (
        <div
          key={row}
          role="row"
          className={`hex-row${row % 2 ? " odd" : ""}${
            row < BOARD_ROWS ? " enemy-side" : " player-side"
          }`}
        >
          {COLUMNS.map((col) => {
            const hex = { col, row };
            const v = view(hex);
            const name = v.label ? `${v.label}, ${hexName(hex)}` : hexName(hex);
            const className = `hex${v.className ? ` ${v.className}` : ""}`;
            return v.onTap ? (
              <button
                key={col}
                type="button"
                role="gridcell"
                className={className}
                aria-label={name}
                aria-pressed={v.pressed}
                onClick={v.onTap}
              >
                {v.content}
              </button>
            ) : (
              <div
                key={col}
                role="gridcell"
                className={className}
                aria-label={name}
              >
                {v.content}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
