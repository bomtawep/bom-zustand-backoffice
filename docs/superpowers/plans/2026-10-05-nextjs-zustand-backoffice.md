# bom-zustand-backoffice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Next.js admin backoffice for `bom-tanstack-api` (auth + users CRUD) with Zustand (client state), TanStack Query (server state), shadcn/ui, ESLint/Prettier, a `CLAUDE.md` rule file, and Playwright for both unit and E2E testing.

**Architecture:** The browser never calls the Go API directly. Every authenticated request is proxied through a Next.js Route Handler (`src/app/api/**`) that reads `access_token`/`refresh_token` httpOnly cookies, attaches the bearer token, and silently refreshes-and-retries once on a 401. `src/proxy.ts` (Next.js 16's renamed `middleware.ts` convention) guards everything except `/login`, `/forgot-password`, `/reset-password`.

**Tech Stack:** Next.js (App Router, TypeScript strict), yarn, Tailwind CSS v4, shadcn/ui (new-york), Zustand, @tanstack/react-query, react-hook-form + zod, ESLint + Prettier, @playwright/test (unit + E2E).

Full design background and the API contract are in `docs/superpowers/specs/2026-10-05-nextjs-zustand-backoffice-design.md` — read it for the "why" behind each decision below.

## Global Constraints

- **Node version is pinned to 22.20.0 via `.nvmrc`** (added in Task 1) — the machine's default Node (20.11.1) is too old for this toolchain's dependencies. Run `nvm use` (or `source ~/.nvm/nvm.sh && nvm use` if `nvm` isn't loaded as a shell function) before any `yarn`/`node` command in this repo.
- Package manager is **yarn** everywhere — never `npm`/`pnpm` commands. Use `yarn create next-app` (no `@latest` suffix — yarn classic 1.22.x's `create` command mishandles it) when a command needs it. Yarn Classic 1.22.19 has no `dlx` — use `npx` (bundled with Node) for one-off package runners like the shadcn CLI; this doesn't change the package manager for `add`/`install`/`build`/etc.
- shadcn/ui's CLI no longer has "new-york"/"default" styles — it uses presets (`nova`, `vega`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`) paired with a base library (`base`/Base UI, `radix`/Radix UI, `aria`/Ariakit). This project uses **preset `nova` on Base UI** (`"style": "base-nova"` in `components.json`), which is also the CLI's own `-d/--defaults` choice.
- Base UI's composition primitive is a **`render` prop** (`render={<SomeElement />}` or a render function), not Radix's `asChild` boolean. Never write `<Button asChild><Link .../></Button>` or `<SomeTrigger asChild><Button /></SomeTrigger>` — Base UI silently ignores the unknown `asChild` prop and renders its own wrapper element around the children, producing invalid nested interactive elements (e.g. a `<button>` inside a `<button>`) that break role-based test selectors with a Playwright strict-mode violation ("resolved to 2 elements"). Always use `<Button render={<Link .../>} />` / `<SomeTrigger render={<Button>...</Button>} />` instead — Base UI merges its own props onto that single element.
- Next.js App Router + TypeScript strict mode. `cookies()` and dynamic route `params` are **async** (`await cookies()`, `params: Promise<{...}>`) — this project targets a Next.js version where that's required.
- Tailwind CSS v4 + shadcn/ui, **new-york** style.
- State: **Zustand** for client/UI state only. **@tanstack/react-query** for all server state. No other data-fetching library.
- Validation: **zod** + **react-hook-form** + **@hookform/resolvers** for every form.
- Testing: **@playwright/test only** — no Vitest/Jest. It runs both Node-only unit tests (`e2e/unit/**`, no browser) and browser E2E tests (`e2e/no-auth/**`, `e2e/auth/**`) and API-only tests (`e2e/api/**`, via the `request` fixture, no browser).
- Auth cookies are named exactly `access_token` and `refresh_token`, both httpOnly/secure(prod)/sameSite=lax/path=/.
- `API_BASE_URL` env var (default `http://localhost:8080/api/v1`) points at the Go backend. `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` env vars provide E2E login credentials for a seeded account with all `user:*` permissions — these must be supplied by the user before running `yarn test:e2e`; this plan does not create that account.
- The Users list has no search/filter — the API only supports `limit`/`skip` pagination.
- **Never create git commits during or after implementation unless the user explicitly asks.** This is codified in `CLAUDE.md` in Task 19.
- Two deviations from the design spec, both intentional (YAGNI): (1) no `/api/auth/refresh` route handler is exposed to the client — refresh happens internally inside `lib/api-client.ts` on every proxied call, so there's nothing for the client to call directly; (2) the dashboard route group uses a plain `dashboard/` segment (not a parenthesized `(dashboard)` group) so routes are explicitly `/dashboard`, `/dashboard/users`, etc.
- Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts` (file and exported function renamed from `middleware` to `proxy`; same `NextRequest`/`NextResponse`/`config.matcher` API otherwise). This project uses `src/proxy.ts`, never `middleware.ts`.

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create: entire initial Next.js scaffold (`src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `next.config.ts`, `tsconfig.json`, `package.json`, etc.)

**Interfaces:**
- Produces: a running `yarn dev` server on port 3000, `yarn build` / `yarn lint` scripts.

- [ ] **Step 1: Run create-next-app into the current directory**

The directory currently only contains `README.md`, `LICENSE`, `.gitignore`, `.git`, and `docs/` — all on create-next-app's allowed-files list, so it will scaffold in place without complaint.

Run:
```bash
yarn create next-app . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --turbopack --use-yarn
```

(`yarn create next-app` without a pinned `@latest` — yarn classic 1.22.x mishandles the `@latest` suffix on `yarn create` and fails with "command not found"; omitting it still resolves the latest published version from the registry.)

- [ ] **Step 2: Verify the dev server boots**

Run: `yarn build`
Expected: build completes with no errors (the default scaffolded homepage compiles).

- [ ] **Step 3: Replace the default homepage with a placeholder that will be overwritten later**

Edit `src/app/page.tsx`:
```tsx
export default function RootPage() {
  return null;
}
```

(This route is unused — real traffic lands on `/login` or `/dashboard` via `src/proxy.ts` in Task 9. It's kept minimal rather than deleted because Next.js requires a root `page.tsx`.)

- [ ] **Step 4: Commit is NOT performed here**

Per the Global Constraints, do not run `git add`/`git commit` at the end of this or any later task unless the user explicitly asks in that turn.

---

### Task 2: Lint, format, and test tooling

**Files:**
- Modify: `eslint.config.mjs`
- Create: `.prettierrc.json`, `.prettierignore`, `playwright.config.ts`, `e2e/unit/smoke.spec.ts`
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Produces: `yarn lint`, `yarn test:unit` scripts; the `unit` Playwright project other tasks will add spec files to.

- [ ] **Step 1: Install dev dependencies**

```bash
yarn add -D prettier eslint-config-prettier @playwright/test
```

- [ ] **Step 2: Extend ESLint with Prettier**

Replace `eslint.config.mjs` entirely — do not keep the `FlatCompat`/`compat.extends(...)` pattern create-next-app scaffolded. `eslint-config-next@16.x` ships native flat-config exports, and routing them through `FlatCompat.extends()` crashes with `TypeError: Converting circular structure to JSON` (a bug in `@eslint/eslintrc`'s error-formatting path when it tries to validate an already-flat plugin object that has circular self-references). Import the flat configs directly instead:

```js
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, eslintConfigPrettier];

export default eslintConfig;
```

This makes the `@eslint/eslintrc` package unnecessary — do not add it as a dependency (if it's already installed, remove it).

- [ ] **Step 3: Add Prettier config**

Create `.prettierrc.json`:
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "tabWidth": 2
}
```

Create `.prettierignore`:
```
.next
node_modules
playwright-report
test-results
```

- [ ] **Step 4: Install Playwright's browser binary**

```bash
yarn playwright install --with-deps chromium
```

- [ ] **Step 5: Add the initial Playwright config (unit project only — more projects arrive in Task 9)**

Create `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "yarn dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "unit", testDir: "./e2e/unit" }],
});
```

- [ ] **Step 6: Add a smoke test**

Create `e2e/unit/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("playwright unit project runs", () => {
  expect(1 + 1).toBe(2);
});
```

(This file is deleted in Task 5 once real unit tests exist — it only proves the harness is wired up.)

- [ ] **Step 7: Add package.json scripts**

Edit `package.json`, in `"scripts"` add:
```json
"test:unit": "playwright test --project=unit"
```

- [ ] **Step 8: Ignore Playwright output**

Edit `.gitignore`, append:
```

# playwright
/playwright-report
/test-results
/playwright/.auth
```

- [ ] **Step 9: Verify**

Run: `yarn lint`
Expected: no errors.

Run: `yarn test:unit`
Expected: `1 passed`.

---

### Task 3: shadcn/ui setup

**Files:**
- Create: `components.json`, `src/components/ui/*` (generated), `src/lib/utils.ts` (generated)

**Interfaces:**
- Produces: `cn()` helper from `@/lib/utils`, and the shadcn primitives listed below under `@/components/ui/*`.

- [ ] **Step 1: Initialize shadcn/ui**

Use `npx`, not `yarn dlx` — Yarn Classic 1.22.19 (this project's package manager) has no `dlx` command.

```bash
npx shadcn@latest init -d
```
(The shadcn CLI no longer has "new-york"/"default" styles — it uses named presets (`nova`, `vega`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`) paired with a base component library (`base`/Base UI, `radix`/Radix UI, `aria`/Ariakit). `-d`/`--defaults` picks `--preset=base-nova`, i.e. preset `nova` on Base UI — confirm the generated `components.json` has `"style": "base-nova"`. This is the approved choice: Base UI is shadcn's current forward-looking default.)

- [ ] **Step 2: Add every primitive the app will use**

```bash
npx shadcn@latest add button input label field select table card dialog alert-dialog dropdown-menu avatar badge separator sonner skeleton
```

(`field`, not `form` — the current shadcn registry's `form` entry is an empty stub; the old react-hook-form-wrapped `Form`/`FormField`/`FormControl`/`FormItem`/`FormLabel`/`FormMessage` components no longer exist. They're replaced by generic `Field`/`FieldLabel`/`FieldError`/`FieldGroup`/etc. layout primitives from `@/components/ui/field`, composed directly with react-hook-form's own `register()`/`Controller`/`formState.errors` — every form task below (12, 13, 15, 18) already uses this pattern.)

- [ ] **Step 3: Verify**

Run: `yarn build`
Expected: build still succeeds (no pages use these components yet, but the generated files must compile).

---

### Task 4: State/data dependencies and app providers

**Files:**
- Create: `src/app/providers.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `<Providers>` component wrapping the app in `QueryClientProvider` + the shadcn `Toaster`.

- [ ] **Step 1: Install dependencies**

```bash
yarn add zustand @tanstack/react-query zod react-hook-form @hookform/resolvers
```

- [ ] **Step 2: Create the providers wrapper**

Create `src/app/providers.tsx`:
```tsx
"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Wire it into the root layout**

Edit `src/app/layout.tsx` to match:
```tsx
import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Backoffice",
  description: "Admin backoffice for bom-tanstack-api",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify**

Run: `yarn build`
Expected: build succeeds.

---

### Task 5: API types and zod schemas

**Files:**
- Create: `src/types/api.ts`, `src/lib/schemas.ts`
- Test: `e2e/unit/schemas.spec.ts`
- Delete: `e2e/unit/smoke.spec.ts`

**Interfaces:**
- Produces: `Role`, `Permission`, `User`, `MeResponse`, `TokenResponse`, `ErrorResponse`, `MessageResponse` types from `@/types/api`; `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `changePasswordSchema`, `createUserSchema`, `updateUserSchema`, `ROLES` and their inferred `*Input` types from `@/lib/schemas`.

- [ ] **Step 1: Write the failing test**

Create `e2e/unit/schemas.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import {
  changePasswordSchema,
  createUserSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/schemas";

test("loginSchema rejects an invalid email", () => {
  const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
  expect(result.success).toBe(false);
});

test("loginSchema accepts a valid payload", () => {
  const result = loginSchema.safeParse({ email: "a@b.com", password: "secret" });
  expect(result.success).toBe(true);
});

test("createUserSchema rejects an invalid role", () => {
  const result = createUserSchema.safeParse({
    name: "Ada",
    email: "ada@example.com",
    role: "superadmin",
  });
  expect(result.success).toBe(false);
});

test("resetPasswordSchema rejects mismatched passwords", () => {
  const result = resetPasswordSchema.safeParse({
    token: "t",
    newPassword: "longenough1",
    confirmPassword: "different1",
  });
  expect(result.success).toBe(false);
});

test("changePasswordSchema rejects a new password shorter than 8 characters", () => {
  const result = changePasswordSchema.safeParse({
    oldPassword: "current",
    newPassword: "short",
    confirmPassword: "short",
  });
  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=unit schemas.spec.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas'`.

- [ ] **Step 3: Write `src/types/api.ts`**

```ts
export type Role = "admin" | "manager" | "staff" | "viewer";

export type Permission =
  | "user:create"
  | "user:read"
  | "user:update"
  | "user:delete";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeResponse extends User {
  permissions: Permission[];
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ErrorResponse {
  error: string;
}

export interface MessageResponse {
  message: string;
}
```

- [ ] **Step 4: Write `src/lib/schemas.ts`**

Use `z.email(...)`, not `z.string().email(...)` — zod v4 (installed in Task 4) deprecates the chained form in favor of the top-level `z.email()` schema.

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const ROLES = ["admin", "manager", "staff", "viewer"] as const;

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
  role: z.enum(ROLES),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.email("Enter a valid email address").optional(),
  role: z.enum(ROLES).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

- [ ] **Step 5: Delete the smoke test**

```bash
rm e2e/unit/smoke.spec.ts
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: 5 passed.

---

### Task 6: Cookie helpers

**Files:**
- Create: `src/lib/cookies.ts`
- Test: `e2e/unit/cookies.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ACCESS_TOKEN_COOKIE`, `REFRESH_TOKEN_COOKIE` constants, `CookieStore` and `TokenPair` types, `getTokens(cookieStore)`, `setTokens(cookieStore, tokens)`, `clearTokens(cookieStore)` from `@/lib/cookies`. `CookieStore` is a minimal structural interface (`get`/`set`/`delete`) that Next's real `cookies()` return value satisfies, and that tests satisfy with an in-memory fake — these functions never call `next/headers` directly, which is what keeps them unit-testable.

- [ ] **Step 1: Write the failing test**

Create `e2e/unit/cookies.spec.ts`:
```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=unit cookies.spec.ts`
Expected: FAIL — `Cannot find module '@/lib/cookies'`.

- [ ] **Step 3: Implement `src/lib/cookies.ts`**

```ts
export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export interface CookieStore {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export function getTokens(cookieStore: CookieStore): Partial<TokenPair> {
  return {
    accessToken: cookieStore.get(ACCESS_TOKEN_COOKIE)?.value,
    refreshToken: cookieStore.get(REFRESH_TOKEN_COOKIE)?.value,
  };
}

export function setTokens(cookieStore: CookieStore, tokens: TokenPair): void {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearTokens(cookieStore: CookieStore): void {
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: all unit tests pass (8 total so far).

---

### Task 7: API client with refresh-and-retry

**Files:**
- Create: `src/lib/api-client.ts`
- Test: `e2e/unit/api-client.spec.ts`

**Interfaces:**
- Consumes: `getTokens`, `setTokens`, `clearTokens`, `CookieStore` from `@/lib/cookies`.
- Produces: `ApiFetchOptions`, `FetchFn`, `ApiAuthError` class, `apiFetch(path, cookieStore, options?, fetchFn?)` from `@/lib/api-client`. `apiFetch` throws `ApiAuthError` when both the original call and the refresh attempt fail with 401 — callers (route handlers) catch this and return a 401 response.

- [ ] **Step 1: Write the failing test**

Create `e2e/unit/api-client.spec.ts`:
```ts
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

test("skipAuth strips a caller-supplied Authorization header instead of just skipping auto-attach", async () => {
  const cookieStore = createFakeCookieStore();
  const fetchFn = (async (_url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  await apiFetch(
    "/auth/login",
    cookieStore,
    { method: "POST", skipAuth: true, headers: { Authorization: "Bearer stray-token" } },
    fetchFn
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=unit api-client.spec.ts`
Expected: FAIL — `Cannot find module '@/lib/api-client'`.

- [ ] **Step 3: Implement `src/lib/api-client.ts`**

```ts
import { clearTokens, getTokens, setTokens, type CookieStore } from "./cookies";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export type FetchFn = typeof fetch;

export class ApiAuthError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "ApiAuthError";
  }
}

async function refreshTokens(
  cookieStore: CookieStore,
  fetchFn: FetchFn
): Promise<string | null> {
  const { refreshToken } = getTokens(cookieStore);
  if (!refreshToken) return null;

  const response = await fetchFn(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens(cookieStore);
    return null;
  }

  const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
  setTokens(cookieStore, tokens);
  return tokens.accessToken;
}

export async function apiFetch(
  path: string,
  cookieStore: CookieStore,
  options: ApiFetchOptions = {},
  fetchFn: FetchFn = fetch
): Promise<Response> {
  const { skipAuth, headers, ...rest } = options;
  const url = `${API_BASE_URL}${path}`;

  const buildHeaders = (accessToken?: string): HeadersInit => {
    const merged: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers as Record<string, string> | undefined),
    };
    if (accessToken) {
      merged.Authorization = `Bearer ${accessToken}`;
    } else {
      delete merged.Authorization;
    }
    return merged;
  };

  if (skipAuth) {
    return fetchFn(url, { ...rest, headers: buildHeaders() });
  }

  const { accessToken } = getTokens(cookieStore);
  const first = await fetchFn(url, { ...rest, headers: buildHeaders(accessToken) });

  if (first.status !== 401) return first;

  const newAccessToken = await refreshTokens(cookieStore, fetchFn);
  if (!newAccessToken) {
    throw new ApiAuthError();
  }

  return fetchFn(url, { ...rest, headers: buildHeaders(newAccessToken) });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: all unit tests pass (12 total so far).

---

### Task 8: Auth route handlers

**Files:**
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/logout-all/route.ts`, `src/app/api/auth/me/route.ts`, `src/app/api/auth/change-password/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiAuthError` (`@/lib/api-client`), `getTokens`, `setTokens`, `clearTokens` (`@/lib/cookies`), `ErrorResponse`, `TokenResponse`, `MeResponse`, `MessageResponse` (`@/types/api`).
- Produces: `POST /api/auth/login` (204, sets cookies), `POST /api/auth/logout` (204, clears cookies), `POST /api/auth/logout-all` (204, clears cookies), `GET /api/auth/me` (200 `MeResponse` | 401), `POST /api/auth/change-password` (204 | 400 | 401), `POST /api/auth/forgot-password` (200 `MessageResponse` | 400), `POST /api/auth/reset-password` (204 | 400).

- [ ] **Step 1: Login route**

Create `src/app/api/auth/login/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api-client";
import { setTokens } from "@/lib/cookies";
import type { ErrorResponse, TokenResponse } from "@/types/api";

export async function POST(request: Request) {
  const body = await request.json();
  const cookieStore = await cookies();

  const response = await apiFetch("/auth/login", cookieStore, {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    return NextResponse.json(error, { status: response.status });
  }

  const tokens = (await response.json()) as TokenResponse;
  setTokens(cookieStore, tokens);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: Logout route**

Create `src/app/api/auth/logout/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api-client";
import { clearTokens, getTokens } from "@/lib/cookies";

export async function POST() {
  const cookieStore = await cookies();
  const { refreshToken } = getTokens(cookieStore);

  if (refreshToken) {
    await apiFetch("/auth/logout", cookieStore, {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });
  }

  clearTokens(cookieStore);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Logout-all route**

Create `src/app/api/auth/logout-all/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import { clearTokens } from "@/lib/cookies";

export async function POST() {
  const cookieStore = await cookies();

  try {
    await apiFetch("/auth/logout-all", cookieStore, { method: "POST" });
  } catch (error) {
    if (!(error instanceof ApiAuthError)) throw error;
  }

  clearTokens(cookieStore);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 4: Me route**

Create `src/app/api/auth/me/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import type { ErrorResponse, MeResponse } from "@/types/api";

export async function GET() {
  const cookieStore = await cookies();

  try {
    const response = await apiFetch("/auth/me", cookieStore, { method: "GET" });
    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      return NextResponse.json(error, { status: response.status });
    }
    const me = (await response.json()) as MeResponse;
    return NextResponse.json(me, { status: 200 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
```

- [ ] **Step 5: Change-password route**

Create `src/app/api/auth/change-password/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import type { ErrorResponse } from "@/types/api";

export async function POST(request: Request) {
  const body = await request.json();
  const cookieStore = await cookies();

  try {
    const response = await apiFetch("/auth/change-password", cookieStore, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      return NextResponse.json(error, { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
```

- [ ] **Step 6: Forgot-password route**

Create `src/app/api/auth/forgot-password/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api-client";
import type { ErrorResponse, MessageResponse } from "@/types/api";

export async function POST(request: Request) {
  const body = await request.json();
  const cookieStore = await cookies();

  const response = await apiFetch("/auth/forgot-password", cookieStore, {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });

  const data = (await response.json()) as MessageResponse | ErrorResponse;
  return NextResponse.json(data, { status: response.status });
}
```

- [ ] **Step 7: Reset-password route**

Create `src/app/api/auth/reset-password/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api-client";
import type { ErrorResponse } from "@/types/api";

export async function POST(request: Request) {
  const body = await request.json();
  const cookieStore = await cookies();

  const response = await apiFetch("/auth/reset-password", cookieStore, {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    return NextResponse.json(error, { status: response.status });
  }

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 8: Verify**

Run: `yarn build`
Expected: build succeeds (full E2E verification of these routes happens in Task 12, once `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are available and the login page exists).

---

### Task 9: Proxy route guard + Playwright API project

**Files:**
- Create: `src/proxy.ts`
- Modify: `playwright.config.ts`, `package.json` (scripts)
- Test: `e2e/api/proxy.spec.ts`

**Interfaces:**
- Produces: redirect-to-`/login` behavior for any unauthenticated request outside `/login`, `/forgot-password`, `/reset-password`; redirect-to-`/dashboard` for authenticated requests to those public paths. Introduces the `api`, `setup`, `unauthenticated`, `authenticated` Playwright projects that later tasks' specs plug into.

Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts` (same `NextRequest`/`NextResponse`/`config.matcher` API, just the file and exported function are renamed from `middleware` to `proxy`). Use `proxy.ts`, not `middleware.ts`.

- [ ] **Step 1: Write the failing test**

Create `e2e/api/proxy.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("redirects unauthenticated requests to /login", async ({ request }) => {
  const response = await request.get("/dashboard", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/login");
});
```

- [ ] **Step 2: Expand the Playwright config to add the `api` project**

Replace `playwright.config.ts` with:
```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "yarn dev",
    url: "http://localhost:3000/api/auth/me",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "unit", testDir: "./e2e/unit" },
    { name: "api", testDir: "./e2e/api" },
    {
      name: "setup",
      testDir: "./e2e",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "unauthenticated",
      testDir: "./e2e/no-auth",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testDir: "./e2e/auth",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
```

(The `setup`/`unauthenticated`/`authenticated` projects have no matching spec files yet — that's fine, they're only invoked by name in later tasks, never as part of `--project=api` which this task's verification uses. The `webServer.url` health check points at `/api/auth/me` rather than `/` — root `/` goes through the proxy's redirect logic once it exists, and an API route bypasses that entirely for a simpler, unambiguous readiness probe.)

- [ ] **Step 3: Run it to verify it fails**

Run: `yarn playwright test --project=api`
Expected: FAIL — connection/404 behavior, since `proxy.ts` doesn't exist yet (the request falls through to the default Next 404, status 404, no `location` header).

- [ ] **Step 4: Implement the proxy**

Create `src/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = request.cookies.has("access_token");
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!hasAccessToken && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasAccessToken && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Add the `test:e2e` and `test` scripts**

Edit `package.json`, in `"scripts"` add (next to the existing `test:unit`):
```json
"test:e2e": "playwright test --project=api --project=setup --project=unauthenticated --project=authenticated",
"test": "playwright test"
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `yarn playwright test --project=api`
Expected: 1 passed.

---

### Task 10: Zustand stores

**Files:**
- Create: `src/stores/session-store.ts`, `src/stores/ui-store.ts`
- Test: `e2e/unit/session-store.spec.ts`, `e2e/unit/ui-store.spec.ts`

**Interfaces:**
- Consumes: `MeResponse`, `Permission` from `@/types/api`.
- Produces: `useSessionStore` (state: `user: MeResponse | null`; actions: `setUser(user)`, `clear()`, `hasPermission(permission)`) from `@/stores/session-store`. `useUiStore` (state: `sidebarCollapsed: boolean`; action: `toggleSidebar()`) from `@/stores/ui-store`.

- [ ] **Step 1: Write the failing tests**

Create `e2e/unit/session-store.spec.ts`:
```ts
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
```

Create `e2e/unit/ui-store.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { useUiStore } from "@/stores/ui-store";

test("toggleSidebar flips sidebarCollapsed", () => {
  expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  useUiStore.getState().toggleSidebar();
  expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  useUiStore.getState().toggleSidebar();
  expect(useUiStore.getState().sidebarCollapsed).toBe(false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `yarn playwright test --project=unit session-store.spec.ts ui-store.spec.ts`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement `src/stores/session-store.ts`**

```ts
import { create } from "zustand";
import type { MeResponse, Permission } from "@/types/api";

interface SessionState {
  user: MeResponse | null;
  setUser: (user: MeResponse) => void;
  clear: () => void;
  hasPermission: (permission: Permission) => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
  hasPermission: (permission) => get().user?.permissions.includes(permission) ?? false,
}));
```

- [ ] **Step 4: Implement `src/stores/ui-store.ts`**

Note the SSR/Node-safe storage fallback — without it, `persist` would throw wherever `localStorage` is undefined (server-side rendering, or this project's Node-only unit tests).

```ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const storage = createJSONStorage(() =>
  typeof window !== "undefined"
    ? window.localStorage
    : {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }
);

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    { name: "ui-store", storage }
  )
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test:unit`
Expected: all unit tests pass (16 total so far).

---

### Task 11: Shared query helper + auth query hooks

**Files:**
- Create: `src/lib/query-helpers.ts`, `src/queries/auth.ts`
- Test: `e2e/unit/query-helpers.spec.ts`

**Interfaces:**
- Consumes: `ErrorResponse`, `MeResponse` (`@/types/api`), `useSessionStore` (`@/stores/session-store`), `LoginInput`, `ForgotPasswordInput`, `ResetPasswordInput`, `ChangePasswordInput` (`@/lib/schemas`).
- Produces: `parseJsonOrThrow<T>(response)` from `@/lib/query-helpers` (shared by `queries/auth.ts` and `queries/users.ts` in Task 17 — DRY). `useMeQuery()`, `useLoginMutation()`, `useLogoutMutation()`, `useLogoutAllMutation()`, `useChangePasswordMutation()`, `useForgotPasswordMutation()`, `useResetPasswordMutation()` from `@/queries/auth`.

- [ ] **Step 1: Write the failing test**

Create `e2e/unit/query-helpers.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { parseJsonOrThrow } from "@/lib/query-helpers";

test("returns parsed JSON when the response is ok", async () => {
  const response = new Response(JSON.stringify({ hello: "world" }), { status: 200 });
  await expect(parseJsonOrThrow<{ hello: string }>(response)).resolves.toEqual({
    hello: "world",
  });
});

test("throws the error message from the body when the response is not ok", async () => {
  const response = new Response(JSON.stringify({ error: "nope" }), { status: 400 });
  await expect(parseJsonOrThrow(response)).rejects.toThrow("nope");
});

test("falls back to a generic message when the body has no error field", async () => {
  const response = new Response(JSON.stringify({}), { status: 500 });
  await expect(parseJsonOrThrow(response)).rejects.toThrow("Request failed");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=unit query-helpers.spec.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/query-helpers.ts`**

```ts
import type { ErrorResponse } from "@/types/api";

export async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data as ErrorResponse).error ?? "Request failed");
  }
  return data as T;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:unit`
Expected: all unit tests pass (19 total so far).

- [ ] **Step 5: Implement `src/queries/auth.ts`**

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/query-helpers";
import { useSessionStore } from "@/stores/session-store";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from "@/lib/schemas";
import type { ErrorResponse, MeResponse, MessageResponse } from "@/types/api";

export function useMeQuery() {
  const setUser = useSessionStore((state) => state.setUser);

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      const me = await parseJsonOrThrow<MeResponse>(response);
      setUser(me);
      return me;
    },
    retry: false,
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new Error(error.error ?? "Login failed");
      }
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clear);

  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

export function useLogoutAllMutation() {
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clear);

  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout-all", { method: "POST" });
    },
    onSuccess: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new Error(error.error ?? "Could not change password");
      }
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<MessageResponse>(response);
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: input.token, newPassword: input.newPassword }),
      });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new Error(error.error ?? "Could not reset password");
      }
    },
  });
}
```

- [ ] **Step 6: Verify**

Run: `yarn build`
Expected: build succeeds (these hooks aren't wired into any page until Tasks 12–15).

---

### Task 12: Login page + Playwright auth setup

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `e2e/auth.setup.ts`
- Test: `e2e/no-auth/auth.spec.ts`

**Interfaces:**
- Consumes: `useLoginMutation` (`@/queries/auth`), `loginSchema`/`LoginInput` (`@/lib/schemas`), shadcn `Button`/`Input`/`Field*`.
- Produces: `/login` page; `playwright/.auth/user.json` storage state file (written by `auth.setup.ts`, consumed by the `authenticated` project's `dependencies: ["setup"]`).

- [ ] **Step 1: Write the failing E2E test**

Create `e2e/no-auth/auth.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("redirects unauthenticated users from a protected route to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("shows an error on invalid credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid|unauthorized|failed/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("logs in with valid credentials and can log out", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=unauthenticated`
Expected: FAIL — `/login` doesn't exist (and the first test fails too since the proxy redirects to a 404 `/login`).

- [ ] **Step 3: Implement the login page**

Create `src/app/(auth)/login/page.tsx`:
```tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { useLoginMutation } from "@/queries/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginMutation = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    try {
      await loginMutation.mutateAsync(values);
      router.push(searchParams.get("next") ?? "/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </FieldGroup>
      </form>
      <a href="/forgot-password" className="block text-center text-sm text-muted-foreground">
        Forgot your password?
      </a>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Add the Playwright auth setup project file**

Create `e2e/auth.setup.ts`:
```ts
import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set to run E2E tests");
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: authFile });
});
```

- [ ] **Step 5: Run the test to verify it passes**

This requires the real backend running at `API_BASE_URL` and `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` set (the "Sign out" button doesn't exist until Task 14 — temporarily skip the third test by running only the first two, or proceed to Task 14 first if you want all three green immediately; either order is fine since each task's own verification only needs what that task built).

Run: `yarn playwright test --project=unauthenticated -g "redirects unauthenticated|invalid credentials"`
Expected: 2 passed.

---

### Task 13: Password recovery pages

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx`
- Test: `e2e/no-auth/password-recovery.spec.ts`

**Interfaces:**
- Consumes: `useForgotPasswordMutation`, `useResetPasswordMutation` (`@/queries/auth`), `forgotPasswordSchema`, `resetPasswordSchema` (`@/lib/schemas`).
- Produces: `/forgot-password`, `/reset-password` pages.

- [ ] **Step 1: Write the failing test**

Create `e2e/no-auth/password-recovery.spec.ts`:
```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=unauthenticated password-recovery.spec.ts`
Expected: FAIL — pages don't exist.

- [ ] **Step 3: Implement the forgot-password page**

Create `src/app/(auth)/forgot-password/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/schemas";
import { useForgotPasswordMutation } from "@/queries/auth";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const forgotPasswordMutation = useForgotPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    await forgotPasswordMutation.mutateAsync(values);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              <FieldError errors={[errors.email]} />
            </Field>
            <Button type="submit" className="w-full" disabled={forgotPasswordMutation.isPending}>
              Send reset link
            </Button>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement the reset-password page**

Create `src/app/(auth)/reset-password/page.tsx`:
```tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/schemas";
import { useResetPasswordMutation } from "@/queries/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetPasswordMutation = useResetPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: searchParams.get("token") ?? "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ResetPasswordInput) {
    try {
      await resetPasswordMutation.mutateAsync(values);
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset password");
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field data-invalid={!!errors.newPassword}>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
            />
            <FieldError errors={[errors.newPassword]} />
          </Field>
          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
          <Button type="submit" className="w-full" disabled={resetPasswordMutation.isPending}>
            Reset password
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn playwright test --project=unauthenticated password-recovery.spec.ts`
Expected: 2 passed.

---

### Task 14: Dashboard shell

**Files:**
- Create: `src/components/layout/sidebar-nav.tsx`, `src/components/layout/topbar.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`
- Test: `e2e/auth/dashboard.spec.ts`

**Interfaces:**
- Consumes: `useMeQuery`, `useLogoutMutation` (`@/queries/auth`), `cn` (`@/lib/utils`).
- Produces: `/dashboard` shell layout (sidebar + topbar) wrapping `/dashboard`, `/dashboard/users*`, `/dashboard/profile`.

- [ ] **Step 1: Write the failing test**

Create `e2e/auth/dashboard.spec.ts`:
```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=setup && yarn playwright test --project=authenticated dashboard.spec.ts`
Expected: FAIL — `/dashboard` 404s (no layout/page yet).

- [ ] **Step 3: Sidebar nav component**

Create `src/components/layout/sidebar-nav.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/profile", label: "Profile" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
            pathname === item.href && "bg-accent text-accent-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Topbar component**

Create `src/components/layout/topbar.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLogoutMutation, useMeQuery } from "@/queries/auth";

export function Topbar() {
  const router = useRouter();
  const meQuery = useMeQuery();
  const logoutMutation = useLogoutMutation();

  async function handleSignOut() {
    try {
      await logoutMutation.mutateAsync();
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
    }
  }

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <span className="text-sm text-muted-foreground">
        {meQuery.data ? `Signed in as ${meQuery.data.name}` : ""}
      </span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </header>
  );
}
```

- [ ] **Step 5: Dashboard layout and placeholder home page**

Create `src/app/dashboard/layout.tsx`:
```tsx
import type { ReactNode } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r">
        <SidebarNav />
      </aside>
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

Create `src/app/dashboard/page.tsx`:
```tsx
export default function DashboardHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Welcome back. More widgets will live here as the API grows.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn playwright test --project=setup --project=authenticated`
Expected: `dashboard.spec.ts` passes. Also re-run the full `unauthenticated` project now that "Sign out" exists:

Run: `yarn playwright test --project=unauthenticated`
Expected: all 5 tests across `auth.spec.ts` and `password-recovery.spec.ts` pass.

---

### Task 15: Profile page

**Files:**
- Create: `src/app/dashboard/profile/page.tsx`
- Test: `e2e/auth/profile.spec.ts`

**Interfaces:**
- Consumes: `useMeQuery`, `useChangePasswordMutation`, `useLogoutAllMutation` (`@/queries/auth`), `changePasswordSchema`/`ChangePasswordInput` (`@/lib/schemas`).
- Produces: `/dashboard/profile` page.

- [ ] **Step 1: Write the failing test**

Create `e2e/auth/profile.spec.ts`:
```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=authenticated profile.spec.ts`
Expected: FAIL — `/dashboard/profile` 404s.

- [ ] **Step 3: Implement the profile page**

Create `src/app/dashboard/profile/page.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas";
import { useChangePasswordMutation, useLogoutAllMutation, useMeQuery } from "@/queries/auth";

export default function ProfilePage() {
  const router = useRouter();
  const meQuery = useMeQuery();
  const changePasswordMutation = useChangePasswordMutation();
  const logoutAllMutation = useLogoutAllMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    try {
      await changePasswordMutation.mutateAsync(values);
      toast.success("Password updated");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password");
    }
  }

  async function handleSignOutEverywhere() {
    await logoutAllMutation.mutateAsync();
    router.push("/login");
  }

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Name: {meQuery.data?.name}</p>
          <p>Email: {meQuery.data?.email}</p>
          <p>Role: {meQuery.data?.role}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field data-invalid={!!errors.oldPassword}>
                <FieldLabel htmlFor="oldPassword">Current password</FieldLabel>
                <Input
                  id="oldPassword"
                  type="password"
                  autoComplete="current-password"
                  {...register("oldPassword")}
                />
                <FieldError errors={[errors.oldPassword]} />
              </Field>
              <Field data-invalid={!!errors.newPassword}>
                <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register("newPassword")}
                />
                <FieldError errors={[errors.newPassword]} />
              </Field>
              <Field data-invalid={!!errors.confirmPassword}>
                <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                />
                <FieldError errors={[errors.confirmPassword]} />
              </Field>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                Update password
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Button variant="destructive" onClick={handleSignOutEverywhere}>
        Sign out everywhere
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn playwright test --project=authenticated profile.spec.ts`
Expected: 1 passed.

---

### Task 16: Users route handlers

**Files:**
- Create: `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`
- Test: `e2e/api/users.spec.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiAuthError` (`@/lib/api-client`), `createUserSchema`, `updateUserSchema` (`@/lib/schemas`), `User`, `ErrorResponse` (`@/types/api`).
- Produces: `GET /api/users?limit=&skip=`, `POST /api/users`, `GET /api/users/{id}`, `PATCH /api/users/{id}`, `DELETE /api/users/{id}`.

- [ ] **Step 1: Write the failing test**

Create `e2e/api/users.spec.ts`:
```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=api users.spec.ts`
Expected: FAIL — routes don't exist (404s).

- [ ] **Step 3: Implement the users collection route**

Create `src/app/api/users/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import { createUserSchema } from "@/lib/schemas";
import type { ErrorResponse, User } from "@/types/api";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  try {
    const response = await apiFetch(`/users${query ? `?${query}` : ""}`, cookieStore, {
      method: "GET",
    });
    const data = (await response.json()) as User[] | ErrorResponse;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const response = await apiFetch("/users", cookieStore, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    const data = (await response.json()) as User | ErrorResponse;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
```

- [ ] **Step 4: Implement the single-user route**

Create `src/app/api/users/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import { updateUserSchema } from "@/lib/schemas";
import type { ErrorResponse, User } from "@/types/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const cookieStore = await cookies();

  try {
    const response = await apiFetch(`/users/${id}`, cookieStore, { method: "GET" });
    const data = (await response.json()) as User | ErrorResponse;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const cookieStore = await cookies();
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const response = await apiFetch(`/users/${id}`, cookieStore, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    const data = (await response.json()) as User | ErrorResponse;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const cookieStore = await cookies();

  try {
    const response = await apiFetch(`/users/${id}`, cookieStore, { method: "DELETE" });
    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      return NextResponse.json(error, { status: response.status });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn playwright test --project=api`
Expected: 3 passed (proxy spec + the two users tests). Requires `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` to belong to an account with all four `user:*` permissions.

---

### Task 17: Users list page

**Files:**
- Create: `src/queries/users.ts`, `src/app/dashboard/users/page.tsx`
- Test: `e2e/auth/users-list.spec.ts`

**Interfaces:**
- Consumes: `parseJsonOrThrow` (`@/lib/query-helpers`), `useSessionStore` (`@/stores/session-store`), `CreateUserInput`/`UpdateUserInput` (`@/lib/schemas`), `User`/`ErrorResponse` (`@/types/api`).
- Produces: `useUsersQuery({limit, skip})`, `useUserQuery(id)`, `useCreateUserMutation()`, `useUpdateUserMutation(id)`, `useDeactivateUserMutation()` from `@/queries/users` (full file — Task 18 consumes the create/update/get hooks). `/dashboard/users` page.

- [ ] **Step 1: Write the failing test**

Create `e2e/auth/users-list.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("users list renders rows and supports pagination controls", async ({ page }) => {
  await page.goto("/dashboard/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();

  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=authenticated users-list.spec.ts`
Expected: FAIL — `/dashboard/users` 404s.

- [ ] **Step 3: Implement `src/queries/users.ts`**

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/query-helpers";
import type { CreateUserInput, UpdateUserInput } from "@/lib/schemas";
import type { ErrorResponse, User } from "@/types/api";

interface UsersPage {
  limit: number;
  skip: number;
}

export function useUsersQuery({ limit, skip }: UsersPage) {
  return useQuery({
    queryKey: ["users", { limit, skip }],
    queryFn: async () => {
      const response = await fetch(`/api/users?limit=${limit}&skip=${skip}`);
      return parseJsonOrThrow<User[]>(response);
    },
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: async () => {
      const response = await fetch(`/api/users/${id}`);
      return parseJsonOrThrow<User>(response);
    },
    enabled: Boolean(id),
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<User>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateUserMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<User>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeactivateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new Error(error.error ?? "Could not deactivate user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
```

- [ ] **Step 4: Implement the users list page**

Create `src/app/dashboard/users/page.tsx`:
```tsx
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeactivateUserMutation, useUsersQuery } from "@/queries/users";
import { useSessionStore } from "@/stores/session-store";

const PAGE_SIZE = 10;

function UsersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skip = Number(searchParams.get("skip") ?? "0");

  const usersQuery = useUsersQuery({ limit: PAGE_SIZE, skip });
  const deactivateMutation = useDeactivateUserMutation();
  const hasPermission = useSessionStore((state) => state.hasPermission);

  function goToPage(nextSkip: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("skip", String(Math.max(0, nextSkip)));
    router.push(`/dashboard/users?${params.toString()}`);
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateMutation.mutateAsync(id);
      toast.success("User deactivated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not deactivate user");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        {hasPermission("user:create") && (
          <Button render={<Link href="/dashboard/users/new">New user</Link>} />
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usersQuery.data?.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="capitalize">{user.role}</TableCell>
              <TableCell>
                <Badge variant={user.active ? "default" : "secondary"}>
                  {user.active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="space-x-2 text-right">
                {hasPermission("user:update") && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/dashboard/users/${user.id}`}>Edit</Link>}
                  />
                )}
                {hasPermission("user:delete") && user.active && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="destructive" size="sm">
                          Deactivate
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate {user.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This disables their account. They will no longer be able to sign in.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeactivate(user.id)}>
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={skip === 0}
          onClick={() => goToPage(skip - PAGE_SIZE)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={(usersQuery.data?.length ?? 0) < PAGE_SIZE}
          onClick={() => goToPage(skip + PAGE_SIZE)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function UsersListPage() {
  return (
    <Suspense>
      <UsersList />
    </Suspense>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn playwright test --project=authenticated users-list.spec.ts`
Expected: 1 passed.

---

### Task 18: User create/edit pages

**Files:**
- Create: `src/components/users/user-form.tsx`, `src/app/dashboard/users/new/page.tsx`, `src/app/dashboard/users/[id]/page.tsx`
- Test: `e2e/auth/users-crud.spec.ts`

**Interfaces:**
- Consumes: `useCreateUserMutation`, `useUpdateUserMutation`, `useUserQuery` (`@/queries/users`), `createUserSchema`, `ROLES`, `CreateUserInput` (`@/lib/schemas`), shadcn `Field*` (`@/components/ui/field`) + `Controller` (`react-hook-form`) for the role `Select`.
- Produces: `<UserForm>` shared component; `/dashboard/users/new`, `/dashboard/users/[id]` pages.

- [ ] **Step 1: Write the failing test**

Create `e2e/auth/users-crud.spec.ts`:
```ts
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
  const updatedRow = page.getByRole("row", { name: /UI E2E User Updated/ });
  await expect(updatedRow).toBeVisible();

  await updatedRow.getByRole("button", { name: "Deactivate" }).click();
  const confirmDialog = page.getByRole("alertdialog");
  await confirmDialog.getByRole("button", { name: "Deactivate", exact: true }).click();

  await expect(updatedRow.getByText("Inactive")).toBeVisible();
});
```

(Scoping the confirm click to `getByRole("alertdialog")` rather than `.last()` keeps this correct even when other rows' own "Deactivate" trigger buttons are present on the page.)

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn playwright test --project=authenticated users-crud.spec.ts`
Expected: FAIL — `/dashboard/users/new` 404s.

- [ ] **Step 3: Shared user form component**

Create `src/components/users/user-form.tsx`:
```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserSchema, ROLES, type CreateUserInput } from "@/lib/schemas";

interface UserFormProps {
  defaultValues?: Partial<CreateUserInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: CreateUserInput) => void | Promise<void>;
}

export function UserForm({
  defaultValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: UserFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      role: defaultValues?.role ?? "viewer",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" {...register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.role}>
          <FieldLabel htmlFor="role">Role</FieldLabel>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.role]} />
        </Field>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 4: Create-user page**

Create `src/app/dashboard/users/new/page.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserForm } from "@/components/users/user-form";
import type { CreateUserInput } from "@/lib/schemas";
import { useCreateUserMutation } from "@/queries/users";

export default function NewUserPage() {
  const router = useRouter();
  const createUserMutation = useCreateUserMutation();

  async function handleSubmit(values: CreateUserInput) {
    try {
      await createUserMutation.mutateAsync(values);
      toast.success("User created");
      router.push("/dashboard/users");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create user");
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">New user</h1>
      <UserForm
        submitLabel="Create user"
        isSubmitting={createUserMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 5: Edit-user page**

Create `src/app/dashboard/users/[id]/page.tsx`:
```tsx
"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { UserForm } from "@/components/users/user-form";
import type { CreateUserInput } from "@/lib/schemas";
import { useUpdateUserMutation, useUserQuery } from "@/queries/users";

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default function EditUserPage({ params }: EditUserPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const userQuery = useUserQuery(id);
  const updateUserMutation = useUpdateUserMutation(id);

  async function handleSubmit(values: CreateUserInput) {
    try {
      await updateUserMutation.mutateAsync(values);
      toast.success("User updated");
      router.push("/dashboard/users");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update user");
    }
  }

  if (userQuery.isLoading) {
    return <Skeleton className="h-64 w-full max-w-md" />;
  }

  if (!userQuery.data) {
    return <p className="text-sm text-muted-foreground">User not found.</p>;
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Edit user</h1>
      <UserForm
        defaultValues={userQuery.data}
        submitLabel="Save changes"
        isSubmitting={updateUserMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `yarn playwright test --project=authenticated users-crud.spec.ts`
Expected: 1 passed.

---

### Task 19: CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (already exists — Next.js 16's dev server auto-generates a one-line `CLAUDE.md` containing `@AGENTS.md`, plus an `AGENTS.md` with framework-version warnings for AI coding agents; both were committed incidentally during Task 2 when `yarn dev` first ran. Do not overwrite the `@AGENTS.md` line — prepend the project content below it so both the framework warnings and the project rules are loaded.)

**Interfaces:**
- Produces: none (documentation only).

- [ ] **Step 1: Write the project rule file**

Edit `CLAUDE.md` so it contains the `@AGENTS.md` line followed by the project content below (don't delete the `@AGENTS.md` reference — keep it as the first line):
```markdown
@AGENTS.md

# bom-zustand-backoffice

Admin backoffice frontend for `bom-tanstack-api` (Go/Echo backend). This repo is a rewrite of the prior `bom-tanstack-backoffice` project onto Zustand (client state) + TanStack Query (server state), replacing direct client-side API calls with a Next.js BFF proxy layer.

## Stack

- Next.js (App Router, TypeScript strict), yarn
- Tailwind CSS v4 + shadcn/ui (`base-nova` preset, Base UI)
- Zustand for client/UI state, TanStack Query for server state
- react-hook-form + zod for forms/validation
- Playwright for all testing (both Node-only unit tests and browser E2E run through `@playwright/test`)

## Commands

- `yarn dev` — start the dev server (http://localhost:3000)
- `yarn lint` — ESLint
- `yarn test:unit` — fast Node-only tests (`e2e/unit/**`)
- `yarn test:e2e` — full Playwright suite (requires the backend running at `API_BASE_URL`, default `http://localhost:8080/api/v1`, and `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` env vars for a seeded account with all `user:*` permissions)
- `yarn test` — everything (unit + e2e)

## Architecture

The browser never calls the Go API directly. Every authenticated request goes through a Next.js Route Handler under `src/app/api/**`, which reads the `access_token`/`refresh_token` httpOnly cookies, attaches the bearer token, and on a 401 transparently refreshes once via `lib/api-client.ts` before retrying. `src/proxy.ts` (Next.js 16's renamed `middleware.ts` convention) guards everything outside `/login`, `/forgot-password`, `/reset-password` by checking for the `access_token` cookie.

- `lib/cookies.ts` / `lib/api-client.ts` are pure and dependency-injected (the cookie store and fetch implementation are parameters), so they're unit-testable without a Next.js runtime. Keep them that way — don't call `cookies()` or the global `fetch` directly inside them.
- `stores/session-store.ts` is a client-side mirror of the current user + permissions (from `/auth/me`), used for synchronous permission checks in the UI. Never put tokens here.
- `stores/ui-store.ts` is purely client UI state, persisted to localStorage, with an SSR/Node-safe no-op storage fallback. Follow that pattern for any new persisted store.
- `queries/*.ts` are the only place server data is fetched from — always through the `/api/*` routes, never the Go API's origin directly from client code.

## Conventions

- No code comments unless they capture a non-obvious *why*.
- Don't add abstractions, tests, or dependencies beyond what a task needs.
- Colocate by feature inside `components/` (e.g. `components/users/*`), not by technical layer.
- This project's shadcn components are built on **Base UI**, not Radix. Use Base UI's `render` prop (`<Button render={<Link .../>} />`) to compose a component with another element — never Radix's `asChild` boolean, which Base UI silently ignores and which produces invalid nested interactive elements (e.g. a `<button>` inside a `<button>`) that also break role-based test selectors.

## Git policy

**Never create git commits automatically.** Only commit when the user explicitly asks for it in that turn — approval of a prior change doesn't carry forward to later ones.
```

- [ ] **Step 2: Verify**

Read the file back and confirm every command it references (`yarn dev`, `yarn lint`, `yarn test:unit`, `yarn test:e2e`, `yarn test`) exists in `package.json`'s `"scripts"`.

---

### Task 20: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `yarn lint`
Expected: no errors.

- [ ] **Step 2: Build**

Run: `yarn build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Unit tests**

Run: `yarn test:unit`
Expected: all unit tests pass.

- [ ] **Step 4: Full E2E suite**

Ensure the Go backend is running at `API_BASE_URL` and `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are set to an account with all `user:*` permissions, then run:

Run: `yarn test:e2e`
Expected: all projects (`api`, `setup`, `unauthenticated`, `authenticated`) pass.

- [ ] **Step 5: Report status — do not commit**

Summarize pass/fail results to the user. Per the Global Constraints, do not run `git add`/`git commit` — wait for an explicit request.

