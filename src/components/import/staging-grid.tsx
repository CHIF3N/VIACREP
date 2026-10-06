"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  ArrowRight,
  Database,
  FileSpreadsheet,
  FileText,
  Info,
  Calendar,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StagingRow = {
  date: string | null;
  community: string | null;
  project: string | null;
  thematicArea: string | null;
  ageGroup: string | null;
  activityType?: string | null;
  rawTotalMale: number;
  rawTotalFemale: number;
  declaredTotal?: number | null;
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
  missing_date: { label: "Missing date", severity: "error" },
  missing_community: { label: "Missing community", severity: "error" },
  total_mismatch: { label: "Total mismatch", severity: "warning" },
  zero_participants: { label: "0 participants", severity: "warning" },
};

export function StagingGrid({ documentId, extractedData, isExcel, status }: StagingGridProps) {
  const [committing, setCommitting] = React.useState(false);
  const [committed, setCommitted] = React.useState(status === "COMMITTED");
  const [commitResult, setCommitResult] = React.useState<{ created: number; skipped: number } | null>(null);
  const [commitError, setCommitError] = React.useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<"all" | "clean" | "warning" | "error">("all");

  // Editable row state so users can repair flagged rows right in the UI
  const initialParsed = (extractedData as {
    rows?: StagingRow[];
    errors?: string[];
    warnings?: string[];
    blankRowsIgnored?: number;
  }) ?? { rows: [], errors: [], warnings: [] };

  const [rows, setRows] = React.useState<StagingRow[]>(initialParsed.rows ?? []);
  const [editingRowIndex, setEditingRowIndex] = React.useState<number | null>(null);
  const [editDate, setEditDate] = React.useState("");
  const [editCommunity, setEditCommunity] = React.useState("");

  const errors = initialParsed.errors ?? [];
  const warnings = initialParsed.warnings ?? [];

  if (!isExcel) {
    const pdf = extractedData as Record<string, string | number | null | undefined> | null;
    return (
      <div className="rounded-card border border-hairline bg-white p-6 shadow-tile">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="size-5 text-gold-500" />
          <p className="text-base font-semibold text-ink-900">PDF Narrative Report Extraction Results</p>
        </div>
        {pdf?.reportingPeriod && (
          <div className="mb-3 rounded-control bg-blue-50/70 p-3 text-sm text-ink-800">
            <span className="font-semibold text-blue-900">Reporting Period:</span> {String(pdf.reportingPeriod)}
          </div>
        )}
        {pdf?.pageCount && (
          <p className="text-sm text-ink-500 mb-4">{String(pdf.pageCount)} pages processed successfully</p>
        )}
        {pdf?.executiveSummary && (
          <div className="mt-4 rounded-card border border-hairline bg-ink-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1">Executive Summary</p>
            <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">{String(pdf.executiveSummary)}</p>
          </div>
        )}
        <div className="mt-5 flex items-start gap-2.5 rounded-control bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200">
          <Info className="size-4 shrink-0 text-amber-600 mt-0.5" />
          <p>
            PDF narrative reports are securely archived for audit provenance. Numeric session records are extracted from
            Excel workbooks or manually registered in the Sessions module.
          </p>
        </div>
      </div>
    );
  }

  const errorRows = rows.filter((r) => r.flags.some((f) => FLAG_LABELS[f]?.severity === "error"));
  const warningRows = rows.filter(
    (r) =>
      r.flags.some((f) => FLAG_LABELS[f]?.severity === "warning") &&
      !r.flags.some((f) => FLAG_LABELS[f]?.severity === "error"),
  );
  const cleanRows = rows.filter((r) => r.flags.length === 0);

  // Search filtering
  const filteredRows = rows.filter((r) => {
    if (activeFilter === "clean" && r.flags.length > 0) return false;
    if (activeFilter === "warning" && (r.flags.length === 0 || r.flags.some((f) => FLAG_LABELS[f]?.severity === "error")))
      return false;
    if (activeFilter === "error" && !r.flags.some((f) => FLAG_LABELS[f]?.severity === "error")) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (r.community && r.community.toLowerCase().includes(q)) ||
        (r.date && r.date.includes(q)) ||
        (r.project && r.project.toLowerCase().includes(q)) ||
        (r.thematicArea && r.thematicArea.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  function startEditRow(row: StagingRow) {
    setEditingRowIndex(row.rowIndex);
    setEditDate(row.date ?? "");
    setEditCommunity(row.community ?? "");
  }

  function saveEditRow(rowIndex: number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const newDate = editDate.trim() || null;
        const newCommunity = editCommunity.trim() || null;
        const newFlags = r.flags.filter((f) => {
          if (f === "missing_date" && newDate) return false;
          if (f === "missing_community" && newCommunity) return false;
          return true;
        });
        return {
          ...r,
          date: newDate,
          community: newCommunity,
          flags: newFlags,
        };
      }),
    );
    setEditingRowIndex(null);
  }

  async function handleCommit() {
    setShowConfirmModal(false);
    setCommitting(true);
    setCommitError(null);

    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      const data = (await res.json()) as { created?: number; skipped?: number; error?: string };

      if (!res.ok) {
        setCommitError(data.error ?? "Commit failed. Please try again or inspect server logs.");
        return;
      }

      setCommitted(true);
      setCommitResult({ created: data.created ?? cleanRows.length, skipped: data.skipped ?? 0 });
    } catch {
      setCommitError("Network error occurred while committing sessions.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Parse errors */}
      {errors.length > 0 && (
        <div className="rounded-card border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
            <XCircle className="size-4 shrink-0 text-red-600" />
            <span>Parser errors encountered</span>
          </div>
          <ul className="mt-2 list-inside list-disc text-xs text-red-700 space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings / notices */}
      {warnings.length > 0 && (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
            <Info className="size-4 shrink-0 text-amber-600" />
            <span>Notice regarding workbook layout</span>
          </div>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-800 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Post-commit success celebration banner */}
      {committed && (
        <div className="rounded-card border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="size-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  Data Successfully Ingested into Live Database
                </h3>
                <p className="mt-0.5 text-xs text-emerald-800">
                  {commitResult
                    ? `${commitResult.created} outreach sessions committed.`
                    : "The staged records from this workbook have been added to the master sessions repository."}{" "}
                  Aggregates, key population indicators, and division maps are updated.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/sessions"
                className="inline-flex items-center gap-1.5 rounded-control bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm transition"
              >
                <span>View Ingested Sessions</span>
                <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-control bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-300 hover:bg-emerald-50 transition"
              >
                <span>Dashboard Metrics</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Commit error alert */}
      {commitError && (
        <div className="rounded-card border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="size-4 shrink-0 text-red-600" />
            <span>{commitError}</span>
          </div>
          <button
            onClick={() => setCommitError(null)}
            className="text-2xs font-semibold underline hover:text-red-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action and Summary header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-card border border-hairline bg-white p-4 shadow-tile">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold transition",
              activeFilter === "all"
                ? "bg-ink-900 text-white"
                : "bg-ink-100 text-ink-700 hover:bg-ink-200",
            )}
          >
            <span>All Rows</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-2xs">{rows.length}</span>
          </button>

          <button
            onClick={() => setActiveFilter("clean")}
            className={cn(
              "flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold transition",
              activeFilter === "clean"
                ? "bg-emerald-700 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60",
            )}
          >
            <CheckCircle2 className="size-3.5" />
            <span>Clean</span>
            <span className="rounded-full bg-emerald-200/50 px-1.5 py-0.2 text-2xs">{cleanRows.length}</span>
          </button>

          {warningRows.length > 0 && (
            <button
              onClick={() => setActiveFilter("warning")}
              className={cn(
                "flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold transition",
                activeFilter === "warning"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60",
              )}
            >
              <AlertTriangle className="size-3.5" />
              <span>Warnings</span>
              <span className="rounded-full bg-amber-200/50 px-1.5 py-0.2 text-2xs">{warningRows.length}</span>
            </button>
          )}

          {errorRows.length > 0 && (
            <button
              onClick={() => setActiveFilter("error")}
              className={cn(
                "flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold transition",
                activeFilter === "error"
                  ? "bg-red-700 text-white"
                  : "bg-red-50 text-red-800 hover:bg-red-100 border border-red-200/60",
              )}
            >
              <XCircle className="size-3.5" />
              <span>Errors</span>
              <span className="rounded-full bg-red-200/50 px-1.5 py-0.2 text-2xs">{errorRows.length}</span>
            </button>
          )}
        </div>

        {/* Ingest CTA */}
        <div className="flex items-center gap-2">
          {!committed ? (
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={committing || cleanRows.length === 0}
              className={cn(
                "flex items-center gap-2 rounded-control bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm",
                "hover:bg-blue-700 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition",
              )}
            >
              {committing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Committing Data…</span>
                </>
              ) : (
                <>
                  <Database className="size-4" />
                  <span>Approve & Ingest Clean Rows ({cleanRows.length})</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-control border border-emerald-200">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>Ingested into Database</span>
            </div>
          )}
        </div>
      </div>

      {/* Search and Table */}
      <div className="rounded-card border border-hairline bg-white shadow-tile overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-hairline p-3 bg-ink-50/40">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 size-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="Search community, date, project…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-control bg-white pl-8 pr-3 py-1.5 text-xs text-ink-900 ring-1 ring-ink-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-2xs text-ink-500">
            Showing <span className="font-semibold text-ink-800">{filteredRows.length}</span> of{" "}
            <span className="font-semibold text-ink-800">{rows.length}</span> parsed rows
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="py-12 text-center">
            <FileSpreadsheet className="mx-auto size-8 text-ink-300" />
            <p className="mt-2 text-sm font-semibold text-ink-700">No rows match the filter</p>
            <p className="text-xs text-ink-400 mt-0.5">Try clearing your search query or switching tabs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-ink-50/80 border-b border-hairline font-semibold text-ink-600 uppercase tracking-wider text-2xs">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">Status</th>
                  <th className="px-3 py-2.5">Row</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Community</th>
                  <th className="px-3 py-2.5">Project</th>
                  <th className="px-3 py-2.5">Thematic Area</th>
                  <th className="px-3 py-2.5 text-right">♂ M</th>
                  <th className="px-3 py-2.5 text-right">♀ F</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">Validation / Flags</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filteredRows.map((row) => {
                  const hasError = row.flags.some((f) => FLAG_LABELS[f]?.severity === "error");
                  const hasWarn = !hasError && row.flags.some((f) => FLAG_LABELS[f]?.severity === "warning");
                  const isEditing = editingRowIndex === row.rowIndex;

                  return (
                    <tr
                      key={row.rowIndex}
                      className={cn(
                        "transition-colors",
                        hasError
                          ? "bg-red-50/40 hover:bg-red-50/70"
                          : hasWarn
                          ? "bg-amber-50/30 hover:bg-amber-50/60"
                          : "hover:bg-ink-50/60",
                      )}
                    >
                      <td className="px-3 py-2 text-center">
                        {hasError ? (
                          <span title="Row has validation errors">
                            <XCircle className="size-4 text-red-500 inline-block" />
                          </span>
                        ) : hasWarn ? (
                          <span title="Row has warnings">
                            <AlertTriangle className="size-4 text-amber-500 inline-block" />
                          </span>
                        ) : (
                          <span title="Row verified clean">
                            <CheckCircle2 className="size-4 text-emerald-500 inline-block" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-400 text-2xs font-mono">#{row.rowIndex}</td>

                      {/* Date cell */}
                      <td className="px-3 py-2 font-medium tabular-nums text-ink-800">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="rounded-control bg-white px-2 py-1 text-xs ring-1 ring-blue-500 focus:outline-none"
                          />
                        ) : row.date ? (
                          row.date
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <Calendar className="size-3" /> Missing
                          </span>
                        )}
                      </td>

                      {/* Community cell */}
                      <td className="px-3 py-2 font-medium text-ink-900">
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="e.g. Bokwango"
                            value={editCommunity}
                            onChange={(e) => setEditCommunity(e.target.value)}
                            className="rounded-control bg-white px-2 py-1 text-xs ring-1 ring-blue-500 focus:outline-none"
                          />
                        ) : row.community ? (
                          row.community
                        ) : (
                          <span className="text-red-600 font-semibold">Missing locality</span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-ink-600">{row.project ?? <span className="text-ink-400">—</span>}</td>
                      <td className="px-3 py-2 text-ink-600 max-w-xs truncate" title={row.thematicArea ?? ""}>
                        {row.thematicArea ?? <span className="text-ink-400">—</span>}
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums text-ink-700">{row.rawTotalMale}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-700">{row.rawTotalFemale}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-ink-900">
                        {row.rawTotalMale + row.rawTotalFemale}
                      </td>

                      {/* Flags */}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {row.flags.length === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-2xs font-medium text-emerald-800 border border-emerald-200/50">
                              Verified
                            </span>
                          ) : (
                            row.flags.map((f) => {
                              const info = FLAG_LABELS[f];
                              if (!info) return null;
                              return (
                                <span
                                  key={f}
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-2xs font-semibold",
                                    info.severity === "error"
                                      ? "bg-red-100 text-red-800 border border-red-200"
                                      : "bg-amber-100 text-amber-800 border border-amber-200",
                                  )}
                                >
                                  {info.label}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Row actions */}
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEditRow(row.rowIndex)}
                              className="rounded bg-emerald-600 px-2 py-0.5 text-2xs font-semibold text-white hover:bg-emerald-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRowIndex(null)}
                              className="rounded bg-ink-200 px-2 py-0.5 text-2xs text-ink-700 hover:bg-ink-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : hasError ? (
                          <button
                            onClick={() => startEditRow(row)}
                            className="rounded bg-white px-2 py-0.5 text-2xs font-semibold text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50"
                          >
                            Fix in row
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal (clean accessible inline dialog) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-card bg-white p-6 shadow-xl border border-hairline">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Database className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink-900">Confirm Data Ingestion</h3>
                <p className="text-xs text-ink-500">Vision In Action Master Sessions</p>
              </div>
            </div>

            <div className="mt-4 rounded-control bg-ink-50 p-3.5 text-xs text-ink-700 space-y-2">
              <p>
                You are about to commit <strong className="text-ink-900">{cleanRows.length}</strong> validated outreach
                sessions to the live database.
              </p>
              <p className="text-2xs text-ink-500">
                Key population counts, thematic areas, and participant metrics will immediately update in your
                dashboards, reports, and regional maps.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-control bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommit}
                className="rounded-control bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                Confirm & Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
