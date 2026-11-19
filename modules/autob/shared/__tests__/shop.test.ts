import { describe, expect, it } from "vitest";
import {
  POOL_COPIES,
  SHOP_ODDS,
  SHOP_SIZE,
  fullPool,
  returnToPool,
  rollShop,
} from "../shop";

const tiers = { a: 1, b: 1, c: 2, d: 3 };
/** A generator that gives these numbers in turn, over and over. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("SHOP_ODDS", () => {
  it("given every level's odds, when they are added up, then each makes 100", () => {
    const totals = SHOP_ODDS.map((row) => row.reduce((a, b) => a + b, 0));

    expect(totals.every((t) => t === 100)).toBe(true);
  });
});

describe("fullPool", () => {
  it("given classes of each tier, when the pool is filled, then each has its tier's copies", () => {
    const pool = fullPool(tiers);

    expect(pool).toEqual({
      a: POOL_COPIES[0],
      b: POOL_COPIES[0],
      c: POOL_COPIES[1],
      d: POOL_COPIES[2],
    });
  });
});

describe("returnToPool", () => {
  it("given a 2-star unit, when it is put back, then three copies return", () => {
    const pool = returnToPool({ a: 5 }, "a", 2);

    expect(pool).toEqual({ a: 8 });
  });

  it("given a bought copy, when it is taken out, then one copy goes", () => {
    const pool = returnToPool({ a: 5 }, "a", 1, -1);

    expect(pool).toEqual({ a: 4 });
  });

  it("given a class not in the pool, when a copy is put back, then it counts from none", () => {
    const pool = returnToPool({}, "a", 1);

    expect(pool).toEqual({ a: 1 });
  });
});

describe("rollShop", () => {
  it("given level 1, when the shop rolls, then it offers SHOP_SIZE tier-1 classes", () => {
    const shop = rollShop(fullPool(tiers), tiers, 1, sequence(0.3, 0.7));

    expect(shop).toHaveLength(SHOP_SIZE);
    expect(shop.every((id) => id === "a" || id === "b")).toBe(true);
  });

  it("given a high roll at the top level, when the shop rolls, then it offers the tier-3 class", () => {
    const shop = rollShop(fullPool(tiers), tiers, 10, sequence(0.99, 0.5));

    expect(shop.every((id) => id === "d")).toBe(true);
  });

  it("given a tier with no copies left, when it is drawn, then the nearest cheaper tier stands in", () => {
    const pool = { ...fullPool(tiers), d: 0 };

    const shop = rollShop(pool, tiers, 10, sequence(0.99, 0.5));

    expect(shop.every((id) => id === "c")).toBe(true);
  });

  it("given only dearer copies left, when a cheap tier is drawn, then the dearer one stands in", () => {
    const pool = { a: 0, b: 0, c: 0, d: 4 };

    const shop = rollShop(pool, tiers, 1, sequence(0.1, 0.5));

    expect(shop.every((id) => id === "d")).toBe(true);
  });

  it("given an empty pool, when the shop rolls, then it offers nothing", () => {
    const shop = rollShop({ a: 0, b: 0, c: 0, d: 0 }, tiers, 5, sequence(0.5));

    expect(shop.every((id) => id === null)).toBe(true);
  });

  it("given one class with most copies left, when a tier's class is picked, then the copies weigh the pick", () => {
    const pool = { a: 1, b: 17, c: 0, d: 0 };

    const shop = rollShop(pool, tiers, 1, sequence(0.1, 0.5));

    expect(shop.every((id) => id === "b")).toBe(true);
  });
});
