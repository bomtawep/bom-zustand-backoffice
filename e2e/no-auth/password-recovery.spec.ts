import { test, expect } from "@playwright/test";

test("forgot password shows a confirmation message after submitting", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/reset link is on its way/i)).toBeVisible();
});

test("reset password form validates matching passwords", async ({ page }) => {
  await page.goto("/reset-password?token=test-token");
  await page.getByLabel("New password").fill("newpassword123");
  await page.getByLabel("Confirm password").fill("different123");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText(/passwords do not match/i)).toBeVisible();
});
