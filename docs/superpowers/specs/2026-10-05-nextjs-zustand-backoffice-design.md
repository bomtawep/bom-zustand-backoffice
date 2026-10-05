# bom-zustand-backoffice — Design Spec

Date: 2026-10-05
Status: Draft (pending user review)

## 1. Background

This repo (`bom-zustand-backoffice`) is a rewrite of a prior project, `bom-tanstack-backoffice` (per the stale README), replacing the server-state layer's reliance pattern with Zustand for client state while keeping TanStack Query for server-state caching. It is a frontend admin panel for the `bom-tanstack-api` backend (Go, Echo framework), whose OpenAPI/Swagger spec was read from `http://localhost:8080/swagger/index.html`.

### Backend API summary (basePath `/api/v1`)

Auth (`/auth/*`, tag `auth`):
- `POST /auth/login` — email/password → `{ accessToken, refreshToken }`
- `POST /auth/refresh` — refresh token → new token pair
- `POST /auth/logout`, `POST /auth/logout-all`
- `GET /auth/me` — current user + `permissions[]` (enum: `user:create`, `user:read`, `user:update`, `user:delete`)
- `POST /auth/change-password` (authenticated)
- `POST /auth/forgot-password`, `POST /auth/reset-password` (public)

Users (`/users`, tag `users`, all require Bearer auth + specific permission):
- `GET /users?limit=&skip=` — paginated list (`user:read`)
- `POST /users` — create `{ name, email, role }`, role enum `admin|manager|staff|viewer` (`user:create`)
- `GET /users/{id}` (`user:read`)
- `PATCH /users/{id}` — partial update of name/email/role (`user:update`)
- `DELETE /users/{id}` — deactivates the user, not a hard delete (`user:delete`)

`User` model: `{ id, name, email, role, active, createdAt, updatedAt }`.
Errors: `{ error: string }` with standard 400/401/403/404/409 status codes.

This is the entire API surface — the frontend's initial scope maps 1:1 to it, plus one placeholder dashboard landing page.

## 2. Goals

- Scaffold a new Next.js app (App Router, TypeScript, Tailwind v4, shadcn/ui, yarn) covering auth + users management against the above API.
- Zustand for client/UI state, TanStack Query for server state.
- httpOnly-cookie-based session via a BFF (backend-for-frontend) proxy layer in Next.js Route Handlers — the browser never talks to the Go API directly.
- ESLint (Next defaults + TypeScript strict + Prettier) and a `CLAUDE.md` capturing project conventions.
- Playwright E2E coverage of the critical paths.

## 3. Non-goals / out of scope

- Any feature not backed by the current API (reports, settings, etc.) beyond a single placeholder dashboard home page.
- Search/filtering on the users list beyond what `limit`/`skip` pagination supports — the API has no search parameter.
- Seeding a test user in the backend — the user will supply `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` via env for E2E tests.

## 4. Architecture

### 4.1 BFF proxy pattern

Because tokens are stored in httpOnly cookies, client-side JavaScript cannot read them to attach an `Authorization` header. Therefore **every** authenticated call to the Go API is proxied through a Next.js Route Handler that:

1. Reads `access_token` (and `refresh_token` when needed) from cookies via `next/headers`.
2. Forwards the request to the Go API at `process.env.API_BASE_URL` (default `http://localhost:8080/api/v1`) with `Authorization: Bearer <access_token>`.
3. On a `401` from the Go API, calls `POST /auth/refresh` with the refresh token once, rotates both cookies on success, and retries the original call. If refresh also fails, clears both cookies and returns `401` to the client.
4. Normalizes the Go API's `{ error: string }` body into the shape the client expects (pass-through is fine; documented so it doesn't silently change).

Cookies: `access_token` and `refresh_token`, both `httpOnly`, `secure` (in production), `sameSite=lax`, `path=/`.

### 4.2 Route protection

`middleware.ts` inspects the `access_token` cookie (presence check; expiry validation happens server-side on actual API calls, not decoded in middleware) to:
- Redirect unauthenticated requests to `(dashboard)/**` → `/login?next=<path>`.
- Redirect authenticated requests to `/login` → `/dashboard`.

`/forgot-password` and `/reset-password` are public and bypass the guard.

### 4.3 Folder structure

```
src/
  app/
    (auth)/
      login/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
    (dashboard)/
      layout.tsx            # sidebar + topbar shell
      page.tsx               # placeholder dashboard home
      profile/page.tsx       # me + change password
      users/
        page.tsx              # list + pagination
        new/page.tsx          # create
        [id]/page.tsx         # edit
    api/
      auth/
        login/route.ts
        logout/route.ts
        logout-all/route.ts
        refresh/route.ts
        me/route.ts
        change-password/route.ts
        forgot-password/route.ts
        reset-password/route.ts
      users/
        route.ts              # GET list, POST create
        [id]/route.ts         # GET, PATCH, DELETE
    layout.tsx
    globals.css
  components/
    ui/                # shadcn-generated primitives
    layout/            # sidebar, topbar, nav
    users/             # users-table, user-form, deactivate-dialog
  lib/
    api-client.ts       # server-side fetch wrapper with refresh-and-retry
    cookies.ts          # cookie read/write/clear helpers
    auth.ts             # server-side session + permission helpers
  stores/
    session-store.ts    # zustand: current user + permissions (client mirror)
    ui-store.ts          # zustand: sidebar collapsed, etc. (localStorage-persisted)
  queries/
    users.ts             # TanStack Query hooks for users
    auth.ts              # TanStack Query hooks for me/login/logout/change-password
  types/
    api.ts               # TS types mirroring the swagger definitions
  middleware.ts
e2e/
  auth.setup.ts          # Playwright setup project: logs in, saves storageState
  auth.spec.ts
  users.spec.ts
playwright.config.ts
CLAUDE.md
```

