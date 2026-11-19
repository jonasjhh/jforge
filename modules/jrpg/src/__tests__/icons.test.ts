import { describe, expect, it } from "vitest";
import { iconOf } from "../icons";

const battle = (rank: "normal" | "elite" | "boss") =>
  ({ kind: "battle", difficulty: "normal", seed: 1, rank }) as const;

describe("iconOf", () => {
  it("marks battles by rank", () => {
    expect(iconOf(battle("normal"))).toBe("⚔");
    expect(iconOf(battle("elite"))).toBe("☠");
    expect(iconOf(battle("boss"))).toBe("♛");
  });

  it("marks every other encounter by its kind", () => {
    expect(iconOf({ kind: "gear", gearIds: [] })).toBe("◆");
    expect(iconOf({ kind: "training" })).toBe("▲");
    expect(
      iconOf({
        kind: "ally",
        character: { id: "a", name: "A", archetypeId: "t", gear: {} },
      }),
    ).toBe("☺");
  });
});
