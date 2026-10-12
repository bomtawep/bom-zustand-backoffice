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
- Never commit directly to `develop` `main`
- No code comments unless they capture a non-obvious *why*.
- Don't add abstractions, tests, or dependencies beyond what a task needs.
- Colocate by feature inside `components/` (e.g. `components/users/*`), not by technical layer.
- This project's shadcn components are built on **Base UI**, not Radix. Use Base UI's `render` prop (`<Button render={<Link .../>} />`) to compose a component with another element — never Radix's `asChild` boolean, which Base UI silently ignores and which produces invalid nested interactive elements (e.g. a `<button>` inside a `<button>`) that also break role-based test selectors.

## Git policy

**Never create git commits automatically.** Only commit when the user explicitly asks for it in that turn — approval of a prior change doesn't carry forward to later ones.
