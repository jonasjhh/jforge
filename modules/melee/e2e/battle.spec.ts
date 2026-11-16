import { expect, log, startBattle, test, waitForTurn } from "./fixtures";

test("starts a battle from the start screen", async ({ page }) => {
  await startBattle(page);
  await expect(page.getByRole("grid", { name: "Party" })).toBeVisible();
  await waitForTurn(page);
  await expect(page.getByRole("button", { name: "Attack" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("attacks an enemy", async ({ page }) => {
  await startBattle(page);
  await waitForTurn(page);
  await page
    .getByRole("grid", { name: "Enemies" })
    .getByRole("gridcell", { name: /^Attack / })
    .first()
    .click();
  await expect(log(page)).toContainText("attacks");
});

test("uses a skill", async ({ page }) => {
  await startBattle(page);
  // Attack until a party member with an affordable skill is up.
  const skills = page.getByRole("button", { name: "Skill" });
  for (let turn = 0; turn < 10; turn++) {
    await waitForTurn(page);
    if (await skills.isEnabled()) {
      await skills.click();
      const option = page.locator(".skill-option:enabled").first();
      if ((await option.count()) > 0) {
        await option.click();
        break;
      }
      await page.getByRole("button", { name: "Attack" }).click();
    }
    await page
      .getByRole("gridcell", { name: /^Attack / })
      .first()
      .click();
  }
  // Single-target skills land on tap; area skills aim, then Cast.
  await page.locator("button.cell.targetable").first().click();
  const cast = page.getByRole("button", { name: "Cast" });
  if (await cast.isVisible()) await cast.click();
  await expect(log(page)).toContainText(
    /casts|uses|begins casting|raises|summons|shadowsteps/,
  );
});

test("pauses and resumes", async ({ page }) => {
  await startBattle(page);
  await page.getByRole("button", { name: "Pause" }).click();
  const overlay = page.getByRole("button", { name: /Paused/ });
  await expect(overlay).toBeVisible();
  await overlay.click();
  await expect(overlay).toBeHidden();
});

test("goes back to the start screen", async ({ page }) => {
  await startBattle(page);
  await page.getByRole("button", { name: "← Melee" }).click();
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
});

test("defends, then waits", async ({ page }) => {
  await startBattle(page);
  await waitForTurn(page);
  await page.getByRole("button", { name: "Defend", exact: true }).click();
  await expect(log(page)).toContainText("defends");
  await waitForTurn(page);
  await page.getByRole("button", { name: "Wait", exact: true }).click();
  await expect(log(page)).toContainText("waits");
});
