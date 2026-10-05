import { test, expect } from "@playwright/test";

test("users list renders rows and supports pagination controls", async ({ page }) => {
  await page.goto("/dashboard/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();

  const nextButton = page.getByRole("button", { name: "Next" }).first();
  const prevButton = page.getByRole("button", { name: "Previous" });

  await expect(nextButton).toBeVisible();
  await expect(prevButton).toBeDisabled();
});
