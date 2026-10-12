"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/query-helpers";
import type { CreateTemplateInput, UpdateTemplateInput } from "@/lib/schemas";
import type { Template } from "@/types/api";

export function useCreateTemplateMutation() {
  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<Template>(response);
    },
  });
}

export function useTemplateQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["template", id],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${id}`);
      return parseJsonOrThrow<Template>(response);
    },
    enabled: options?.enabled ?? true,
  });
}

interface UpdateTemplateMutationInput extends UpdateTemplateInput {
  id: string;
}

export function useUpdateTemplateMutation() {
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTemplateMutationInput) => {
      const response = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<Template>(response);
    },
  });
}
