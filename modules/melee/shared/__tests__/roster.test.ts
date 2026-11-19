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
import { SAVE_VERSION } from "../save";
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
  it("given the built-in types, when they are checked, then each is a combatant", () => {
    const types = [...playerTypes, ...monsters];

    const rejected = types.filter((t) => !isCombatantDef(t));

    expect(rejected).toEqual([]);
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
  ])(
    "given a value with %s, when it is checked, then it is rejected",
    (_, value) => {
      const result = isCombatantDef(value);

      expect(result).toBe(false);
    },
  );
});

/** A roster as writeRoster saves it. */
const saved = (data: object) =>
  JSON.stringify({ version: SAVE_VERSION, ...data });

describe("parseRoster", () => {
  it("given a saved roster, when it is parsed, then it reads back what was written", () => {
    const text = saved(roster);

    const parsed = parseRoster(text);

    expect(parsed).toEqual(roster);
  });

  it.each([
    ["nothing", null],
    ["empty text", ""],
    ["broken JSON", "{"],
    ["a list", "[]"],
    ["a missing side", saved({ party: [] })],
    ["a broken combatant", saved({ party: [{ id: "x" }], monsters: [] })],
    ["no version", JSON.stringify(roster)],
    ["another version", saved({ ...roster, version: SAVE_VERSION - 1 })],
  ])("given %s, when it is parsed, then it gives null", (_, text) => {
    const parsed = parseRoster(text);

    expect(parsed).toBeNull();
  });

  it("given a parsed roster, when a battle is built from it, then the combatants are usable", () => {
    const parsed = parseRoster(saved(roster))!;
    const placements = [
      place(parsed.party[0]!, "player", 0),
      place(parsed.monsters[0]!, "enemy", 0),
    ];

    const create = () => createBattle({ placements }, 1);

    expect(create).not.toThrow();
  });
});

describe("readRoster and writeRoster", () => {
  it("given a store, when a roster is written, then it is saved under melee's key", () => {
    const store = memoryStore();

    const ok = writeRoster(store, roster);

    expect(ok).toBe(true);
    expect(store.getItem(ROSTER_STORAGE_KEY)).not.toBeNull();
  });

  it("given a written roster, when it is read, then it round-trips", () => {
    const store = memoryStore();
    writeRoster(store, roster);

    const read = readRoster(store);

    expect(read).toEqual(roster);
  });

  it.each([
    ["nothing saved", {}],
    ["something unusable saved", { [ROSTER_STORAGE_KEY]: "nope" }],
  ])("given %s, when the roster is read, then it is empty", (_, items) => {
    const store = memoryStore(items);

    const read = readRoster(store);

    expect(read).toBe(EMPTY_ROSTER);
  });

  it("given a store that throws, when the roster is read, then it is empty", () => {
    const store = broken;

    const read = readRoster(store);

    expect(read).toBe(EMPTY_ROSTER);
  });

  it("given a store that throws, when the roster is written, then it reports failure", () => {
    const store = broken;

    const ok = writeRoster(store, roster);

    expect(ok).toBe(false);
  });
});

describe("encounterPools", () => {
  it.each<[string, Roster, boolean, Roster]>([
    ["custom not chosen", roster, false, { party: playerTypes, monsters }],
    ["custom chosen", roster, true, roster],
    [
      "custom chosen with no monsters imported",
      { party: [fighter], monsters: [] },
      true,
      { party: [fighter], monsters },
    ],
    [
      "custom chosen with no party imported",
      { party: [], monsters: [slime] },
      true,
      { party: playerTypes, monsters: [slime] },
    ],
  ])(
    "given %s, when the pools are taken, then each side is imported or built in",
    (_, imported, custom, pools) => {
      const result = encounterPools(imported, custom);

      expect(result).toEqual(pools);
    },
  );
});
