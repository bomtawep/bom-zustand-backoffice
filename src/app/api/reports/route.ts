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
