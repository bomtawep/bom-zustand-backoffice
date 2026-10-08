"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PdfPreview } from "@/components/pdf-management/pdf-preview";
import { ReportGenerateForm } from "@/components/pdf-management/report-generate-form";
import { TemplateForm } from "@/components/pdf-management/template-form";
import { useSessionStore } from "@/stores/session-store";

export default function PdfManagementPage() {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const canCreateTemplate = useSessionStore((state) => state.hasPermission("template:create"));
  const canGenerateReport = useSessionStore((state) => state.hasPermission("report:generate"));

  if (!canCreateTemplate && !canGenerateReport) {
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have permission to manage PDFs.
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">PDF Management</h1>

      {canCreateTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Create template</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateForm />
          </CardContent>
        </Card>
      )}

      {canGenerateReport && (
        <Card>
          <CardHeader>
            <CardTitle>Generate report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ReportGenerateForm onGenerated={setPdfBlob} onReportChange={() => setPdfBlob(null)} />
            <PdfPreview blob={pdfBlob} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
