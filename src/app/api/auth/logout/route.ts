import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api-client";
import { clearTokens, getTokens } from "@/lib/cookies";

export async function POST() {
  const cookieStore = await cookies();
  const { refreshToken } = getTokens(cookieStore);

  if (refreshToken) {
    await apiFetch("/auth/logout", cookieStore, {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });
  }

  clearTokens(cookieStore);
  return new NextResponse(null, { status: 204 });
}
