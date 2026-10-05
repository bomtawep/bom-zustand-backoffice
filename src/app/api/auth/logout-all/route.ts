import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiAuthError } from "@/lib/api-client";
import { clearTokens } from "@/lib/cookies";

export async function POST() {
  const cookieStore = await cookies();

  try {
    await apiFetch("/auth/logout-all", cookieStore, { method: "POST" });
  } catch (error) {
    if (!(error instanceof ApiAuthError)) throw error;
  }

  clearTokens(cookieStore);
  return new NextResponse(null, { status: 204 });
}
