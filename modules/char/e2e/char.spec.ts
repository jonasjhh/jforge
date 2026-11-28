import { expect, test } from "@playwright/test";

test("reads a character and sees its stats follow its gear", async ({
  page,
}) => {
  await page.goto("/char/");
  await page.getByRole("tab", { name: "Characters" }).click();
  await page.getByRole("button", { name: /^Aldric / }).click();

  const attack = page
    .getByRole("table", { name: "Stats" })
    .getByRole("row", { name: /Attack/ });
  // Knight hero with the Knight's Lance (+3): 18 attack, 21.
  await expect(attack).toContainText("18");
  await expect(attack).toContainText("21");
});

test("follows a class to a skill and back to who knows it", async ({
  page,
}) => {
  await page.goto("/char/");
  await page.getByRole("button", { name: /^Sage / }).click();
  const skills = page.getByRole("list", { name: "Skills" });
  const first = (await skills.getByRole("button").first().textContent())!;

  await skills.getByRole("button", { name: `Open ${first}` }).click();

  await expect(page.getByRole("tab", { name: "Skills" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("list", { name: "Known by" })).toContainText(
    "Sage",
  );
});

test("shows the class paths and what one game uses", async ({ page }) => {
  await page.goto("/char/");
  await page.getByRole("tab", { name: "Paths" }).click();
  await expect(page.getByRole("region", { name: "Step 1" })).toContainText(
    "Warrior",
  );

  await page.getByRole("radio", { name: "JRPG" }).click();

  await expect(
    page.getByRole("region", { name: "Not on a path" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Step 1" })).toHaveCount(0);
});
