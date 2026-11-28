import { describe, expect, it } from "vitest";
import type { Gear } from "@jforge/rules/core";
import { catalogue } from "..";

const GEAR_PREFIX: Record<Gear["slot"], string> = {
  weapon: "weapon-",
  armour: "armour-",
  accessory: "accessory-",
};
const misnamed = <T extends { id: string }>(
  items: T[],
  prefix: (item: T) => string,
) => items.filter((item) => !item.id.startsWith(prefix(item))).map((i) => i.id);

describe("the catalogue's ids", () => {
  it.each([
    ["enemy", "enemy-"],
    ["summon", "summon-"],
  ] as const)(
    "given the catalogue, when its %s types are listed, then every id starts with %s",
    (kind, prefix) => {
      const types = catalogue().archetypes.filter((a) => a.kind === kind);

      const wrong = misnamed(types, () => prefix);

      expect(types.length).toBeGreaterThan(0);
      expect(wrong).toEqual([]);
    },
  );

  it("given the catalogue, when its gear is listed, then every id starts with its slot", () => {
    const gear = catalogue().gear;

    const wrong = misnamed(gear, (g: Gear) => GEAR_PREFIX[g.slot]);

    expect(wrong).toEqual([]);
  });

  it("given the catalogue, when its archetypes and gear are listed, then no two share an id", () => {
    const library = catalogue();
    const ids = [...library.archetypes, ...library.gear].map((x) => x.id);

    const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);

    expect(repeated).toEqual([]);
  });
});
