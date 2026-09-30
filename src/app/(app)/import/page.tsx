"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Table, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "success"; documentId: string; rowCount?: number }
  | { status: "duplicate"; documentId: string }
  | { status: "error"; message: string };

export default function ImportPage() {
  const [state, setState] = React.useState<UploadState>({ status: "idle" });
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setState({ status: "uploading", progress: 0 });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const json = await res.json() as Record<string, unknown>;

      if (res.status === 409) {
        setState({ status: "duplicate", documentId: json.documentId as string });
        return;
      }
      if (!res.ok) {
        setState({ status: "error", message: (json.error as string) ?? "Upload failed" });
        return;
      }

      const rowCount =
        (json.extractedData as Record<string, unknown>)?.rows != null
          ? ((json.extractedData as { rows: unknown[] }).rows.length)
          : undefined;

      setState({
        status: "success",
        documentId: json.documentId as string,
        rowCount,
      });
    } catch {
      setState({ status: "error", message: "Network error — please try again." });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-400">
          Ingestion
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">Import & Ingestion Center</h1>
        <p className="mt-2 text-sm text-ink-500">
          Upload Vision In Action Excel workbooks or narrative PDF reports. Files are
          parsed into a staging area for review before being committed to the live database.
        </p>
      </div>

      {/* Supported formats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-card border border-hairline bg-white p-4 shadow-tile">
          <Table className="mt-0.5 size-5 shrink-0 text-blue-500" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink-900">Excel Workbook (.xlsx)</p>
            <p className="mt-0.5 text-xs text-ink-500">
              Parses the Data_Entry sheet with nested key-population headers.
              Validates counts and flags anomalies before review.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-card border border-hairline bg-white p-4 shadow-tile">
          <FileText className="mt-0.5 size-5 shrink-0 text-gold-500" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink-900">Narrative Report (.pdf)</p>
            <p className="mt-0.5 text-xs text-ink-500">
              Extracts reporting period, executive summary, and narrative sections
              for provenance archiving.
            </p>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex min-h-52 cursor-pointer flex-col items-center justify-center gap-4",
          "rounded-card border-2 border-dashed bg-white transition-all",
          "hover:border-blue-400 hover:bg-blue-50/40",
          dragging
            ? "scale-[1.01] border-blue-500 bg-blue-50 shadow-lifted"
            : "border-ink-200",
          state.status === "uploading" && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.pdf"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {state.status === "uploading" ? (
          <div className="flex flex-col items-center gap-3 text-ink-400">
            <div className="size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm font-medium">Parsing file…</p>
          </div>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-full bg-blue-50">
              <Upload className="size-6 text-blue-500" aria-hidden />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-ink-800">
                {dragging ? "Drop to upload" : "Drop file here or click to browse"}
              </p>
              <p className="mt-1 text-xs text-ink-400">.xlsx and .pdf files supported</p>
            </div>
          </>
        )}
      </div>

      {/* Status feedback */}
      {state.status === "success" && (
        <div className="flex items-start gap-3 rounded-card border border-success-500/30 bg-success-50 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-500" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-success-700">File uploaded successfully</p>
            <p className="mt-0.5 text-xs text-success-700">
              {state.rowCount != null
                ? `${state.rowCount} rows parsed and staged for review.`
                : "File processed — navigate to review to inspect extracted data."}
            </p>
          </div>
          <button
            onClick={() => router.push(`/import/review/${state.documentId}`)}
            className="shrink-0 rounded-control bg-success-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-success-700"
          >
            Review →
          </button>
        </div>
      )}

      {state.status === "duplicate" && (
        <div className="flex items-start gap-3 rounded-card border border-warning-500/30 bg-warning-50 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning-500" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-700">Duplicate file detected</p>
            <p className="mt-0.5 text-xs text-warning-700">
              This exact file has already been uploaded. View the existing staged record?
            </p>
          </div>
          <button
            onClick={() => router.push(`/import/review/${state.documentId}`)}
            className="shrink-0 rounded-control bg-warning-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-warning-700"
          >
            View existing
          </button>
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-start gap-3 rounded-card border border-danger-500/30 bg-danger-50 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger-500" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-danger-700">Upload failed</p>
            <p className="mt-0.5 text-xs text-danger-700">{state.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
