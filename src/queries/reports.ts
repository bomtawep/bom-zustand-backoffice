"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, parseJsonOrThrow } from "@/lib/query-helpers";
import type { ErrorResponse, ReportDefinition } from "@/types/api";

export function useReportsQuery() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const response = await fetch("/api/reports");
      return parseJsonOrThrow<ReportDefinition[]>(response);
    },
  });
}

interface GenerateReportMutationInput {
  reportId: string;
  params: Record<string, unknown>;
}

export function useGenerateReportMutation() {
  return useMutation({
    mutationFn: async ({ reportId, params }: GenerateReportMutationInput) => {
      const response = await fetch(`/api/reports/${reportId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      });
      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new ApiError(response.status, error.error ?? "Could not generate report");
      }
      return response.blob();
    },
  });
}
