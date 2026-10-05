import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api-client";
import { setTokens } from "@/lib/cookies";
import type { ErrorResponse, TokenResponse } from "@/types/api";

export async function POST(request: Request) {
  const body = await request.json();
  const cookieStore = await cookies();

  const response = await apiFetch("/auth/login", cookieStore, {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    return NextResponse.json(error, { status: response.status });
  }

  const tokens = (await response.json()) as TokenResponse;
  setTokens(cookieStore, tokens);
  return new NextResponse(null, { status: 204 });
}
