import { BOARD_ROWS, type Hex } from "../shared";

const ROW_WORDS = ["front", "second", "third", "back"];

/** How a hex is named: its side, its row on that side and its column. */
export function hexName({ col, row }: Hex): string {
  const enemy = row < BOARD_ROWS;
  const sideRow = enemy ? BOARD_ROWS - 1 - row : row - BOARD_ROWS;
  return `${enemy ? "enemy " : ""}${ROW_WORDS[sideRow]} row, column ${col + 1}`;
}
