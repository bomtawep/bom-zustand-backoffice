import { test, expect } from "@playwright/test";
import { useSessionStore } from "@/stores/session-store";
import type { MeResponse } from "@/types/api";

const baseUser: MeResponse = {
  id: "1",
  name: "Ada",
  email: "ada@example.com",
  role: "admin",
  active: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  permissions: ["user:read", "user:create"],
};

test.afterEach(() => {
  useSessionStore.getState().clear();
});

test("setUser stores the user and hasPermission reflects their permissions", () => {
  useSessionStore.getState().setUser(baseUser);

  expect(useSessionStore.getState().user?.email).toBe("ada@example.com");
  expect(useSessionStore.getState().hasPermission("user:create")).toBe(true);
  expect(useSessionStore.getState().hasPermission("user:delete")).toBe(false);
});

test("clear resets the user and hasPermission returns false", () => {
  useSessionStore.getState().setUser(baseUser);
  useSessionStore.getState().clear();

  expect(useSessionStore.getState().user).toBeNull();
  expect(useSessionStore.getState().hasPermission("user:read")).toBe(false);
});
