import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import type { ErrorResponse } from "@/types/api";

export async function POST(request: Request) {
  const body = await request.json();
  const cookieStore = await cookies();

  try {
    const response = await apiFetch("/auth/change-password", cookieStore, {
      method: "POST",
      body: JSON.stringify(body),
    });

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
