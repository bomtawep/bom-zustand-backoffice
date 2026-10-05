import { test, expect } from "@playwright/test";
import { clearTokens, getTokens, setTokens, type CookieStore } from "@/lib/cookies";

function createFakeCookieStore(): CookieStore {
  const store = new Map<string, string>();
  return {
    get: (name) => (store.has(name) ? { value: store.get(name)! } : undefined),
    set: (name, value) => {
      store.set(name, value);
    },
    delete: (name) => {
      store.delete(name);
    },
  };
}

test("setTokens then getTokens round-trips both tokens", () => {
  const cookieStore = createFakeCookieStore();
  setTokens(cookieStore, { accessToken: "access-1", refreshToken: "refresh-1" });

  const tokens = getTokens(cookieStore);
  expect(tokens.accessToken).toBe("access-1");
  expect(tokens.refreshToken).toBe("refresh-1");
});

test("getTokens returns undefined values when nothing is set", () => {
  const cookieStore = createFakeCookieStore();
  const tokens = getTokens(cookieStore);
  expect(tokens.accessToken).toBeUndefined();
  expect(tokens.refreshToken).toBeUndefined();
});

test("clearTokens removes both cookies", () => {
  const cookieStore = createFakeCookieStore();
  setTokens(cookieStore, { accessToken: "access-1", refreshToken: "refresh-1" });
  clearTokens(cookieStore);

  const tokens = getTokens(cookieStore);
  expect(tokens.accessToken).toBeUndefined();
  expect(tokens.refreshToken).toBeUndefined();
});
