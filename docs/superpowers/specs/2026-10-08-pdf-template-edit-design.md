# Edit template inline during report generation

## Goal

In the "Generate report" flow (`src/components/pdf-management/report-generate-form.tsx`), let a user view and edit the template backing the selected report before generating a PDF, with changes persisted back to the template. This was explicitly deferred as a non-goal in `docs/superpowers/specs/2026-10-08-pdf-management-design.md` ("Template list/edit/delete UI... only template creation is in scope") — this spec designs that gap.

## Current state (gap)

- `report-generate-form.tsx` selects a `ReportDefinition` via `useReportsQuery()`. Each definition carries a `templateId`, but the frontend never resolves it to an actual `Template` — the id is opaque and unused beyond being sent to the generate mutation indirectly via `reportId`.
- No `GET /api/templates/{id}` or `PATCH /api/templates/{id}` BFF route exists. `src/queries/templates.ts` only has `useCreateTemplateMutation` — template creation is write-only from the frontend's perspective.
- `Template` shape (`src/types/api.ts`): `{ id, name, description?, htmlContent, createdAt, updatedAt }`.
- The `Permission` union already includes `template:update` (anticipating the backend supports it), but nothing in the frontend uses it yet.

## Non-goals

- No standalone template list/management page — this is scoped to the inline edit-while-generating flow only.
- No template delete UI.
- No optimistic UI / conflict resolution for concurrent edits — last write wins, same as the rest of this app's mutations.

## Design

### Backend surface

**`src/app/api/templates/[id]/route.ts`** (new file), following the existing `apiFetch` + `ApiAuthError` → 401 pattern used in `src/app/api/templates/route.ts`:

- `GET` — proxies `GET /templates/{id}`, returns `Template | ErrorResponse`.
- `PATCH` — validates the body against a new `updateTemplateSchema` (identical shape to `createTemplateSchema`: `{ name: string (min 1), description?: string, htmlContent: string (min 1) }`), proxies `PATCH /templates/{id}`, returns `Template | ErrorResponse`.

**`src/queries/templates.ts`** — add two hooks alongside `useCreateTemplateMutation`:

- `useTemplateQuery(id: string, options?: { enabled?: boolean })` — TanStack `useQuery`, query key `["template", id]`, fetches `/api/templates/{id}`. `enabled` is passed through so the caller controls lazy-fetching.
- `useUpdateTemplateMutation()` — TanStack `useMutation`, `PATCH /api/templates/{id}` with `{ name, description, htmlContent }` body, returns the updated `Template`.

### `report-generate-form.tsx` changes

- After a report is selected, an "Edit template" disclosure row appears above the dynamic param fields (below the report `Select`). Plain `useState<boolean>` toggle with a chevron icon — no new UI dependency, matching the "don't add abstractions beyond what's needed" convention (no collapsible/accordion primitive exists in this repo yet).
- Gated on the `template:update` permission (same pattern as the existing `template:create` gate around the create-template card) — if the user lacks it, the disclosure does not render at all.
- Expanding the row sets `isEditExpanded = true`, which flips `useTemplateQuery(templateId, { enabled: isEditExpanded })` on. While loading, the three fields render as a loading skeleton; the disclosure itself opens immediately (no delay waiting on the fetch).
- Once loaded, render three fields mirroring `template-form.tsx`'s create form layout exactly, prefilled from the fetched `Template`:
  - `name` — `Input`, prefilled with `template.name`
  - `description` — `Input`, prefilled with `template.description ?? ""`
  - `htmlContent` — `Textarea` (10 rows), prefilled with `template.htmlContent`
  - All three are fully editable (not read-only) — the goal is "get old data into each field... easy to edit," not just display.
- A "Save template" `Button` below the three fields calls `useUpdateTemplateMutation().mutateAsync({ id: templateId, name, description, htmlContent })`, shows its own success/error toast, and is completely independent of the "Generate PDF" button/mutation — saving the template does not trigger generation, and generating does not require saving first (generation always uses whatever the template's current persisted state is).
- Switching to a different report (`templateId` changes) collapses the edit section and clears its local field state, so re-expanding always fetches and shows the newly-selected template's current data rather than stale fields from the previous one.

## Data flow summary

1. User selects a report → `templateId` resolved from `selectedReport.templateId` (already present on the object, previously unused).
2. User expands "Edit template" → `useTemplateQuery(templateId, { enabled: true })` fires → fields populate from the response.
3. User edits any of the three fields locally, clicks "Save template" → `useUpdateTemplateMutation` PATCHes → toast confirms → local field state is left as-is (reflecting what's now persisted).
4. User clicks "Generate PDF" (independent of step 3) → existing `useGenerateReportMutation` flow, unchanged.

## Testing

No new automated test. Consistent with the rest of `pdf-management` (manual verification via the dev server), and this is UI composition over already-tested query/mutation primitives. Manual verification: select a report, expand edit, confirm fields show the real persisted template data, edit and save, confirm a fresh expand (or switching reports and back) reflects the saved change, confirm generate still works without requiring a save first.
