"use client";

import { useEffect, useState } from "react";

interface PdfPreviewProps {
  blob: Blob | null;
}

export function PdfPreview({ blob }: PdfPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the preview when the blob is removed is a required resource-lifecycle sync, not a derivable render value
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!objectUrl) return null;

  return (
    <div className="space-y-2">
      <iframe
        src={objectUrl}
        className="h-[600px] w-full rounded-lg border"
        title="Generated report preview"
      />
      <a
        href={objectUrl}
        download="report.pdf"
        className="text-sm text-primary underline underline-offset-4"
      >
        Download PDF
      </a>
    </div>
  );
}
