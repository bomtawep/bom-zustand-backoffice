# PDF Management (Templates + Report Generation) — Design Spec

Date: 2026-10-08
Status: Draft (pending user review)

## 1. Background

The Go backend (`bom-tanstack-api`, swagger read from `http://localhost:8080/swagger/index.html`) exposes two API surfaces not yet covered by this frontend:

- **Templates** (`/templates`, tag `templates`) — HTML report templates. Relevant to this feature: `POST /templates` (`template:create`).
- **Reports** (`/reports`, tag `reports`) — "report definitions" that pair a template with a MongoDB aggregation pipeline and a param schema, plus the actions to run them. Relevant to this feature: `GET /reports` (`report:read`, to list existing definitions) and `POST /reports/{id}/generate` (`report:generate`, runs the report's query, renders the template, and converts to PDF via headless Chrome — response is `application/pdf`).

Report definitions themselves (pairing a template + Mongo pipeline + param schema via `POST /reports`) are **not** created through this UI — they're assumed to already exist (created elsewhere/by another tool). This feature only covers creating templates and generating PDFs from existing report definitions.

### Relevant API shapes

`POST /templates` body (`createTemplateRequest`): `{ name: string, htmlContent: string, description?: string }` → `201` returns `Template { id, name, description, htmlContent, createdAt, updatedAt }`.

`GET /reports` → `200` returns `ReportDefinition[]`: `{ id, name, collection, pipelineTemplate, templateId, paramSchema: ReportParam[], createdAt, updatedAt }`, where `ReportParam` is `{ name, label, type, required }` (`type` is a free-form string, e.g. `"string" | "number" | "date" | "boolean"`).

`POST /reports/{id}/generate` body (`generateReportRequest`): `{ params: Record<string, unknown> }` → `200` returns a raw `application/pdf` body (no JSON envelope). Error responses (`400/401/403/404`) are still JSON `{ error: string }`.

Full permission enum (from swagger, `bom-zustand-api_internal_auth.Permission`): existing `user:create/read/update/delete`, plus new `template:create/read/update/delete` and `report:create/read/update/delete/generate`. This feature only exercises `template:create`, `report:read`, `report:generate`.

## 2. Goals

- A single admin-facing page, **PDF Management**, with two independent sections:
  1. Create an HTML template (`POST /templates`).
  2. Pick an existing report definition, fill in its dynamic params, generate a PDF (`POST /reports/{id}/generate`), and preview it inline on the same page.
- A new sidebar menu item, visible only to users holding the relevant permissions.
- Extend the BFF proxy layer with a first-class pattern for a **binary (PDF) response**, which doesn't exist in the codebase yet.

## 3. Non-goals / out of scope

- Report definition CRUD (`POST/PATCH/DELETE /reports`) — assumed to be managed elsewhere.
- Template list/edit/delete UI (`GET/PATCH/DELETE /templates`) — only template *creation* is in scope.
- The HTML preview endpoint (`POST /reports/{id}/preview`) — not requested; only the PDF-generating endpoint is used.
- Literal `role === "admin"` gating — gating follows the codebase's existing permission-based convention (see §6).

## 4. Architecture

### 4.1 BFF proxy routes (new)

Following the exact pattern in `src/app/api/users/route.ts` (read cookies → `apiFetch` → forward status/body, catch `ApiAuthError` → 401):

- `src/app/api/templates/route.ts` — `POST`: validates body against a new `createTemplateSchema` (zod), forwards to `/templates`, returns the JSON `Template` as-is.
- `src/app/api/reports/route.ts` — `GET`: forwards to `/reports`, returns the JSON `ReportDefinition[]` as-is.
- `src/app/api/reports/[id]/generate/route.ts` — `POST`: forwards `{ params }` to `/reports/{id}/generate`. On success, instead of `response.json()`, reads `response.arrayBuffer()` and returns `new NextResponse(buf, { status: 200, headers: { "Content-Type": "application/pdf" } })`. On a non-OK response, passes the JSON error body through unchanged (same `{ error }` shape as every other route), so the client can treat "non-OK" as "parse JSON for the message" uniformly.

This introduces the first binary-response route in the codebase — the closest existing precedent is the `204 No Content` DELETE case in `src/app/api/users/[id]/route.ts`, which also returns a non-JSON `NextResponse`.

### 4.2 Types (`src/types/api.ts`)

Add:
```ts
export interface Template {
  id: string;
  name: string;
  description?: string;
  htmlContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportParam {
  name: string;
  label: string;
  type: string; // "string" | "number" | "date" | "boolean" observed; treated as open string
  required: boolean;
}

export interface ReportDefinition {
  id: string;
  name: string;
  collection: string;
  pipelineTemplate: string;
  templateId: string;
  paramSchema: ReportParam[];
  createdAt: string;
  updatedAt: string;
}
```

Extend the `Permission` union with the 9 new backend values (`template:create`, `template:read`, `template:update`, `template:delete`, `report:create`, `report:read`, `report:update`, `report:delete`, `report:generate`) so the type stays accurate to the backend contract, even though this feature only checks three of them.

### 4.3 Schemas (`src/lib/schemas.ts`)

Add `createTemplateSchema`: `name` (required, non-empty string), `htmlContent` (required, non-empty string), `description` (optional string). `CreateTemplateInput` type inferred from it.

The generate-report params form has no fixed shape — it's driven per-report by `paramSchema`. Rather than a static zod schema, validation is built at submit time: for each `ReportParam`, if `required` and the value is empty, surface a field error; `number`-typed values are coerced with `Number(...)` before validation; no static schema is added to `schemas.ts` for this.

### 4.4 Queries

- `src/queries/templates.ts`: `useCreateTemplateMutation()` — `POST /api/templates`, standard `parseJsonOrThrow<Template>` pattern, matching `useCreateUserMutation`.
- `src/queries/reports.ts`:
  - `useReportsQuery()` — `GET /api/reports`, `queryKey: ["reports"]`, standard pattern.
  - `useGenerateReportMutation()` — custom `mutationFn` (not `parseJsonOrThrow`, since a successful response body is a PDF, not JSON): `fetch` the route, if `!response.ok` parse the JSON error body and `throw new ApiError(...)`, else `return response.blob()`. Returns a `Blob` on success.

### 4.5 Components (`src/components/pdf-management/`)

- `template-form.tsx` — react-hook-form + `zodResolver(createTemplateSchema)`, fields: `name` (Input), `description` (Input, optional), `htmlContent` (Textarea). Structured like `components/users/user-form.tsx` (Field/FieldGroup/FieldLabel/FieldError wrappers).
- `report-generate-form.tsx` — a `Select` populated from `useReportsQuery()` (label = report name). On selection, renders one input per entry in the selected report's `paramSchema`: `Input` for `string`, `Input type="number"` for `number`, a date picker component for `date`, a `Checkbox` for `boolean` (any other/unknown `type` value falls back to a plain text `Input`). A "Generate PDF" button triggers `useGenerateReportMutation()`, builds a `Record<string, unknown>` from the dynamic field values, and on success emits the resulting `Blob` up to the parent page.
- `pdf-preview.tsx` — receives a `Blob | null`; when non-null, creates an object URL (`URL.createObjectURL`), renders it in an `<iframe className="w-full h-[600px]" src={url} />`, plus a `<a href={url} download="report.pdf">Download PDF</a>` link. Revokes the previous object URL on unmount/replacement to avoid leaking memory.

### 4.6 Page (`src/app/dashboard/pdf-management/page.tsx`)

`"use client"`. Reads `hasPermission("template:create")` and `hasPermission("report:generate")` from `useSessionStore`.
- If neither permission is held, render the existing "no permission" message pattern (as in `users/new/page.tsx`) and nothing else.
- Otherwise render a page heading, then:
  - `template-form.tsx` inside a card, only if `hasPermission("template:create")`, with a `toast.success("Template created")` / `toast.error(...)` on submit (matching `NewUserPage`'s try/catch-around-`mutateAsync` pattern).
  - `report-generate-form.tsx` + `pdf-preview.tsx` inside a card, only if `hasPermission("report:generate")`. The page holds the generated `Blob` in local `useState` and passes it to `pdf-preview.tsx`. Generation errors are toasted with the parsed error message (e.g. a missing required param returns `400` from the Go API).

## 5. Sidebar gating

`src/components/layout/sidebar-nav.tsx` currently has **no permission gating at all** — `NAV_ITEMS` is a flat array always rendered in full. This is the first nav item that needs to be conditionally hidden, so the nav item shape gains an optional field:

```ts
const NAV_ITEMS: Array<{ href: string; label: string; permission?: Permission[] }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/pdf-management", label: "PDF Management", permission: ["template:create", "report:generate"] },
];
```

`SidebarNav` filters `NAV_ITEMS` through `useSessionStore((s) => s.hasPermission)`: an item with no `permission` field always shows; an item with `permission` shows if the user holds **any** of the listed permissions (OR semantics — either capability is enough to warrant seeing the menu entry, since the page itself splits visibility further by section).

## 6. Error handling

- `template:create` / `report:read` / `report:generate` 403s: the Go API already enforces these server-side; the frontend's permission checks are defense-in-depth (consistent with the existing users feature), hiding the relevant section/button rather than relying solely on a 403 toast.
- `POST /templates` validation errors (400, e.g. missing `name`/`htmlContent`): surfaced as `zod` field errors client-side before submission; a 400 from the API itself is toasted with the server's message.
- `POST /reports/{id}/generate` errors: since the success path returns a raw PDF body (no envelope) and the error path returns the standard `{ error }` JSON, the client **must** branch on `response.ok` before deciding how to parse the body — this is the one route in the codebase where response parsing is content-type-dependent rather than uniformly JSON.
- `401` on any of these routes: handled by the existing global refresh-and-retry / redirect-on-failure behavior, unchanged.

## 7. Testing

Not requested for this feature; no new Playwright specs are added. (`yarn lint` / `yarn test:unit` should still pass after implementation, per the existing CI expectations documented in `docs/TESTING.md`.)

## 8. Open items to confirm during implementation

- Exact rendering for a `date`-typed param — whether the existing shadcn setup already has a date-picker primitive generated under `components/ui/`, or one needs to be added via `shadcn add`.
- Whether `GET /reports` is unpaginated in practice (the swagger shows `limit`/`skip` query params) — if the admin's report list grows large, pagination may need revisiting, but out of scope for the initial implementation given the likely small number of report definitions.
