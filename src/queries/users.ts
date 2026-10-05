"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, parseJsonOrThrow } from "@/lib/query-helpers";
import type { CreateUserInput, UpdateUserInput } from "@/lib/schemas";
import type { ErrorResponse, User } from "@/types/api";

interface UsersPage {
  limit: number;
  skip: number;
}

export function useUsersQuery({ limit, skip }: UsersPage) {
  return useQuery({
    queryKey: ["users", { limit, skip }],
    queryFn: async () => {
      const response = await fetch(`/api/users?limit=${limit}&skip=${skip}`);
      return parseJsonOrThrow<User[]>(response);
    },
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: async () => {
      const response = await fetch(`/api/users/${id}`);
      return parseJsonOrThrow<User>(response);
    },
    enabled: Boolean(id),
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<User>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateUserMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<User>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeactivateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new ApiError(response.status, error.error ?? "Could not deactivate user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
