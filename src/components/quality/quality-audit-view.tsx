"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, XCircle, Info, Clock,
  CheckCircle2, ChevronRight, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QualityAlert } from "@/lib/quality";
import type { AuditEntry } from "@/lib/audit";

const SEVERITY_CONFIG = {
  error:   { icon: XCircle,        bg: "bg-danger-50",  ring: "ring-danger-500/20",  text: "text-danger-700",  label: "Error" },
  warning: { icon: AlertTriangle,  bg: "bg-warning-50", ring: "ring-warning-500/20", text: "text-warning-700", label: "Warning" },
  info:    { icon: Info,           bg: "bg-blue-50",    ring: "ring-blue-200/60",    text: "text-blue-700",    label: "Info" },
};

function AlertCard({ alert }: { alert: QualityAlert }) {
  const cfg = SEVERITY_CONFIG[alert.severity];
  const Icon = cfg.icon;
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-card border p-4 ring-1",
      cfg.bg, cfg.ring,
    )}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", cfg.text)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", cfg.text)}>{alert.message}</p>
        <p className="mt-0.5 text-xs text-ink-500">
          {alert.count} session{alert.count !== 1 ? "s" : ""} affected
        </p>
      </div>
      {alert.filterHref && (
        <Link
          href={alert.filterHref}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-semibold transition-colors",
            "border border-hairline bg-white hover:bg-ink-50",
            cfg.text,
          )}
        >
          View <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const dateStr = entry.createdAt instanceof Date
    ? entry.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
    : String(entry.createdAt);

  return (
    <tr className="border-b border-hairline hover:bg-ink-50/60 transition-colors">
      <td className="px-4 py-2.5 text-xs text-ink-500 tabular whitespace-nowrap">{dateStr}</td>
      <td className="px-4 py-2.5 text-sm font-medium text-ink-900">
        {entry.communityName ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-500">
        {entry.sessionDate instanceof Date
          ? entry.sessionDate.toLocaleDateString("en-GB")
          : "—"}
      </td>
      <td className="px-4 py-2.5">
        <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-700">
          {entry.field}
        </code>
      </td>
      <td className="px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.oldValue && (
            <span className="rounded bg-danger-50 px-1.5 py-0.5 text-danger-700 line-through">
              {entry.oldValue.slice(0, 40)}
            </span>
          )}
          {entry.newValue && (
            <span className="rounded bg-success-50 px-1.5 py-0.5 text-success-700">
              {entry.newValue.slice(0, 40)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-500">{entry.userName ?? "System"}</td>
      <td className="px-4 py-2.5">
        {entry.entityId && (
          <Link
            href={`/sessions/${entry.entityId}/history`}
            className="flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            History <ChevronRight className="size-3" aria-hidden />
          </Link>
        )}
      </td>
    </tr>
  );
}

type Tab = "alerts" | "audit";

export function QualityAuditView({
  alerts,
  auditLog,
}: {
  alerts: QualityAlert[];
  auditLog: AuditEntry[];
}) {
  const [tab, setTab] = React.useState<Tab>("alerts");

  const errors   = alerts.filter((a) => a.severity === "error");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos    = alerts.filter((a) => a.severity === "info");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-control border border-hairline bg-white p-1 shadow-tile w-fit">
        {(["alerts", "audit"] as Tab[]).map((t) => {
          const label = t === "alerts"
            ? `Quality Alerts ${alerts.length > 0 ? `(${alerts.length})` : ""}`
            : `Audit Log ${auditLog.length > 0 ? `(${auditLog.length})` : ""}`;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t
                  ? "bg-ink-900 text-white shadow-sm"
                  : "text-ink-500 hover:bg-ink-100",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "alerts" && (
        <div className="space-y-5">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-hairline bg-white py-16 shadow-tile">
              <CheckCircle2 className="size-10 text-success-500" aria-hidden />
              <p className="text-base font-semibold text-ink-900">No quality issues found</p>
              <p className="text-sm text-ink-400">All sessions look healthy.</p>
            </div>
          ) : (
            <>
              {errors.length > 0 && (
                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-danger-600">
                    Errors — require attention
                  </p>
                  <div className="space-y-2">
                    {errors.map((a) => <AlertCard key={a.id} alert={a} />)}
                  </div>
                </section>
              )}
              {warnings.length > 0 && (
                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-warning-600">
                    Warnings
                  </p>
                  <div className="space-y-2">
                    {warnings.map((a) => <AlertCard key={a.id} alert={a} />)}
                  </div>
                </section>
              )}
              {infos.length > 0 && (
                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
                    Info
                  </p>
                  <div className="space-y-2">
                    {infos.map((a) => <AlertCard key={a.id} alert={a} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="overflow-x-auto rounded-card border border-hairline bg-white shadow-tile">
          {auditLog.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Clock className="size-9 text-ink-300" aria-hidden />
              <p className="text-sm font-semibold text-ink-500">No edits recorded yet</p>
              <p className="text-xs text-ink-400">
                All changes to session records will appear here.
              </p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-ink-50">
                  {["Time", "Community", "Session date", "Field", "Change", "By", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}