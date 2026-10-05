import { test, expect } from "@playwright/test";

test("redirects unauthenticated requests to /login", async ({ request }) => {
  const response = await request.get("/dashboard", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/login");
});
