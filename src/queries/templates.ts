"use client";

import { useMutation } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/query-helpers";
import type { CreateTemplateInput } from "@/lib/schemas";
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
