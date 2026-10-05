"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, parseJsonOrThrow } from "@/lib/query-helpers";
import { useSessionStore } from "@/stores/session-store";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from "@/lib/schemas";
import type { ErrorResponse, MeResponse, MessageResponse } from "@/types/api";

export function useMeQuery() {
  const setUser = useSessionStore((state) => state.setUser);

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      const me = await parseJsonOrThrow<MeResponse>(response);
      setUser(me);
      return me;
    },
    retry: false,
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new ApiError(response.status, error.error ?? "Login failed");
      }
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clear);

  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

export function useLogoutAllMutation() {
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clear);

  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout-all", { method: "POST" });
    },
    onSuccess: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    // The backend responds 401 here both for an expired/invalid session and for a merely
    // wrong "current password" (a business-logic rejection, not a session failure). Opt out
    // of the global 401-redirect so a wrong current password surfaces as a normal form error
    // instead of forcing the user out to /login.
    meta: { skipAuthRedirect: true },
    mutationFn: async (input: ChangePasswordInput) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new ApiError(response.status, error.error ?? "Could not change password");
      }
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<MessageResponse>(response);
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: input.token, newPassword: input.newPassword }),
      });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new ApiError(response.status, error.error ?? "Could not reset password");
      }
    },
  });
}
