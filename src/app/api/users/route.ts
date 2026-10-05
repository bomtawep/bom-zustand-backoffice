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
  try {
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
  } catch (error) {
    // Catch any errors from cookies(), request.json(), or schema validation
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
