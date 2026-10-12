"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateReportMutation, useReportsQuery } from "@/queries/reports";
import { useTemplateQuery, useUpdateTemplateMutation } from "@/queries/templates";
import { useSessionStore } from "@/stores/session-store";
import type { ReportParam } from "@/types/api";

interface ReportGenerateFormProps {
  onGenerated: (blob: Blob) => void;
  onReportChange?: () => void;
}

type ParamValue = string | boolean;

function TemplateEditSection({ templateId }: { templateId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const templateQuery = useTemplateQuery(templateId, { enabled: isExpanded });
  const updateTemplateMutation = useUpdateTemplateMutation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [initializedTemplateId, setInitializedTemplateId] = useState<string | null>(null);

  const template = templateQuery.data;
  if (template && initializedTemplateId !== template.id) {
    setInitializedTemplateId(template.id);
    setName(template.name);
    setDescription(template.description ?? "");
    setHtmlContent(template.htmlContent);
  }

  async function handleSave() {
    try {
      await updateTemplateMutation.mutateAsync({ id: templateId, name, description, htmlContent });
      toast.success("Template saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save template");
    }
  }

  return (
    <Field>
      <Button
        type="button"
        variant="ghost"
        className="w-fit justify-start gap-1.5 px-0 text-sm text-muted-foreground hover:bg-transparent"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        {isExpanded ? <ChevronDown /> : <ChevronRight />}
        Edit template
      </Button>

      {isExpanded && (
        <FieldGroup className="rounded-lg border p-4">
          {templateQuery.isLoading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-40 w-full" />
            </>
          ) : templateQuery.isError ? (
            <p className="text-sm text-destructive">
              Could not load template:{" "}
              {templateQuery.error instanceof Error ? templateQuery.error.message : "Unknown error"}
            </p>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="template-edit-name">Name</FieldLabel>
                <Input id="template-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="template-edit-description">Description</FieldLabel>
                <Input
                  id="template-edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="template-edit-html">HTML content</FieldLabel>
                <Textarea
                  id="template-edit-html"
                  rows={10}
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                disabled={updateTemplateMutation.isPending}
                onClick={handleSave}
              >
                Save template
              </Button>
            </>
          )}
        </FieldGroup>
      )}
    </Field>
  );
}

export function ReportGenerateForm({ onGenerated, onReportChange }: ReportGenerateFormProps) {
  const reportsQuery = useReportsQuery();
  const generateReportMutation = useGenerateReportMutation();
  const canUpdateTemplate = useSessionStore((state) => state.hasPermission("template:update"));
  const [selectedReportId, setSelectedReportId] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, ParamValue>>({});
  const [paramErrors, setParamErrors] = useState<Record<string, string>>({});

  const reports = reportsQuery.data ?? [];
  const selectedReport = reports.find((report) => report.id === selectedReportId);

  function handleSelectReport(reportId: string | null) {
    setSelectedReportId(reportId ?? "");
    setParamValues({});
    setParamErrors({});
    onReportChange?.();
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
      if (param.type === "boolean") {
        params[param.name] = Boolean(value);
        continue;
      }
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
        {reportsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading reports...</p>
        )}
        {reportsQuery.isError && (
          <p className="text-sm text-destructive">
            Could not load reports:{" "}
            {reportsQuery.error instanceof Error ? reportsQuery.error.message : "Unknown error"}
          </p>
        )}
      </Field>

      {canUpdateTemplate && selectedReport && (
        <TemplateEditSection key={selectedReport.templateId} templateId={selectedReport.templateId} />
      )}

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
