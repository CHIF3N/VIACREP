"use client";

import * as React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type StagingRow = {
  date: string | null;
  community: string | null;
  project: string | null;
  thematicArea: string | null;
  ageGroup: string | null;
  rawTotalMale: number;
  rawTotalFemale: number;
  rowIndex: number;
  flags: string[];
};

type StagingGridProps = {
  documentId: string;
  extractedData: unknown;
  isExcel: boolean;
  status: string;
};

const FLAG_LABELS: Record<string, { label: string; severity: "error" | "warning" }> = {
  missing_date:      { label: "Missing date", severity: "error" },
  missing_community: { label: "Missing community", severity: "error" },
  total_mismatch:    { label: "Total mismatch", severity: "warning" },
};

export function StagingGrid({ documentId, extractedData, isExcel, status }: StagingGridProps) {
  const [committing, setCommitting] = React.useState(false);
  const [committed, setCommitted] = React.useState(status === "COMMITTED");

  if (!isExcel) {
    const pdf = extractedData as Record<string, string | number | null | undefined> | null;
    return (
      <div className="rounded-card border border-hairline bg-white p-6 shadow-tile">
        <p className="mb-4 text-sm font-semibold text-ink-900">PDF Extraction Results</p>
        {pdf?.reportingPeriod && (
          <p className="text-sm text-ink-700">
            <span className="font-medium">Reporting period:</span> {String(pdf.reportingPeriod)}
          </p>
        )}
        {pdf?.pageCount && (
          <p className="text-sm text-ink-500">{String(pdf.pageCount)} pages processed</p>
        )}
        {pdf?.executiveSummary && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Executive Summary</p>
            <p className="mt-1 text-sm text-ink-700 line-clamp-6">{String(pdf.executiveSummary)}</p>
          </div>
        )}
        <p className="mt-4 text-xs text-ink-400">
          PDF reports are archived for provenance. Session data must be entered manually or via Excel.
        </p>
      </div>
    );
  }

  const parsed = extractedData as { rows: StagingRow[]; errors: string[] } | null;
  const rows = parsed?.rows ?? [];
  const errors = parsed?.errors ?? [];

  const errorRows = rows.filter((r) => r.flags.some((f) => FLAG_LABELS[f]?.severity === "error"));
  const warningRows = rows.filter((r) =>
    r.flags.some((f) => FLAG_LABELS[f]?.severity === "warning") &&
    !r.flags.some((f) => FLAG_LABELS[f]?.severity === "error"),
  );
  const cleanRows = rows.filter((r) => r.flags.length === 0);

  async function commitAll() {
    if (!confirm(`Commit ${cleanRows.length} clean rows to the live database?`)) return;
    setCommitting(true);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (res.ok) setCommitted(true);
      else alert("Commit failed — check the server logs.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Parse errors */}
      {errors.length > 0 && (
        <div className="rounded-card border border-danger-500/30 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">Parser errors</p>
          {errors.map((e, i) => (
            <p key={i} className="mt-1 text-xs text-danger-700">{e}</p>
          ))}
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-control border border-success-500/30 bg-success-50 px-3 py-2 text-sm font-medium text-success-700">
          <CheckCircle2 className="size-4" aria-hidden />
          {cleanRows.length} clean
        </div>
        {warningRows.length > 0 && (
          <div className="flex items-center gap-2 rounded-control border border-warning-500/30 bg-warning-50 px-3 py-2 text-sm font-medium text-warning-700">
            <AlertTriangle className="size-4" aria-hidden />
            {warningRows.length} with warnings
          </div>
        )}
        {errorRows.length > 0 && (
          <div className="flex items-center gap-2 rounded-control border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">
            <XCircle className="size-4" aria-hidden />
            {errorRows.length} with errors
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!committed ? (
            <button
              onClick={commitAll}
              disabled={committing || cleanRows.length === 0}
              className={cn(
                "flex items-center gap-2 rounded-control bg-blue-500 px-4 py-2 text-sm font-semibold text-white",
                "hover:bg-blue-600 disabled:opacity-50",
              )}
            >
              {committing && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Approve & Ingest All ({cleanRows.length} rows)
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-medium text-success-700">
              <CheckCircle2 className="size-4" aria-hidden />
              Committed to database
            </span>
          )}
        </div>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto rounded-card border border-hairline bg-white shadow-tile">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-ink-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Community</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Project</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Theme</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">♂</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">♀</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">Total</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.slice(0, 100).map((row) => {
              const hasError = row.flags.some((f) => FLAG_LABELS[f]?.severity === "error");
              const hasWarn = !hasError && row.flags.some((f) => FLAG_LABELS[f]?.severity === "warning");
              return (
                <tr
                  key={row.rowIndex}
                  className={cn(
                    "transition-colors",
                    hasError ? "bg-danger-50/50" : hasWarn ? "bg-warning-50/40" : "hover:bg-ink-50/60",
                  )}
                >
                  <td className="px-4 py-2.5">
                    {hasError ? (
                      <XCircle className="size-4 text-danger-500" aria-label="Error" />
                    ) : hasWarn ? (
                      <AlertTriangle className="size-4 text-warning-500" aria-label="Warning" />
                    ) : (
                      <CheckCircle2 className="size-4 text-success-500" aria-label="Clean" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular text-ink-700">{row.date ?? <span className="text-danger-500">—</span>}</td>
                  <td className="px-4 py-2.5 font-medium text-ink-900">{row.community ?? <span className="text-danger-500">—</span>}</td>
                  <td className="px-4 py-2.5 text-ink-500">{row.project ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-500">{row.thematicArea ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular text-ink-700">{row.rawTotalMale}</td>
                  <td className="px-4 py-2.5 text-right tabular text-ink-700">{row.rawTotalFemale}</td>
                  <td className="px-4 py-2.5 text-right tabular font-semibold text-ink-900">
                    {row.rawTotalMale + row.rawTotalFemale}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {row.flags.map((f) => {
                        const info = FLAG_LABELS[f];
                        if (!info) return null;
                        return (
                          <span
                            key={f}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-2xs font-semibold",
                              info.severity === "error"
                                ? "bg-danger-50 text-danger-700"
                                : "bg-warning-50 text-warning-700",
                            )}
                          >
                            {info.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 100 && (
          <p className="px-4 py-3 text-center text-xs text-ink-400">
            Showing 100 of {rows.length} rows
          </p>
        )}
      </div>
    </div>
  );
}