import { describe, expect, it } from "vitest";
import { tune } from "../tune";

describe("tune", () => {
  it("given a design and changes, when it is tuned, then the changes replace its values and the rest is kept", () => {
    const base = { id: "wolf", stats: { maxHp: 50, speed: 16 }, name: "Wolf" };

    const tuned = tune(base, {
      id: "melee-wolf",
      stats: { maxHp: 60, speed: 15 },
    });

    expect(tuned).toEqual({
      id: "melee-wolf",
      stats: { maxHp: 60, speed: 15 },
      name: "Wolf",
    });
  });

  it("given a design, when it is tuned, then the design itself is unchanged", () => {
    const base = { id: "wolf", threat: 3 };

    tune(base, { threat: 5 });

    expect(base).toEqual({ id: "wolf", threat: 3 });
  });
});
