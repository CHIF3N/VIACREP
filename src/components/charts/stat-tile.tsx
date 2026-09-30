"use client";

import * as React from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { SERIES } from "./chart-kit";

/**
 * A headline figure. The sparkline is decoration for the trend, not a chart to
 * read values off — so it carries no axes, and the delta beside it says the
 * same thing in words for anyone who can't see the slope.
 */
export function StatTile({
  label,
  value,
  suffix,
  delta,
  deltaLabel,
  spark,
  icon,
  tone = "blue",
  footnote,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  /** -1..∞ growth vs the previous period, or null when there's no comparison. */
  delta?: number | null;
  deltaLabel?: string;
  spark?: number[];
  /**
   * A rendered element, not a component: this is a client component, and a
   * server page cannot hand a function across the boundary.
   */
  icon: React.ReactNode;
  tone?: "blue" | "gold" | "ink";
  footnote?: string;
}) {
  const sparkData = (spark ?? []).map((v, i) => ({ i, v }));
  const color =
    tone === "gold" ? SERIES.accent : tone === "ink" ? "#4F5254" : SERIES.primary;

  const iconTone = {
    blue: "bg-blue-50 text-blue-700",
    gold: "bg-gold-50 text-gold-700",
    ink: "bg-ink-100 text-ink-700",
  }[tone];

  return (
    <div className="group relative overflow-hidden rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-100/70 transition-shadow duration-200 hover:shadow-lifted">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
            "[&_svg]:size-4",
            iconTone,
          )}
          aria-hidden
        >
          {icon}
        </span>
      </div>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[34px] leading-none font-semibold tracking-[-0.03em] text-ink-900">
          {typeof value === "number" ? formatNumber(value) : value}
        </span>
        {suffix && (
          <span className="text-[13px] font-medium text-ink-400">{suffix}</span>
        )}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <Delta delta={delta} label={deltaLabel} />
        {sparkData.length > 2 && (
          <div className="h-9 w-24 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#spark-${label.replace(/\W/g, "")})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {footnote && (
        <p className="mt-3 border-t border-ink-100 pt-3 text-2xs text-ink-400">
          {footnote}
        </p>
      )}
    </div>
  );
}

function Delta({ delta, label }: { delta?: number | null; label?: string }) {
  if (delta === undefined) {
    return <span className="text-2xs text-ink-400">{label ?? ""}</span>;
  }
  if (delta === null) {
    return (
      <span className="flex items-center gap-1 text-2xs font-medium text-blue-700">
        New this period
      </span>
    );
  }

  const flat = Math.abs(delta) < 0.005;
  const up = delta > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold",
          flat
            ? "bg-ink-100 text-ink-600"
            : up
              ? "bg-success-50 text-success-700"
              : "bg-danger-50 text-danger-700",
        )}
      >
        <Icon className="size-3" aria-hidden />
        {flat ? "0%" : formatPercent(Math.abs(delta))}
      </span>
      {label && <span className="text-2xs text-ink-400">{label}</span>}
    </span>
  );
}
