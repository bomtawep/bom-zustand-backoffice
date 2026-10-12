# Testing Guide

## Prerequisites

- `bom-tanstack-api` (the Go backend) running and reachable at `API_BASE_URL`
  (default `http://localhost:8080/api/v1`).
- A seeded backend account with all `user:*` permissions, for E2E login flows.

## `.env`

Create a `.env` file at the repo root (gitignored, never committed):

```
TEST_USER_EMAIL=
TEST_USER_PASSWORD=

# Override only if the Go API isn't at the default.
# API_BASE_URL=http://localhost:8080/api/v1
```

`yarn test` and `yarn test:e2e` both source this file automatically before
running Playwright. If you invoke `npx playwright test` directly instead of
through one of those scripts, source it yourself first:

```
set -a && . ./.env && set +a && npx playwright test ...
```

## Running tests

| Command | What it runs |
|---|---|
| `yarn test:unit` | Fast, Node-only tests (`e2e/unit/**`), no backend needed |
| `yarn test:e2e` | Full E2E suite: `api`, `setup`, `unauthenticated`, `authenticated` projects |
| `yarn test` | Everything (unit + e2e) |

### Running a single spec file

```
set -a && . ./.env && set +a && npx playwright test e2e/auth/users-crud.spec.ts --project=authenticated
```

Match `--project` to the directory the spec lives in:

| Directory | Project |
|---|---|
| `e2e/unit/` | `unit` |
| `e2e/api/` | `api` |
| `e2e/no-auth/` | `unauthenticated` |
| `e2e/auth/` | `authenticated` (depends on `setup`, which runs automatically) |

### Running a single test by name

```
set -a && . ./.env && set +a && npx playwright test -g "creates a user, edits it, and deactivates it" --project=authenticated
```

## Recording a new test (codegen)

Point Playwright's codegen at the dev server. Use the saved auth session
(`playwright/.auth/user.json`, written by the `setup` project) to start
already logged in:

```
npx playwright codegen --load-storage=playwright/.auth/user.json http://localhost:3000/dashboard
```

Drop `--load-storage` to record an unauthenticated flow (e.g. login itself).

## Troubleshooting

- **`locator.fill: value: expected string, got undefined`** or
  **`TEST_USER_EMAIL and TEST_USER_PASSWORD must be set to run E2E tests`** —
  `.env` wasn't loaded. Make sure you're running through `yarn test` /
  `yarn test:e2e`, or source `.env` manually before calling
  `npx playwright test` directly.
- **`invalid credentials` (401) from the backend** — the values in `.env`
  don't match a real seeded account on the backend you're pointed at.
- **Login succeeds but redirect to `/dashboard` times out** — check the
  backend is actually running at `API_BASE_URL` and the seeded account has
  the permissions the UI expects.
