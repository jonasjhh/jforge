import type { Encounter } from "../shared";

const ICONS: Record<Encounter["kind"], string> = {
  battle: "⚔",
  ally: "☺",
  gear: "◆",
  training: "▲",
};

/** The sign an encounter has on the map. */
export const iconOf = (encounter: Encounter): string =>
  encounter.kind !== "battle"
    ? ICONS[encounter.kind]
    : encounter.rank === "boss"
      ? "♛"
      : encounter.rank === "elite"
        ? "☠"
        : ICONS.battle;
