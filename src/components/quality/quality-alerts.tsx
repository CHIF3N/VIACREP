"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Info, XCircle, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QualityAlert } from "@/lib/quality";

const ICONS = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  error: "border-danger-500/30 bg-danger-50 text-danger-700",
  warning: "border-warning-500/30 bg-warning-50 text-warning-700",
  info: "border-blue-300/40 bg-blue-50 text-blue-700",
};

const ICON_STYLES = {
  error: "text-danger-500",
  warning: "text-warning-500",
  info: "text-blue-500",
};

export function QualityAlerts({ alerts }: { alerts: QualityAlert[] }) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = React.useState(false);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const errors = visible.filter((a) => a.severity === "error").length;
  const warnings = visible.filter((a) => a.severity === "warning").length;

  return (
    <div className="rounded-card border border-hairline bg-white shadow-tile">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-4 text-warning-500" aria-hidden />
          <span className="text-sm font-semibold text-ink-900">Data Quality</span>
          <div className="flex gap-1.5">
            {errors > 0 && (
              <span className="rounded-full bg-danger-50 px-2 py-0.5 text-2xs font-semibold text-danger-700">
                {errors} error{errors > 1 ? "s" : ""}
              </span>
            )}
            {warnings > 0 && (
              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-2xs font-semibold text-warning-700">
                {warnings} warning{warnings > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn("size-4 text-ink-400 transition-transform", collapsed && "rotate-180")}
          aria-hidden
        />
      </button>

      {/* Alert list */}
      {!collapsed && (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {visible.map((alert) => {
            const Icon = ICONS[alert.severity];
            return (
              <li
                key={alert.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 text-sm",
                  STYLES[alert.severity],
                )}
              >
                <Icon className={cn("size-4 shrink-0", ICON_STYLES[alert.severity])} aria-hidden />
                <span className="flex-1">
                  <span className="font-semibold tabular">{alert.count.toLocaleString()}</span>
                  {" "}
                  {alert.message}
                </span>
                {alert.filterHref && (
                  <Link
                    href={alert.filterHref}
                    className="shrink-0 text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
                  >
                    View
                  </Link>
                )}
                <button
                  onClick={() =>
                    setDismissed((prev) => new Set([...prev, alert.id]))
                  }
                  aria-label="Dismiss"
                  className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
