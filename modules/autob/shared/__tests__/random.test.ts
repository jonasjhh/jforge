import { describe, expect, it } from "vitest";
import { nextRandom, randomFrom } from "../random";

describe("nextRandom", () => {
  it("given a state, when a number is drawn twice from it, then both draws match", () => {
    const first = nextRandom(42);

    const second = nextRandom(42);

    expect(second).toEqual(first);
  });

  it("given many states, when a number is drawn from each, then all lie in [0, 1)", () => {
    const values = Array.from(
      { length: 200 },
      (_, i) => nextRandom(i * 977).value,
    );

    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("randomFrom", () => {
  it("given a seed, when numbers are drawn, then they follow nextRandom's chain", () => {
    const random = randomFrom(7);

    const drawn = [random(), random()];

    const first = nextRandom(7);
    expect(drawn).toEqual([first.value, nextRandom(first.state).value]);
  });
});
