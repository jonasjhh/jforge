import { describe, expect, it } from "vitest";
import type { Encounter } from "../../shared";
import { iconOf } from "../icons";

const battle = (rank: "normal" | "elite" | "boss") =>
  ({ kind: "battle", difficulty: "normal", seed: 1, rank }) as const;

describe("iconOf", () => {
  it.each<[string, Encounter, string]>([
    ["a normal battle", battle("normal"), "⚔"],
    ["an elite battle", battle("elite"), "☠"],
    ["a boss battle", battle("boss"), "♛"],
    ["a gear find", { kind: "gear", gearIds: [] }, "◆"],
    ["training", { kind: "training" }, "▲"],
    [
      "an ally",
      {
        kind: "ally",
        character: { id: "a", name: "A", archetypeId: "t", gear: {} },
      },
      "☺",
    ],
  ])(
    "given %s, when its icon is taken, then it is %s",
    (_, encounter, icon) => {
      const shown = iconOf(encounter);

      expect(shown).toBe(icon);
    },
  );
});
