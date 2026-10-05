import { test, expect } from "@playwright/test";

test("creates a user, edits it, and deactivates it from the UI", async ({ page }) => {
  const uniqueEmail = `ui-e2e-${Date.now()}@example.com`;

  await page.goto("/dashboard/users/new");
  await page.getByLabel("Name").fill("UI E2E User");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: "viewer" }).click();
  await page.getByRole("button", { name: "Create user" }).click();

  await expect(page).toHaveURL(/\/dashboard\/users$/);
  const row = page.getByRole("row", { name: new RegExp(uniqueEmail) });
  await expect(row).toBeVisible();

  await row.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/dashboard\/users\/.+/);
  await page.getByLabel("Name").fill("UI E2E User Updated");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(/\/dashboard\/users$/);
  const updatedRow = page.getByRole("row", { name: new RegExp(uniqueEmail) });
  await expect(updatedRow).toBeVisible();

  await updatedRow.getByRole("button", { name: "Deactivate" }).first().click();
  const confirmDialog = page.getByRole("alertdialog");
  await confirmDialog.getByRole("button", { name: "Deactivate", exact: true }).click();

  await expect(updatedRow.getByText("Inactive")).toBeVisible();
});
