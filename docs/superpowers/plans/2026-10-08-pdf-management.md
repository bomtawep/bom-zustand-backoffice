# PDF Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-facing "PDF Management" page where an admin can create an HTML report template, pick an existing report definition, fill in its params, generate a PDF via the Go API, and preview it inline.

**Architecture:** Three new Next.js Route Handlers extend the existing BFF proxy pattern (cookie → `apiFetch` → forward), including the codebase's first binary (`application/pdf`) response. Two new TanStack Query files wrap those routes. Three new colocated components (`template-form`, `report-generate-form`, `pdf-preview`) compose into one page, gated by two new permissions, with a new permission-aware sidebar nav item.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind v4 + shadcn/ui (`base-nova`, Base UI), Zustand, TanStack Query, react-hook-form + zod, Playwright (`@playwright/test`) for unit tests only in this plan.

## Global Constraints

- Every BFF route handler reads cookies via `await cookies()`, calls `apiFetch(path, cookieStore, options)` from `src/lib/api-client.ts`, and catches `ApiAuthError` → `NextResponse.json({ error: "unauthorized" }, { status: 401 })`, rethrowing anything else — copied verbatim from `src/app/api/users/route.ts`.
- Client-side query hooks never call the Go API directly — only `fetch("/api/...")` to the BFF routes, per `CLAUDE.md`.
- No code comments unless they capture a non-obvious *why* (per `CLAUDE.md`).
- Don't add abstractions, tests, or dependencies beyond what a task needs (per `CLAUDE.md`).
- Colocate by feature inside `components/` (e.g. `components/pdf-management/*`), not by technical layer.
- Use Base UI's `render` prop to compose components with another element — never Radix's `asChild`. (Not needed by any task in this plan, but applies if touched.)
- Never create git commits automatically beyond what this plan's own steps direct — the user already approved committing as part of plan execution; do not push, and do not commit anything outside each step's listed files.
- Testing scope per the approved spec (`docs/superpowers/specs/2026-10-08-pdf-management-design.md`, §7): only the existing `e2e/unit/schemas.spec.ts` unit-test file gets new cases. No new Playwright E2E specs.

---

### Task 1: Shared types and request schemas

**Files:**
- Modify: `src/types/api.ts`
- Modify: `src/lib/schemas.ts`
- Test: `e2e/unit/schemas.spec.ts`

