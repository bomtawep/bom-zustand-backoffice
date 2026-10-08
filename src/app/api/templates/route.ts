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
