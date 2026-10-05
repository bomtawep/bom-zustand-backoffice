import { test, expect } from "@playwright/test";
import { parseJsonOrThrow } from "@/lib/query-helpers";

test("returns parsed JSON when the response is ok", async () => {
  const response = new Response(JSON.stringify({ hello: "world" }), { status: 200 });
  await expect(parseJsonOrThrow<{ hello: string }>(response)).resolves.toEqual({
    hello: "world",
  });
});

test("throws the error message from the body when the response is not ok", async () => {
  const response = new Response(JSON.stringify({ error: "nope" }), { status: 400 });
  await expect(parseJsonOrThrow(response)).rejects.toThrow("nope");
});

test("falls back to a generic message when the body has no error field", async () => {
  const response = new Response(JSON.stringify({}), { status: 500 });
  await expect(parseJsonOrThrow(response)).rejects.toThrow("Request failed");
});

test("throws an ApiError carrying the response status", async () => {
  const response = new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  await expect(parseJsonOrThrow(response)).rejects.toMatchObject({
    name: "ApiError",
    status: 401,
    message: "unauthorized",
  });
});