**Interfaces:**
- Produces: `Permission` union extended with `"template:create" | "template:read" | "template:update" | "template:delete" | "report:create" | "report:read" | "report:update" | "report:delete" | "report:generate"`; `Template`, `ReportParam`, `ReportDefinition` interfaces in `src/types/api.ts`; `createTemplateSchema` / `CreateTemplateInput` and `generateReportSchema` (no inferred type needed — only consumed via `.safeParse` in Task 4's route handler) in `src/lib/schemas.ts`. Later tasks import these directly.

- [ ] **Step 1: Extend `src/types/api.ts`**

Replace the existing `Permission` type (lines 3-7) with:

```ts
export type Permission =
  | "user:create"
  | "user:read"
  | "user:update"
  | "user:delete"
  | "template:create"
  | "template:read"
  | "template:update"
  | "template:delete"
  | "report:create"
  | "report:read"
  | "report:update"
  | "report:delete"
  | "report:generate";
```

Append to the end of the file (after `MessageResponse`):

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
  type: string;
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

- [ ] **Step 2: Write the failing tests for the new schemas**

Append to `e2e/unit/schemas.spec.ts` (add `createTemplateSchema` and `generateReportSchema` to the existing import list at the top, then add these tests at the end of the file):

```ts
test("createTemplateSchema rejects a missing name", () => {
  const result = createTemplateSchema.safeParse({
    htmlContent: "<p>Hello</p>",
  });
  expect(result.success).toBe(false);
});

test("createTemplateSchema accepts a valid payload without description", () => {
  const result = createTemplateSchema.safeParse({
    name: "Invoice",
    htmlContent: "<p>Hello</p>",
  });
  expect(result.success).toBe(true);
});

test("generateReportSchema rejects a non-object params value", () => {
  const result = generateReportSchema.safeParse({ params: "not-an-object" });
  expect(result.success).toBe(false);
});

test("generateReportSchema accepts an empty params object", () => {
  const result = generateReportSchema.safeParse({ params: {} });
  expect(result.success).toBe(true);
});
```

The full updated import line at the top of the file should read:

```ts
import {
  changePasswordSchema,
  createTemplateSchema,
  createUserSchema,
  generateReportSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/schemas";
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `yarn test:unit e2e/unit/schemas.spec.ts`
Expected: FAIL — `createTemplateSchema` and `generateReportSchema` are not exported from `@/lib/schemas` yet (import error).

- [ ] **Step 4: Add the schemas to `src/lib/schemas.ts`**

Append to the end of the file:

```ts

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  htmlContent: z.string().min(1, "HTML content is required"),
  description: z.string().optional(),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const generateReportSchema = z.object({
  params: z.record(z.string(), z.unknown()),
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test:unit e2e/unit/schemas.spec.ts`
Expected: PASS (8 tests: 4 existing + 4 new)

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add src/types/api.ts src/lib/schemas.ts e2e/unit/schemas.spec.ts
git commit -m "feat: add template/report types and request schemas"
```

---

### Task 2: Textarea and Checkbox UI primitives

**Files:**
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/checkbox.tsx`

**Interfaces:**
- Consumes: `cn` from the `"cn"` package (same as every other file in `src/components/ui/`); `Checkbox` primitive from `@base-ui/react/checkbox` (already a dependency — exposes `Root`/`Indicator` under the `Checkbox` namespace, confirmed present at `node_modules/@base-ui/react/checkbox`); `CheckIcon` from `lucide-react`.
- Produces: `Textarea` (props: `React.ComponentProps<"textarea">`) and `Checkbox` (props: `CheckboxPrimitive.Root.Props`, i.e. `checked`, `onCheckedChange`, `disabled`, etc.) — both consumed by Task 6's `report-generate-form.tsx` and Task 5's `template-form.tsx`.

No automated test — these are presentational primitives with no logic, styled to match the existing `Input`/`Select` primitives in the same directory. Verified by typecheck + visual check once consumed in Task 5/6.

- [ ] **Step 1: Create `src/components/ui/textarea.tsx`**

```tsx
import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

- [ ] **Step 2: Create `src/components/ui/checkbox.tsx`**

```tsx
"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-transparent text-primary-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center"
      >
        <CheckIcon className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add src/components/ui/textarea.tsx src/components/ui/checkbox.tsx
git commit -m "feat: add Textarea and Checkbox UI primitives"
```

---

### Task 3: BFF route — create template

**Files:**
- Create: `src/app/api/templates/route.ts`

**Interfaces:**
- Consumes: `apiFetch`/`ApiAuthError` from `@/lib/api-client`; `createTemplateSchema` from `@/lib/schemas` (Task 1); `Template`/`ErrorResponse` from `@/types/api` (Task 1).
- Produces: `POST /api/templates` endpoint — later consumed by Task 4's `src/queries/templates.ts` via `fetch("/api/templates", { method: "POST", ... })`.

No automated test (matches the existing codebase convention — route handlers under `src/app/api/**` have no unit tests; `src/app/api/users/route.ts` has none either). Verified manually in Task 9's end-to-end check.

- [ ] **Step 1: Create `src/app/api/templates/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import { createTemplateSchema } from "@/lib/schemas";
import type { ErrorResponse, Template } from "@/types/api";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const response = await apiFetch("/templates", cookieStore, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    const data = (await response.json()) as Template | ErrorResponse;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add src/app/api/templates/route.ts
git commit -m "feat: add BFF route to create templates"
```

---

### Task 4: BFF routes — list report definitions, generate PDF

**Files:**
- Create: `src/app/api/reports/route.ts`
- Create: `src/app/api/reports/[id]/generate/route.ts`

**Interfaces:**
- Consumes: `apiFetch`/`ApiAuthError` from `@/lib/api-client`; `generateReportSchema` from `@/lib/schemas` (Task 1); `ReportDefinition`/`ErrorResponse` from `@/types/api` (Task 1).
- Produces: `GET /api/reports` (returns `ReportDefinition[]`) and `POST /api/reports/[id]/generate` (returns a raw `application/pdf` body on success, `ErrorResponse` JSON on failure) — both consumed by Task 4... (see Task 5) `src/queries/reports.ts`.

No automated test, same reasoning as Task 3. Verified manually in Task 9.

- [ ] **Step 1: Create `src/app/api/reports/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import type { ErrorResponse, ReportDefinition } from "@/types/api";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  try {
    const response = await apiFetch(`/reports${query ? `?${query}` : ""}`, cookieStore, {
      method: "GET",
    });
    const data = (await response.json()) as ReportDefinition[] | ErrorResponse;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
```

- [ ] **Step 2: Create `src/app/api/reports/[id]/generate/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import { generateReportSchema } from "@/lib/schemas";
import type { ErrorResponse } from "@/types/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const cookieStore = await cookies();
  const body = await request.json();
  const parsed = generateReportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const response = await apiFetch(`/reports/${id}/generate`, cookieStore, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      return NextResponse.json(error, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add src/app/api/reports/route.ts "src/app/api/reports/[id]/generate/route.ts"
git commit -m "feat: add BFF routes to list reports and generate PDFs"
```

---

### Task 5: Query hooks — templates and reports

**Files:**
- Create: `src/queries/templates.ts`
- Create: `src/queries/reports.ts`

**Interfaces:**
- Consumes: `ApiError`/`parseJsonOrThrow` from `@/lib/query-helpers`; `CreateTemplateInput` from `@/lib/schemas` (Task 1); `Template`/`ReportDefinition`/`ErrorResponse` from `@/types/api` (Task 1); the `/api/templates`, `/api/reports`, `/api/reports/[id]/generate` routes (Tasks 3-4).
- Produces: `useCreateTemplateMutation()` returning a mutation whose `mutateAsync(input: CreateTemplateInput)` resolves to `Template`; `useReportsQuery()` returning a query with `.data?: ReportDefinition[]`; `useGenerateReportMutation()` returning a mutation whose `mutateAsync({ reportId: string, params: Record<string, unknown> })` resolves to a `Blob`. All three consumed by Task 6's components.

No automated test — these are thin fetch wrappers with no branching logic beyond what `parseJsonOrThrow`/`ApiError` already cover (both already unit-tested in `e2e/unit/query-helpers.spec.ts`), matching `src/queries/users.ts`'s convention of having no dedicated test file.

- [ ] **Step 1: Create `src/queries/templates.ts`**

```ts
"use client";

import { useMutation } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/query-helpers";
import type { CreateTemplateInput } from "@/lib/schemas";
import type { Template } from "@/types/api";

export function useCreateTemplateMutation() {
  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<Template>(response);
    },
  });
}
```

- [ ] **Step 2: Create `src/queries/reports.ts`**

```ts
"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, parseJsonOrThrow } from "@/lib/query-helpers";
import type { ErrorResponse, ReportDefinition } from "@/types/api";

export function useReportsQuery() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const response = await fetch("/api/reports");
      return parseJsonOrThrow<ReportDefinition[]>(response);
    },
  });
}

interface GenerateReportMutationInput {
  reportId: string;
  params: Record<string, unknown>;
}

export function useGenerateReportMutation() {
  return useMutation({
    mutationFn: async ({ reportId, params }: GenerateReportMutationInput) => {
      const response = await fetch(`/api/reports/${reportId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new ApiError(response.status, error.error ?? "Could not generate report");
      }
      return response.blob();
    },
  });
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add src/queries/templates.ts src/queries/reports.ts
git commit -m "feat: add query hooks for templates and reports"
```

---

### Task 6: Template creation form

**Files:**
- Create: `src/components/pdf-management/template-form.tsx`

**Interfaces:**
- Consumes: `createTemplateSchema`/`CreateTemplateInput` from `@/lib/schemas` (Task 1); `useCreateTemplateMutation` from `@/queries/templates` (Task 5); `Textarea` from `@/components/ui/textarea` (Task 2); `Field`/`FieldError`/`FieldGroup`/`FieldLabel` from `@/components/ui/field`, `Input` from `@/components/ui/input`, `Button` from `@/components/ui/button` (all pre-existing).
- Produces: `TemplateForm` component, no props — self-contained (owns its own mutation, success/error toasts, and form reset). Consumed by Task 8's page.

No automated test — this is a thin composition of `react-hook-form` + the already-tested `createTemplateSchema`, matching `src/components/users/user-form.tsx`'s convention of having no dedicated component test (covered by E2E in that feature, which is explicitly out of scope here per the spec). Verified manually in Task 9.

- [ ] **Step 1: Create `src/components/pdf-management/template-form.tsx`**

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTemplateSchema, type CreateTemplateInput } from "@/lib/schemas";
import { useCreateTemplateMutation } from "@/queries/templates";

export function TemplateForm() {
  const createTemplateMutation = useCreateTemplateMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: { name: "", description: "", htmlContent: "" },
  });

  async function onSubmit(values: CreateTemplateInput) {
    try {
      await createTemplateMutation.mutateAsync(values);
      toast.success("Template created");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create template");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="template-name">Name</FieldLabel>
          <Input id="template-name" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="template-description">Description</FieldLabel>
          <Input id="template-description" {...register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
        <Field data-invalid={!!errors.htmlContent}>
          <FieldLabel htmlFor="template-html">HTML content</FieldLabel>
          <Textarea id="template-html" rows={10} {...register("htmlContent")} />
          <FieldError errors={[errors.htmlContent]} />
        </Field>
        <Button type="submit" disabled={createTemplateMutation.isPending}>
          Create template
        </Button>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add src/components/pdf-management/template-form.tsx
git commit -m "feat: add template creation form"
```

