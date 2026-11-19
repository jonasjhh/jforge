import { expect, test } from "@playwright/test";

test("starts a run, buys and places a unit, fights the first round", async ({
  page,
}) => {
  await page.goto("/autob/");
  await page.getByRole("button", { name: "Start a run" }).click();
  await expect(
    page.getByRole("heading", { name: "Round 1 of 30" }),
  ).toBeVisible();

  // Buy the first offer and stand it in the front row.
  await page
    .getByRole("region", { name: "Shop" })
    .locator(".offer")
    .first()
    .click();
  await page.getByRole("button", { name: /, bench 1$/ }).click();
  await page
    .getByRole("grid", { name: "Board" })
    .getByLabel("front row, column 4", { exact: true })
    .click();
  await expect(page.getByLabel("Status")).toContainText("Board 1/1");

  await page.getByRole("button", { name: "Fight" }).click();
  await expect(page.getByRole("grid", { name: "Fight" })).toBeVisible();
  await page.getByRole("button", { name: "Skip to the end" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // The run is saved: round 2 is still there after a reload.
  await expect(
    page.getByRole("heading", { name: "Round 2 of 30" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Round 2 of 30" }),
  ).toBeVisible();
});
