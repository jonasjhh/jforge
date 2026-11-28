import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadBattleSpeed,
  nextSpeed,
  saveBattleSpeed,
  type BattleSpeed,
} from "@jforge/battle/screen/battleSpeed.ts";

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
  it("given nothing saved, when the speed is loaded, then it is 1", () => {
    vi.stubGlobal("localStorage", memoryStorage());

    const speed = loadBattleSpeed();

    expect(speed).toBe(1);
  });

  it.each<[BattleSpeed, BattleSpeed]>([
    [1, 2],
    [2, 1],
  ])(
    "given %i saved, when the speed is loaded, then it is remembered",
    (saved, other) => {
      vi.stubGlobal("localStorage", memoryStorage());
      saveBattleSpeed(other);
      saveBattleSpeed(saved);

      const speed = loadBattleSpeed();

      expect(speed).toBe(saved);
    },
  );

  it("given storage is unavailable, when 2 is saved, then nothing throws", () => {
    vi.stubGlobal("localStorage", broken);

    const save = () => saveBattleSpeed(2);

    expect(save).not.toThrow();
  });

  it("given storage is unavailable, when the speed is loaded, then it falls back to 1", () => {
    vi.stubGlobal("localStorage", broken);

    const speed = loadBattleSpeed();

    expect(speed).toBe(1);
  });
});

describe("nextSpeed", () => {
  it.each<[BattleSpeed, BattleSpeed]>([
    [1, 2],
    [2, 1],
  ])("given %i×, when the speed is toggled, then it is %i×", (from, to) => {
    const next = nextSpeed(from);

    expect(next).toBe(to);
  });
});
