import { expect, test } from "@playwright/test";

test("sets out, meets the first battle and can retreat to the map", async ({
  page,
}) => {
  await page.goto("/jrpg/");
  await expect(page.getByRole("region", { name: "Setting out" })).toContainText(
    "Level 3",
  );
  await page.getByRole("button", { name: "Draw again" }).click();
  await page.getByRole("button", { name: "Set out" }).click();

  await expect(page.getByRole("heading", { name: "Level 1" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Encounters" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Party" })).toContainText(
    "Level 3",
  );
  await expect(page.getByRole("region", { name: "Encounter" })).toContainText(
    "Battle",
  );

  await page.getByRole("button", { name: "Fight" }).click();
  await expect(page.getByRole("grid", { name: "Enemies" })).toBeVisible();
  await page.getByRole("button", { name: "← Retreat" }).click();
  await expect(page.getByRole("button", { name: "Fight" })).toBeVisible();

  // The run is saved: it is still there after a reload.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Level 1" })).toBeVisible();
});

test("can't walk away from a battle once the party has acted", async ({
  page,
}) => {
  await page.goto("/jrpg/");
  await page.getByRole("button", { name: "Set out" }).click();
  await page.getByRole("button", { name: "Fight" }).click();
  await expect(page.getByRole("group", { name: "Action" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Defend" }).click();
  await expect(page.getByRole("button", { name: "Give up" })).toBeVisible();

  // Starting over is allowed: the battle begins again.
  await page.getByRole("button", { name: "Restart battle" }).click();
  await expect(
    page.getByRole("button", { name: "Restart battle" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Give up" })).toBeVisible();

  // Reloading is no way out: the run opens in the same battle.
  await page.reload();
  await expect(page.getByRole("grid", { name: "Enemies" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Give up" }).click();
  await expect(page.getByRole("region", { name: "Encounter" })).toContainText(
    "The party has fallen",
  );
});
