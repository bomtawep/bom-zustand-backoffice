import type { ErrorResponse } from "@/types/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, (data as ErrorResponse).error ?? "Request failed");
  }
  return data as T;
}
