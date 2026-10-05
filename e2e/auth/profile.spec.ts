import { test, expect } from "@playwright/test";

test("profile page shows the current user and surfaces an error for a wrong current password", async ({
  page,
}) => {
  await page.goto("/dashboard/profile");
  await expect(page.getByText(/^Email:/)).toBeVisible();

  await page.getByLabel("Current password").fill("definitely-wrong-password");
  await page.getByLabel("New password", { exact: true }).fill("newpassword123");
  await page.getByLabel("Confirm new password").fill("newpassword123");
  await page.getByRole("button", { name: "Update password" }).click();

  await expect(page.getByText(/invalid|incorrect|unauthorized|failed/i)).toBeVisible();
});
