import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api-client";
import type { ErrorResponse, MessageResponse } from "@/types/api";

export async function POST(request: Request) {
  const body = await request.json();
  const cookieStore = await cookies();

  const response = await apiFetch("/auth/forgot-password", cookieStore, {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });

  const data = (await response.json()) as MessageResponse | ErrorResponse;
  return NextResponse.json(data, { status: response.status });
}
