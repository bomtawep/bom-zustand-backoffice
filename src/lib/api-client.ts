import { clearTokens, getTokens, setTokens, type CookieStore } from "./cookies";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export type FetchFn = typeof fetch;

export class ApiAuthError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "ApiAuthError";
  }
}

async function refreshTokens(
  cookieStore: CookieStore,
  fetchFn: FetchFn
): Promise<string | null> {
  const { refreshToken } = getTokens(cookieStore);
  if (!refreshToken) return null;

  const response = await fetchFn(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens(cookieStore);
    return null;
  }

  const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
  setTokens(cookieStore, tokens);
  return tokens.accessToken;
}

export async function apiFetch(
  path: string,
  cookieStore: CookieStore,
  options: ApiFetchOptions = {},
  fetchFn: FetchFn = fetch
): Promise<Response> {
  const { skipAuth, headers, ...rest } = options;
  const url = `${API_BASE_URL}${path}`;

  const buildHeaders = (accessToken?: string): HeadersInit => ({
    "Content-Type": "application/json",
    ...headers,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  });

  if (skipAuth) {
    return fetchFn(url, { ...rest, headers: buildHeaders() });
  }

  const { accessToken } = getTokens(cookieStore);
  const first = await fetchFn(url, { ...rest, headers: buildHeaders(accessToken) });

  if (first.status !== 401) return first;

  const newAccessToken = await refreshTokens(cookieStore, fetchFn);
  if (!newAccessToken) {
    throw new ApiAuthError();
  }

  return fetchFn(url, { ...rest, headers: buildHeaders(newAccessToken) });
}
