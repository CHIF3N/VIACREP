"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Table,
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "success"; documentId: string; rowCount?: number; message?: string }
  | { status: "duplicate"; documentId: string; message?: string }
  | { status: "error"; message: string };

type RecentDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  extractionStatus: string;
  createdAt: string;
  uploadedBy?: { name: string };
  _count?: { sessions: number };
};

export default function ImportPage() {
  const [state, setState] = React.useState<UploadState>({ status: "idle" });
  const [dragging, setDragging] = React.useState(false);
  const [recentDocs, setRecentDocs] = React.useState<RecentDoc[]>([]);
  const [loadingRecent, setLoadingRecent] = React.useState(true);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    async function fetchRecent() {
      try {
        const res = await fetch("/api/import");
        if (res.ok) {
          const data = (await res.json()) as { documents?: RecentDoc[] };
          if (data.documents) setRecentDocs(data.documents);
        }
      } catch (err) {
        console.error("Failed to load recent uploads:", err);
      } finally {
        setLoadingRecent(false);
      }
    }
    void fetchRecent();
  }, []);

  async function handleFile(file: File) {
    setState({ status: "uploading", progress: 0 });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as Record<string, unknown>;

      if (res.status === 409) {
        setState({
          status: "duplicate",
          documentId: json.documentId as string,
          message: (json.message as string) ?? "This exact file has already been committed to the live database.",
        });
        return;
      }

      if (!res.ok) {
        setState({
          status: "error",
          message: (json.message as string) ?? (json.error as string) ?? "Upload failed",
        });
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
        message: json.message as string | undefined,
      });
    } catch {
      setState({ status: "error", message: "Network error occurred — please check connection and try again." });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-400">
          Ingestion & Verification
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">Import & Ingestion Center</h1>
        <p className="mt-2 text-sm text-ink-600">
          Upload Vision In Action Cameroon outreach workbooks or narrative PDF reports. Files are automatically
          parsed, verified for key-population arithmetic, and staged for review before being committed to the live database.
        </p>
      </div>

      {/* Templates & Guidelines bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-card border border-blue-200 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-control bg-blue-600 text-white shadow-xs">
            <Download className="size-4.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-950">Official VIAC Reporting Workbooks</p>
            <p className="text-2xs text-blue-800">
              Download the standardized reporting template or our pre-filled sample workbook to test ingestion.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/VIAC_Sample_Outreach_Data.xlsx"
            download="VIAC_Sample_Outreach_Data.xlsx"
            className="inline-flex items-center gap-1.5 rounded-control bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Sparkles className="size-3.5 text-blue-200" />
            <span>Sample Data (.xlsx)</span>
          </a>
          <a
            href="/Vision_In_Action_Reporting_Template.xlsx"
            download="Vision_In_Action_Reporting_Template.xlsx"
            className="inline-flex items-center gap-1.5 rounded-control bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 ring-1 ring-blue-300 hover:bg-blue-50 transition"
          >
            <FileSpreadsheet className="size-3.5 text-blue-600" />
            <span>Blank Template</span>
          </a>
        </div>
      </div>

      {/* Supported formats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-card border border-hairline bg-white p-4 shadow-tile">
          <Table className="mt-0.5 size-5 shrink-0 text-blue-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink-900">Excel & CSV Workbooks (.xlsx, .csv)</p>
            <p className="mt-0.5 text-xs text-ink-500 leading-relaxed">
              Parses the Data_Entry sheet with nested key-population groups (Sex Workers, IDPs, PWDs, AGYW, AYBM, General).
              Validates sums, auto-matches communities, and filters empty template rows.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-card border border-hairline bg-white p-4 shadow-tile">
          <FileText className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink-900">Narrative Reports (.pdf)</p>
            <p className="mt-0.5 text-xs text-ink-500 leading-relaxed">
              Extracts reporting periods, executive summaries, objectives, and reflections. Stored for donor compliance
              and governance audit tracking.
            </p>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4",
          "rounded-card border-2 border-dashed bg-white transition-all",
          "hover:border-blue-400 hover:bg-blue-50/30",
          dragging ? "scale-[1.01] border-blue-500 bg-blue-50 shadow-lifted" : "border-ink-200",
          state.status === "uploading" && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {state.status === "uploading" ? (
          <div className="flex flex-col items-center gap-3 text-ink-400">
            <div className="size-9 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm font-semibold text-ink-700">Parsing and verifying workbook contents…</p>
            <p className="text-2xs text-ink-400">Evaluating columns, dates, and population matrix</p>
          </div>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-full bg-blue-50 ring-4 ring-blue-50/50">
              <Upload className="size-6 text-blue-600" aria-hidden />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-ink-800">
                {dragging ? "Drop file to upload" : "Drop your Excel workbook or PDF report here"}
              </p>
              <p className="text-xs text-ink-500">
                or <span className="font-semibold text-blue-600 underline">browse your device</span>
              </p>
              <p className="text-2xs text-ink-400 pt-1">Supports .xlsx, .xls, .csv, and .pdf</p>
            </div>
          </>
        )}
      </div>

      {/* Status feedback */}
      {state.status === "success" && (
        <div className="rounded-card border border-emerald-200 bg-emerald-50 p-4 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-950">File processed successfully</p>
              <p className="mt-0.5 text-xs text-emerald-800">
                {state.rowCount !== undefined
                  ? state.rowCount > 0
                    ? `${state.rowCount} outreach session rows parsed and staged for inspection.`
                    : "Workbook structure verified. Note: 0 filled session rows were detected in this sheet (formula template only)."
                  : "File processed — inspect extracted data in review."}
              </p>
              {state.message && <p className="mt-1 text-2xs text-emerald-700 italic">{state.message}</p>}
            </div>
            <button
              onClick={() => router.push(`/import/review/${state.documentId}`)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-control bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-sm transition"
            >
              <span>Review Staged Data</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          {state.rowCount === 0 && (
            <div className="rounded-control bg-white/80 p-3 text-xs text-emerald-900 border border-emerald-200/60 flex items-center justify-between gap-3">
              <span>Want to test with real sample rows? Download our pre-filled sample workbook:</span>
              <a
                href="/VIAC_Sample_Outreach_Data.xlsx"
                download="VIAC_Sample_Outreach_Data.xlsx"
                className="shrink-0 font-bold text-emerald-800 underline hover:text-emerald-950"
              >
                Download Sample Data (.xlsx)
              </a>
            </div>
          )}
        </div>
      )}

      {state.status === "duplicate" && (
        <div className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-950">Duplicate file upload</p>
            <p className="mt-0.5 text-xs text-amber-800">
              {state.message ?? "This exact file has already been uploaded or committed."}
            </p>
          </div>
          <button
            onClick={() => router.push(`/import/review/${state.documentId}`)}
            className="shrink-0 inline-flex items-center gap-1 rounded-control bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition"
          >
            <span>Inspect Existing</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-950">Upload or Parsing Failed</p>
            <p className="mt-0.5 text-xs text-red-800">{state.message}</p>
          </div>
          <button
            onClick={() => setState({ status: "idle" })}
            className="shrink-0 text-2xs font-semibold text-red-800 underline hover:text-red-950"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Recent Ingestion History */}
      <div className="rounded-card border border-hairline bg-white shadow-tile overflow-hidden">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3 bg-ink-50/50">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-ink-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-700">
              Recent Import Batches
            </h3>
          </div>
          <span className="text-2xs text-ink-400">Audit trail</span>
        </div>

        {loadingRecent ? (
          <div className="p-6 text-center text-xs text-ink-400">Loading recent batches…</div>
        ) : recentDocs.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-400">
            No previous uploads found in this environment. Upload your first workbook above.
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {recentDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-ink-50/50 transition-colors text-xs"
              >
                <div className="flex items-center gap-3">
                  {doc.mimeType?.includes("pdf") ? (
                    <FileText className="size-4 text-amber-500 shrink-0" />
                  ) : (
                    <FileSpreadsheet className="size-4 text-blue-600 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-ink-900">{doc.fileName}</p>
                    <p className="text-2xs text-ink-400">
                      Uploaded by {doc.uploadedBy?.name ?? "Coordinator"} •{" "}
                      {new Date(doc.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-2xs font-semibold",
                      doc.extractionStatus === "COMMITTED"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-blue-50 text-blue-800 border border-blue-200",
                    )}
                  >
                    {doc.extractionStatus === "COMMITTED" ? "Committed" : "Staged for Review"}
                  </span>

                  <Link
                    href={`/import/review/${doc.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <span>View</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
