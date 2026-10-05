import type { ErrorResponse } from "@/types/api";

export async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data as ErrorResponse).error ?? "Request failed");
  }
  return data as T;
}
