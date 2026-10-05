import { test, expect } from "@playwright/test";

test("full users CRUD lifecycle via the BFF routes", async ({ request }) => {
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  const login = await request.post("/api/auth/login", { data: { email, password } });
  expect(login.status()).toBe(204);

  const uniqueEmail = `e2e-${Date.now()}@example.com`;
  const created = await request.post("/api/users", {
    data: { name: "E2E Test User", email: uniqueEmail, role: "viewer" },
  });
  expect(created.status()).toBe(201);
  const user = await created.json();
  expect(user.email).toBe(uniqueEmail);

  const fetched = await request.get(`/api/users/${user.id}`);
  expect(fetched.status()).toBe(200);

  const updated = await request.patch(`/api/users/${user.id}`, {
    data: { name: "E2E Test User Updated" },
  });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).name).toBe("E2E Test User Updated");

  const list = await request.get("/api/users?limit=50&skip=0");
  expect(list.status()).toBe(200);
  const listBody = (await list.json()) as Array<{ id: string }>;
  expect(listBody.some((u) => u.id === user.id)).toBe(true);

  const deactivated = await request.delete(`/api/users/${user.id}`);
  expect(deactivated.status()).toBe(204);
});

test("rejects unauthenticated requests with 401", async ({ request }) => {
  const response = await request.get("/api/users");
  expect(response.status()).toBe(401);
});