---

### Task 7: Report generate form and PDF preview

**Files:**
- Create: `src/components/pdf-management/report-generate-form.tsx`
- Create: `src/components/pdf-management/pdf-preview.tsx`

**Interfaces:**
- Consumes: `useGenerateReportMutation`/`useReportsQuery` from `@/queries/reports` (Task 5); `ReportParam` from `@/types/api` (Task 1); `Checkbox` from `@/components/ui/checkbox` (Task 2); `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` from `@/components/ui/select`, `Input` from `@/components/ui/input`, `Field`/`FieldError`/`FieldGroup`/`FieldLabel` from `@/components/ui/field`, `Button` from `@/components/ui/button` (all pre-existing).
- Produces: `ReportGenerateForm` (props: `{ onGenerated: (blob: Blob) => void }`) and `PdfPreview` (props: `{ blob: Blob | null }`) — both consumed by Task 8's page, which lifts the `Blob` state between them since they're siblings.

No automated test — dynamic per-report form logic has no fixed shape to unit-test against (per spec §4.3, validation is built at runtime from each report's `paramSchema`, not a static schema), and browser-level E2E is out of scope per the approved spec. Verified manually in Task 9.

- [ ] **Step 1: Create `src/components/pdf-management/report-generate-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerateReportMutation, useReportsQuery } from "@/queries/reports";
import type { ReportParam } from "@/types/api";

interface ReportGenerateFormProps {
  onGenerated: (blob: Blob) => void;
}

type ParamValue = string | boolean;

export function ReportGenerateForm({ onGenerated }: ReportGenerateFormProps) {
  const reportsQuery = useReportsQuery();
  const generateReportMutation = useGenerateReportMutation();
  const [selectedReportId, setSelectedReportId] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, ParamValue>>({});
  const [paramErrors, setParamErrors] = useState<Record<string, string>>({});

  const reports = reportsQuery.data ?? [];
  const selectedReport = reports.find((report) => report.id === selectedReportId);

  function handleSelectReport(reportId: string) {
    setSelectedReportId(reportId);
    setParamValues({});
    setParamErrors({});
  }

  function handleParamChange(name: string, value: ParamValue) {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }

  function validateParams(paramSchema: ReportParam[]): boolean {
    const errors: Record<string, string> = {};
    for (const param of paramSchema) {
      if (param.type === "boolean") continue;
      const value = paramValues[param.name];
      if (param.required && (value === undefined || value === "")) {
        errors[param.name] = `${param.label} is required`;
      }
    }
    setParamErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function buildParams(paramSchema: ReportParam[]): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const param of paramSchema) {
      const value = paramValues[param.name];
      if (value === undefined || value === "") continue;
      params[param.name] = param.type === "number" ? Number(value) : value;
    }
    return params;
  }

  async function handleGenerate() {
    if (!selectedReport) return;
    if (!validateParams(selectedReport.paramSchema)) return;

    try {
      const blob = await generateReportMutation.mutateAsync({
        reportId: selectedReport.id,
        params: buildParams(selectedReport.paramSchema),
      });
      onGenerated(blob);
      toast.success("Report generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate report");
    }
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="report-select">Report</FieldLabel>
        <Select value={selectedReportId} onValueChange={handleSelectReport}>
          <SelectTrigger id="report-select">
            <SelectValue placeholder="Select a report" />
          </SelectTrigger>
          <SelectContent>
            {reports.map((report) => (
              <SelectItem key={report.id} value={report.id}>
                {report.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {selectedReport?.paramSchema.map((param) => (
        <Field key={param.name} data-invalid={!!paramErrors[param.name]}>
          <FieldLabel htmlFor={`param-${param.name}`}>{param.label}</FieldLabel>
          {param.type === "boolean" ? (
            <Checkbox
              id={`param-${param.name}`}
              checked={Boolean(paramValues[param.name])}
              onCheckedChange={(checked) => handleParamChange(param.name, checked)}
            />
          ) : (
            <Input
              id={`param-${param.name}`}
              type={param.type === "number" ? "number" : param.type === "date" ? "date" : "text"}
              value={typeof paramValues[param.name] === "string" ? (paramValues[param.name] as string) : ""}
              onChange={(e) => handleParamChange(param.name, e.target.value)}
            />
          )}
          <FieldError errors={[{ message: paramErrors[param.name] }]} />
        </Field>
      ))}

      <Button
        type="button"
        disabled={!selectedReport || generateReportMutation.isPending}
        onClick={handleGenerate}
      >
        Generate PDF
      </Button>
    </FieldGroup>
  );
}
```

- [ ] **Step 2: Create `src/components/pdf-management/pdf-preview.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

interface PdfPreviewProps {
  blob: Blob | null;
}

export function PdfPreview({ blob }: PdfPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!objectUrl) return null;

  return (
    <div className="space-y-2">
      <iframe
        src={objectUrl}
        className="h-[600px] w-full rounded-lg border"
        title="Generated report preview"
      />
      <a
        href={objectUrl}
        download="report.pdf"
        className="text-sm text-primary underline underline-offset-4"
      >
        Download PDF
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add src/components/pdf-management/report-generate-form.tsx src/components/pdf-management/pdf-preview.tsx
git commit -m "feat: add report generate form and PDF preview"
```

---

### Task 8: PDF Management page and sidebar nav item

**Files:**
- Create: `src/app/dashboard/pdf-management/page.tsx`
- Modify: `src/components/layout/sidebar-nav.tsx`

**Interfaces:**
- Consumes: `TemplateForm` (Task 6); `ReportGenerateForm`/`PdfPreview` (Task 7); `useSessionStore` from `@/stores/session-store` (pre-existing, `hasPermission(permission: Permission): boolean`); `Card`/`CardContent`/`CardHeader`/`CardTitle` from `@/components/ui/card` (pre-existing); `Permission` type from `@/types/api` (Task 1).
- Produces: the `/dashboard/pdf-management` route; `SidebarNav`'s nav items gain an optional `permission?: Permission[]` field with OR-match filtering — a capability later nav items can reuse.

No automated test. Verified manually in Task 9 (this task's page is the integration point the final manual check exercises).

- [ ] **Step 1: Create `src/app/dashboard/pdf-management/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PdfPreview } from "@/components/pdf-management/pdf-preview";
import { ReportGenerateForm } from "@/components/pdf-management/report-generate-form";
import { TemplateForm } from "@/components/pdf-management/template-form";
import { useSessionStore } from "@/stores/session-store";

export default function PdfManagementPage() {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const canCreateTemplate = useSessionStore((state) => state.hasPermission("template:create"));
  const canGenerateReport = useSessionStore((state) => state.hasPermission("report:generate"));

  if (!canCreateTemplate && !canGenerateReport) {
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have permission to manage PDFs.
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">PDF Management</h1>

      {canCreateTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Create template</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateForm />
          </CardContent>
        </Card>
      )}

      {canGenerateReport && (
        <Card>
          <CardHeader>
            <CardTitle>Generate report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ReportGenerateForm onGenerated={setPdfBlob} />
            <PdfPreview blob={pdfBlob} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Modify `src/components/layout/sidebar-nav.tsx`**

Replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import type { Permission } from "@/types/api";

interface NavItem {
  href: string;
  label: string;
  permission?: Permission[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/profile", label: "Profile" },
  {
    href: "/dashboard/pdf-management",
    label: "PDF Management",
    permission: ["template:create", "report:generate"],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const hasPermission = useSessionStore((state) => state.hasPermission);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || item.permission.some((permission) => hasPermission(permission))
  );

  return (
    <nav className="flex flex-col gap-1 p-4">
      {visibleItems.map((item) => (
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

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add src/app/dashboard/pdf-management/page.tsx src/components/layout/sidebar-nav.tsx
git commit -m "feat: add PDF Management page and gated sidebar nav item"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `yarn test:unit`
Expected: PASS, all tests including the 4 new ones from Task 1

- [ ] **Step 2: Run lint**

Run: `yarn lint`
Expected: no errors

- [ ] **Step 3: Manual browser verification**

Prerequisites: the Go API running at `API_BASE_URL` (default `http://localhost:8080/api/v1`) with at least one existing `ReportDefinition` seeded (via `POST /reports` against the backend directly, or however the team normally seeds one — out of scope for this plan to create), and a seeded user with `template:create` and `report:generate` permissions.

1. `yarn dev`, log in as the seeded admin.
2. Confirm "PDF Management" appears in the sidebar (and would be absent for a user without either permission — spot-check by temporarily checking `hasPermission` logic if no low-permission test account is available).
3. Navigate to `/dashboard/pdf-management`. Confirm both the "Create template" and "Generate report" cards render.
4. Fill in the template form (name + HTML content) and submit. Confirm a success toast appears and the form clears.
5. In the "Generate report" card, select a report from the dropdown. Confirm its params render with the right input type per `paramSchema` entry (text/number/date/checkbox).
6. Leave a required param empty and click "Generate PDF". Confirm an inline "is required" error appears and no request is sent (check the Network tab — no call to `/api/reports/.../generate`).
7. Fill in all required params and click "Generate PDF". Confirm a success toast, and that the PDF renders in the `<iframe>` below with a working "Download PDF" link.
8. Submit an invalid/missing required backend param (if the UI doesn't already block it, e.g. a param type mismatch) and confirm the error toast surfaces the API's message rather than a generic one.

- [ ] **Step 4: Report results**

If any step fails, fix the underlying task's file and re-run from Step 1. Once all steps pass, the plan is complete — no commit needed for this task (verification only).
