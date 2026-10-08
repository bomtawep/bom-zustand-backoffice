import { test, expect } from "@playwright/test";
import {
  changePasswordSchema,
  createTemplateSchema,
  createUserSchema,
  generateReportSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/schemas";

test("loginSchema rejects an invalid email", () => {
  const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
  expect(result.success).toBe(false);
});

test("loginSchema accepts a valid payload", () => {
  const result = loginSchema.safeParse({ email: "a@b.com", password: "secret" });
  expect(result.success).toBe(true);
});

test("createUserSchema rejects an invalid role", () => {
  const result = createUserSchema.safeParse({
    name: "Ada",
    email: "ada@example.com",
    role: "superadmin",
  });
  expect(result.success).toBe(false);
});

test("resetPasswordSchema rejects mismatched passwords", () => {
  const result = resetPasswordSchema.safeParse({
    token: "t",
    newPassword: "longenough1",
    confirmPassword: "different1",
  });
  expect(result.success).toBe(false);
});

test("changePasswordSchema rejects a new password shorter than 8 characters", () => {
  const result = changePasswordSchema.safeParse({
    oldPassword: "current",
    newPassword: "short",
    confirmPassword: "short",
  });
  expect(result.success).toBe(false);
});

test("createTemplateSchema rejects a missing name", () => {
  const result = createTemplateSchema.safeParse({
    htmlContent: "<p>Hello</p>",
  });
  expect(result.success).toBe(false);
});

test("createTemplateSchema accepts a valid payload without description", () => {
  const result = createTemplateSchema.safeParse({
    name: "Invoice",
    htmlContent: "<p>Hello</p>",
  });
  expect(result.success).toBe(true);
});

test("generateReportSchema rejects a non-object params value", () => {
  const result = generateReportSchema.safeParse({ params: "not-an-object" });
  expect(result.success).toBe(false);
});

test("generateReportSchema accepts an empty params object", () => {
  const result = generateReportSchema.safeParse({ params: {} });
  expect(result.success).toBe(true);
});
