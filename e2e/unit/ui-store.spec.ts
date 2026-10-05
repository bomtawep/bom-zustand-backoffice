import { test, expect } from "@playwright/test";
import { useUiStore } from "@/stores/ui-store";

test("toggleSidebar flips sidebarCollapsed", () => {
  expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  useUiStore.getState().toggleSidebar();
  expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  useUiStore.getState().toggleSidebar();
  expect(useUiStore.getState().sidebarCollapsed).toBe(false);
});
