import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import { updateTemplateSchema } from "@/lib/schemas";
import type { ErrorResponse, Template } from "@/types/api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();

  try {
    const response = await apiFetch(`/templates/${id}`, cookieStore, { method: "GET" });
    const data = (await response.json()) as Template | ErrorResponse;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const body = await request.json();
  const parsed = updateTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const response = await apiFetch(`/templates/${id}`, cookieStore, {
      method: "PATCH",
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
