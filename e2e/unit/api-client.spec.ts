import { test, expect } from "@playwright/test";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import { setTokens, type CookieStore } from "@/lib/cookies";

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

test("attaches the access token and returns the response on success", async () => {
  const cookieStore = createFakeCookieStore();
  setTokens(cookieStore, { accessToken: "abc", refreshToken: "refresh-1" });

  const calls: Array<{ url: string; headers?: HeadersInit }> = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const response = await apiFetch("/users", cookieStore, {}, fetchFn);

  expect(response.status).toBe(200);
  expect(calls).toHaveLength(1);
  expect((calls[0].headers as Record<string, string>).Authorization).toBe("Bearer abc");
});

test("refreshes once and retries after a 401, rotating cookies", async () => {
  const cookieStore = createFakeCookieStore();
  setTokens(cookieStore, { accessToken: "expired", refreshToken: "refresh-1" });

  let usersCallCount = 0;
  const fetchFn = (async (url: string) => {
    if (url.endsWith("/auth/refresh")) {
      return new Response(
        JSON.stringify({ accessToken: "fresh", refreshToken: "refresh-2" }),
        { status: 200 }
      );
    }
    usersCallCount += 1;
    if (usersCallCount === 1) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const response = await apiFetch("/users", cookieStore, {}, fetchFn);

  expect(response.status).toBe(200);
  expect(usersCallCount).toBe(2);
  expect(cookieStore.get("access_token")?.value).toBe("fresh");
  expect(cookieStore.get("refresh_token")?.value).toBe("refresh-2");
});

test("throws ApiAuthError and clears cookies when refresh also fails", async () => {
  const cookieStore = createFakeCookieStore();
  setTokens(cookieStore, { accessToken: "expired", refreshToken: "bad-refresh" });

  const fetchFn = (async (url: string) => {
    if (url.endsWith("/auth/refresh")) {
      return new Response(JSON.stringify({ error: "invalid" }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }) as typeof fetch;

  await expect(apiFetch("/users", cookieStore, {}, fetchFn)).rejects.toBeInstanceOf(
    ApiAuthError
  );
  expect(cookieStore.get("access_token")).toBeUndefined();
  expect(cookieStore.get("refresh_token")).toBeUndefined();
});

test("skipAuth sends no Authorization header and never refreshes", async () => {
  const cookieStore = createFakeCookieStore();
  const calls: string[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    expect((init?.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  await apiFetch("/auth/login", cookieStore, { method: "POST", skipAuth: true }, fetchFn);

  expect(calls).toHaveLength(1);
});
