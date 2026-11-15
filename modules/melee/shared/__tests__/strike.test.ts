import { describe, expect, it } from "vitest";
import { strike, type Fighter } from "../index";

const fighter = (attack: number, defense: number, hp: number): Fighter => ({
  name: "f",
  attack,
  defense,
  hp,
});

describe("strike", () => {
  it("deals attack minus defense", () => {
    expect(strike(fighter(7, 0, 10), fighter(0, 3, 10)).damage).toBe(4);
  });

  it("always deals at least 1 damage", () => {
    expect(strike(fighter(2, 0, 10), fighter(0, 9, 10)).damage).toBe(1);
  });

  it("knocks out at 0 hp without going negative", () => {
    const result = strike(fighter(20, 0, 10), fighter(0, 0, 5));
    expect(result.defenderHp).toBe(0);
    expect(result.knockedOut).toBe(true);
  });
});