## 5. Data layer

- **TanStack Query** owns all server state: users list/detail, `me`. Query keys: `['users', { limit, skip }]`, `['users', id]`, `['me']`. Mutations (create/update/deactivate, login, logout, change-password) invalidate the relevant keys on success and surface errors via shadcn `sonner` toasts.
- **Zustand** owns:
  - `session-store`: a lightweight copy of the authenticated user + `permissions[]`, hydrated from the `me` query's success callback, cleared on logout. Used for synchronous UI permission checks (e.g. hiding the "Create User" button) without waiting on query state.
  - `ui-store`: purely client UI state (sidebar collapsed, etc.), persisted to `localStorage` via Zustand's `persist` middleware.
- No tokens are ever stored in Zustand, localStorage, or sessionStorage — only in httpOnly cookies managed server-side.

## 6. Auth flow

1. Login form (react-hook-form + zod) submits → TanStack mutation calls `POST /api/auth/login` → route handler calls Go `/auth/login`, sets both cookies, returns success with no tokens in the body.
2. Client refetches `['me']`, populates `session-store`, redirects to `/dashboard` (or `?next=` target).
3. Logout: `POST /api/auth/logout` revokes the refresh token server-side, clears both cookies; client clears `session-store` and redirects to `/login`. "Sign out everywhere" on the profile page calls `logout-all`.
4. Forgot/reset password: public forms calling `/api/auth/forgot-password` and `/api/auth/reset-password`, no cookies involved.
5. Change password: authenticated form on the profile page calling `/api/auth/change-password`.

## 7. Users feature

- **List**: shadcn `DataTable` (TanStack Table) with a simple previous/next pager driven by `limit`/`skip` query params reflected in the URL (so it's shareable/bookmarkable). No client-side search (API doesn't support it).
- **Create**: shadcn `Form` (react-hook-form + zod) — `name`, `email`, `role` (select: admin/manager/staff/viewer). Surfaces `409` (duplicate email) as an inline field error.
- **Edit**: same form, pre-filled, `PATCH` partial update.
- **Deactivate**: row action behind a shadcn `AlertDialog` confirmation, calls `DELETE`; list refetches afterward. Deactivated users are shown with an "inactive" badge rather than removed from view if the API still returns them — exact behavior depends on what `GET /users` returns post-deactivation, to be confirmed during implementation.
- All create/update/deactivate affordances are conditionally rendered based on `session-store` permissions, as defense-in-depth alongside the API's own 403 enforcement.

## 8. Error handling

- Route handlers pass through the Go API's `{ error: string }` body with the same status code.
- `401` → triggers the refresh-and-retry described in §4.1; if that fails, the client redirects to `/login`.
- `403` → toast "You don't have permission to do this."
- `404` → not-found UI within the relevant page.
- `409` (create user, duplicate email) → inline form field error.
- Next.js `error.tsx` boundaries per route segment for unexpected failures.

## 9. Tooling

- **Package manager**: yarn.
- **Framework**: Next.js (latest stable, App Router), TypeScript strict mode.
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style).
- **Validation**: zod (new dependency, required for the shadcn/react-hook-form form pattern — flagged since not explicitly requested, but necessary for the chosen form approach).
- **Lint/format**: ESLint (`next/core-web-vitals` + `@typescript-eslint` strict rules) + Prettier + `eslint-config-prettier`.
- **State/data**: Zustand (client state), `@tanstack/react-query` (server state).

## 10. Testing

Playwright, critical-path E2E, run against a real backend at `http://localhost:8080`:
- `auth.setup.ts`: logs in using `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` env vars, saves `storageState` (cookies) for reuse.
- `auth.spec.ts`: login success → redirect to dashboard; login with wrong password → inline error; visiting a protected route while logged out → redirected to `/login`; logout → redirected to `/login` and cookies cleared.
- `users.spec.ts`: list renders and paginates; create a user and see it appear in the list; edit a user and see the change persist; deactivate a user and see its status reflected.
- `playwright.config.ts`: `webServer` auto-starts `yarn dev`; `baseURL` `http://localhost:3000`.

## 11. CLAUDE.md (project rule file)

To be created at the repo root, documenting:
- Project purpose and stack (this is the Zustand-based rewrite of the TanStack backoffice).
- Folder/convention map (as in §4.3).
- Commands: `yarn dev`, `yarn lint`, `yarn test:e2e`.
- Auth flow summary (§6) so future work respects the BFF/cookie pattern instead of reaching for client-stored tokens.
- **Explicit rule: never create git commits automatically — always wait for an explicit user request to commit.** (User feedback from this planning session.)

## 12. Open items to confirm during implementation

- Exact Next.js / shadcn / Tailwind version pins at scaffold time (latest stable at time of implementation).
- Whether `GET /users` includes deactivated users in its response (affects how "deactivate" is reflected in the list UI) — verify against the live API during implementation.
