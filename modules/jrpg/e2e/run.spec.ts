import { expect, test } from "@playwright/test";

test("sets out, meets the first battle and can retreat to the map", async ({
  page,
}) => {
  await page.goto("/jrpg/");
  await expect(page.getByRole("main")).toContainText("Aldric and Mira");
  await page.getByRole("button", { name: "Set out" }).click();

  await expect(page.getByRole("heading", { name: "Level 1" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Encounters" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Party" })).toContainText(
    "Aldric",
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
