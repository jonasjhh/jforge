import { expect, test } from "./fixtures";

test("serves the health check", async ({ request }) => {
  const response = await request.get("/api/melee/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ module: "melee", status: "ok" });
});

test("serves the app for any path inside the module", async ({ page }) => {
  await page.goto("/melee/some/deep/link");
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
});
