import { expect, test } from "@playwright/test";

test("edits a character and sees its stats follow its gear", async ({
  page,
}) => {
  await page.goto("/char/");
  await page.getByRole("button", { name: /Aldric/ }).click();
  const stats = page.getByRole("table", { name: "Stats" });
  const attack = stats.getByRole("row", { name: /Attack/ });
  // Knight hero with the Knight's Lance (+3): 18 attack, 21.
  await expect(attack).toContainText("18");
  await expect(attack).toContainText("21");

  await page.getByLabel("Weapon").selectOption("None");
  await expect(attack).not.toContainText("21");
});

test("a designed character plays in melee and shows up in jrpg", async ({
  page,
}) => {
  await page.goto("/char/");
  await page.getByRole("button", { name: /Aldric/ }).click();
  await page.getByLabel("Name").fill("Sir Aldric");
  await expect(page.getByRole("status").first()).toContainText("Published");

  await page.getByRole("link", { name: "Test in Melee" }).click();
  await page.getByRole("radio", { name: "Custom" }).click();
  const party = page.locator("p", { has: page.getByText("Your party:") });
  await expect(party).toBeVisible();
  // Melee fields five of the roster's heroes, picked by the encounter's seed.
  for (let i = 0; i < 20; i++) {
    if ((await party.textContent())?.includes("Sir Aldric")) break;
    await page.getByRole("button", { name: "Reroll" }).click();
  }
  await expect(party).toContainText("Sir Aldric");
  await expect(page.getByRole("main")).toContainText("Goblin");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("grid", { name: "Party" })).toContainText(
    "Sir Aldric",
  );

  await page.goto("/jrpg/");
  await expect(page.getByRole("main")).toContainText("Sir Aldric");
});

test("designs a new skill and teaches it to a class", async ({ page }) => {
  await page.goto("/char/");
  await page.getByRole("tab", { name: "Skills" }).click();
  await page.getByRole("button", { name: "New skill" }).click();
  await page.getByLabel("Name").fill("Ice Lance");
  await page.getByLabel("Damage type").selectOption("Cold");

  await page.getByRole("tab", { name: "Classes" }).click();
  await page.getByRole("button", { name: /Sage/ }).click();
  await page.getByRole("checkbox", { name: "Ice Lance" }).check();

  await page.getByRole("tab", { name: "Roster" }).click();
  await page.getByRole("button", { name: /Mira/ }).click();
  await expect(page.getByText(/Skills:/)).toContainText("Ice Lance");
});
