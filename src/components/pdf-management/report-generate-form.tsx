"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerateReportMutation, useReportsQuery } from "@/queries/reports";
import type { ReportParam } from "@/types/api";

interface ReportGenerateFormProps {
  onGenerated: (blob: Blob) => void;
}

type ParamValue = string | boolean;

export function ReportGenerateForm({ onGenerated }: ReportGenerateFormProps) {
  const reportsQuery = useReportsQuery();
  const generateReportMutation = useGenerateReportMutation();
  const [selectedReportId, setSelectedReportId] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, ParamValue>>({});
  const [paramErrors, setParamErrors] = useState<Record<string, string>>({});

  const reports = reportsQuery.data ?? [];
  const selectedReport = reports.find((report) => report.id === selectedReportId);

  function handleSelectReport(reportId: string | null) {
    setSelectedReportId(reportId ?? "");
    setParamValues({});
    setParamErrors({});
  }

  function handleParamChange(name: string, value: ParamValue) {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }

  function validateParams(paramSchema: ReportParam[]): boolean {
    const errors: Record<string, string> = {};
    for (const param of paramSchema) {
      if (param.type === "boolean") continue;
      const value = paramValues[param.name];
      if (param.required && (value === undefined || value === "")) {
        errors[param.name] = `${param.label} is required`;
      }
    }
    setParamErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function buildParams(paramSchema: ReportParam[]): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const param of paramSchema) {
      const value = paramValues[param.name];
      if (value === undefined || value === "") continue;
      params[param.name] = param.type === "number" ? Number(value) : value;
    }
    return params;
  }

  async function handleGenerate() {
    if (!selectedReport) return;
    if (!validateParams(selectedReport.paramSchema)) return;

    try {
      const blob = await generateReportMutation.mutateAsync({
        reportId: selectedReport.id,
        params: buildParams(selectedReport.paramSchema),
      });
      onGenerated(blob);
      toast.success("Report generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate report");
    }
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="report-select">Report</FieldLabel>
        <Select value={selectedReportId} onValueChange={handleSelectReport}>
          <SelectTrigger id="report-select">
            <SelectValue placeholder="Select a report" />
          </SelectTrigger>
          <SelectContent>
            {reports.map((report) => (
              <SelectItem key={report.id} value={report.id}>
                {report.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {selectedReport?.paramSchema.map((param) => (
        <Field key={param.name} data-invalid={!!paramErrors[param.name]}>
          <FieldLabel htmlFor={`param-${param.name}`}>{param.label}</FieldLabel>
          {param.type === "boolean" ? (
            <Checkbox
              id={`param-${param.name}`}
              checked={Boolean(paramValues[param.name])}
              onCheckedChange={(checked) => handleParamChange(param.name, checked)}
            />
          ) : (
            <Input
              id={`param-${param.name}`}
              type={param.type === "number" ? "number" : param.type === "date" ? "date" : "text"}
              value={typeof paramValues[param.name] === "string" ? (paramValues[param.name] as string) : ""}
              onChange={(e) => handleParamChange(param.name, e.target.value)}
            />
          )}
          <FieldError errors={[{ message: paramErrors[param.name] }]} />
        </Field>
      ))}

      <Button
        type="button"
        disabled={!selectedReport || generateReportMutation.isPending}
        onClick={handleGenerate}
      >
        Generate PDF
      </Button>
    </FieldGroup>
  );
}
