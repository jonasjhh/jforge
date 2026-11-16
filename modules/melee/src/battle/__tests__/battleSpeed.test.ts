import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBattleSpeed, saveBattleSpeed } from "../battleSpeed";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const broken = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("battle speed", () => {
  it("is 1 until 2 is saved, then remembered", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    expect(loadBattleSpeed()).toBe(1);
    saveBattleSpeed(2);
    expect(loadBattleSpeed()).toBe(2);
    saveBattleSpeed(1);
    expect(loadBattleSpeed()).toBe(1);
  });

  it("falls back to 1 when storage is unavailable", () => {
    vi.stubGlobal("localStorage", broken);
    expect(() => saveBattleSpeed(2)).not.toThrow();
    expect(loadBattleSpeed()).toBe(1);
  });
});
