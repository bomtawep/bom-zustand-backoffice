import { test, expect } from "@playwright/test";

test("dashboard home renders with the sidebar and topbar", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(/signed in as/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveAttribute(
    "href",
    "/dashboard/users"
  );
  await expect(page.getByRole("link", { name: "Profile" })).toHaveAttribute(
    "href",
    "/dashboard/profile"
  );
});
