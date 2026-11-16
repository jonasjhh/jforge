import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every page starts with a seeded Math.random, so the app picks the same
 * encounter and battle seeds on every run and the battle plays the same way.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      let s = 42;
      Math.random = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), s | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    });
    await use(page);
  },
});

export { expect };

/** Opens Melee and starts the encounter on the start screen. */
export async function startBattle(page: Page): Promise<void> {
  await page.goto("/melee/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("grid", { name: "Enemies" })).toBeVisible();
}

/** Waits until a party member's turn comes up. */
export async function waitForTurn(page: Page): Promise<void> {
  await expect(page.getByRole("group", { name: "Action" })).toBeVisible({
    timeout: 15_000,
  });
}

/** The battle log's lines, newest first. */
export function log(page: Page) {
  return page.getByRole("list", { name: "Battle log" });
}
