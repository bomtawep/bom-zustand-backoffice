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
