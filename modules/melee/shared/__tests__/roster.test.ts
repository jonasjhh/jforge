import { describe, expect, it } from "vitest";
import { fighter, monsters, playerTypes, slime } from "../content";
import { createBattle } from "../battle";
import {
  EMPTY_ROSTER,
  ROSTER_STORAGE_KEY,
  encounterPools,
  isCombatantDef,
  parseRoster,
  readRoster,
  writeRoster,
  type Roster,
} from "../roster";
import { place } from "./helpers";

const roster: Roster = { party: [fighter], monsters: [slime] };

function memoryStore(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const broken = {
  getItem: (): string => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
};

describe("isCombatantDef", () => {
  it("accepts the built-in types", () => {
    expect([...playerTypes, ...monsters].every(isCombatantDef)).toBe(true);
  });

  it.each([
    ["not an object", "fighter"],
    ["no name", { ...fighter, name: undefined }],
    ["no stats", { ...fighter, stats: undefined }],
    [
      "a missing stat",
      { ...fighter, stats: { ...fighter.stats, speed: undefined } },
    ],
    [
      "a stat that is not a number",
      { ...fighter, stats: { ...fighter.stats, attack: "9" } },
    ],
    ["no HP", { ...fighter, stats: { ...fighter.stats, maxHp: 0 } }],
    ["no weapon", { ...fighter, weapon: undefined }],
    [
      "an unknown damage type",
      { ...fighter, weapon: { ...fighter.weapon, damageType: "love" } },
    ],
    [
      "a bad reach",
      { ...fighter, weapon: { ...fighter.weapon, columns: "all" } },
    ],
    ["skills that are not a list", { ...fighter, skills: "cleave" }],
    [
      "a skill with no effect",
      { ...fighter, skills: [{ id: "x", name: "X" }] },
    ],
  ])("rejects %s", (_, value) => {
    expect(isCombatantDef(value)).toBe(false);
  });
});

describe("parseRoster", () => {
  it("reads back what was written", () => {
    expect(parseRoster(JSON.stringify(roster))).toEqual(roster);
  });

  it.each([
    ["nothing", null],
    ["empty text", ""],
    ["broken JSON", "{"],
    ["a list", "[]"],
    ["a missing side", JSON.stringify({ party: [] })],
    [
      "a broken combatant",
      JSON.stringify({ party: [{ id: "x" }], monsters: [] }),
    ],
  ])("gives null for %s", (_, text) => {
    expect(parseRoster(text)).toBeNull();
  });

  it("gives combatants a battle can use", () => {
    const parsed = parseRoster(JSON.stringify(roster))!;
    expect(() =>
      createBattle(
        {
          placements: [
            place(parsed.party[0]!, "player", 0),
            place(parsed.monsters[0]!, "enemy", 0),
          ],
        },
        1,
      ),
    ).not.toThrow();
  });
});

describe("readRoster and writeRoster", () => {
  it("round-trips through a store under melee's key", () => {
    const store = memoryStore();
    expect(writeRoster(store, roster)).toBe(true);
    expect(store.getItem(ROSTER_STORAGE_KEY)).not.toBeNull();
    expect(readRoster(store)).toEqual(roster);
  });

  it("is empty when nothing usable is saved", () => {
    expect(readRoster(memoryStore())).toBe(EMPTY_ROSTER);
    expect(readRoster(memoryStore({ [ROSTER_STORAGE_KEY]: "nope" }))).toBe(
      EMPTY_ROSTER,
    );
  });

  it("survives a store that throws", () => {
    expect(readRoster(broken)).toBe(EMPTY_ROSTER);
    expect(writeRoster(broken, roster)).toBe(false);
  });
});

describe("encounterPools", () => {
  it("is the built-in pools unless custom is chosen", () => {
    expect(encounterPools(roster, false)).toEqual({
      party: playerTypes,
      monsters,
    });
  });

  it("uses the imported sides when custom", () => {
    expect(encounterPools(roster, true)).toEqual(roster);
  });

  it("keeps a side built in when nothing was imported for it", () => {
    expect(encounterPools({ party: [fighter], monsters: [] }, true)).toEqual({
      party: [fighter],
      monsters,
    });
    expect(encounterPools({ party: [], monsters: [slime] }, true)).toEqual({
      party: playerTypes,
      monsters: [slime],
    });
  });
});
