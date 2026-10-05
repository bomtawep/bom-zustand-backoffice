import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import type { ErrorResponse, MeResponse } from "@/types/api";

export async function GET() {
  const cookieStore = await cookies();

  try {
    const response = await apiFetch("/auth/me", cookieStore, { method: "GET" });
    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      return NextResponse.json(error, { status: response.status });
    }
    const me = (await response.json()) as MeResponse;
    return NextResponse.json(me, { status: 200 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
