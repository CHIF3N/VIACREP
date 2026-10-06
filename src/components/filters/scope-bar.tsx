"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, RotateCcw, X } from "lucide-react";
import { cn, quarterOf, shortMonthName } from "@/lib/utils";
import type { Scope } from "@/lib/scope";

export type ScopeBarOptions = {
  projects: { id: string; name: string }[];
  thematicAreas: { id: string; name: string }[];
  activityTypes: { id: string; name: string }[];
  ageGroups: { id: string; name: string }[];
  communities: { id: string; name: string; divisionSubdivision: string }[];
  officers: { id: string; name: string }[];
  years: number[];
};

const PERIOD_TABS = [
  { key: "month", label: "Month" },
  { key: "range", label: "Selected dates" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
  { key: "all", label: "All time" },
] as const;

/**
 * One control strip drives the dashboard, the sessions list and the report
 * builder. It writes the scope into the URL, so a filtered view is a link
 * someone can send to a colleague.
 */
export function ScopeBar({
  scope,
  options,
  dimensions = ["project", "community", "thematicArea", "activityType"],
  className,
}: {
  scope: Scope;
  options: ScopeBarOptions;
  dimensions?: (
    | "project"
    | "community"
    | "thematicArea"
    | "activityType"
    | "ageGroup"
    | "officer"
  )[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const now = new Date();
  const period = scope.period;
  const year =
    period.kind === "month" ||
    period.kind === "quarter" ||
    period.kind === "year"
      ? period.year
      : now.getUTCFullYear();

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const setPeriodKind = (kind: (typeof PERIOD_TABS)[number]["key"]) => {
    const changes: Record<string, string | null> = {
      period: kind,
      from: null,
      to: null,
    };
    if (kind === "all") {
      changes.year = null;
      changes.month = null;
      changes.quarter = null;
      changes.from = null;
      changes.to = null;
    } else if (kind === "range") {
      const nowStr = now.toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      changes.from = period.kind === "range" ? period.from : thirtyDaysAgo;
      changes.to = period.kind === "range" ? period.to : nowStr;
      changes.year = null;
      changes.month = null;
      changes.quarter = null;
    } else {
      changes.from = null;
      changes.to = null;
      changes.year = String(year);
      changes.month =
        kind === "month"
          ? String(period.kind === "month" ? period.month : now.getUTCMonth() + 1)
          : null;
      changes.quarter =
        kind === "quarter"
          ? String(
              period.kind === "quarter"
                ? period.quarter
                : quarterOf(now.getUTCMonth() + 1),
            )
          : null;
    }
    update(changes);
  };

  const activeFilters = dimensions.filter((d) => Boolean(scope[FILTER_KEY[d]]));
  const hasFilters = activeFilters.length > 0 || period.kind !== "all";

  return (
    <div
      className={cn(
        "rounded-card bg-surface p-3 shadow-card ring-1 ring-ink-100/70 sm:p-4",
        pending && "opacity-70 transition-opacity",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Period */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Reporting period"
            className="inline-flex rounded-control bg-ink-100/70 p-1"
          >
            {PERIOD_TABS.map((tab) => {
              const active = period.kind === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPeriodKind(tab.key)}
                  className={cn(
                    "rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-all duration-150",
                    active
                      ? "bg-white text-ink-900 shadow-tile"
                      : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {period.kind !== "all" && (
            <div className="flex flex-wrap items-center gap-2">
              {period.kind === "range" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-1 rounded-control bg-white px-2 py-1 ring-1 ring-ink-200">
                    <span className="text-2xs font-medium text-ink-500">From</span>
                    <input
                      type="date"
                      value={period.from}
                      onChange={(e) =>
                        e.target.value && update({ from: e.target.value })
                      }
                      className="text-xs text-ink-800 bg-transparent outline-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1 rounded-control bg-white px-2 py-1 ring-1 ring-ink-200">
                    <span className="text-2xs font-medium text-ink-500">To</span>
                    <input
                      type="date"
                      value={period.to}
                      onChange={(e) =>
                        e.target.value && update({ to: e.target.value })
                      }
                      className="text-xs text-ink-800 bg-transparent outline-none cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        update({ from: todayStr, to: todayStr });
                      }}
                      className="rounded px-2 py-1 text-2xs font-medium text-ink-600 bg-ink-100 hover:bg-ink-200 transition-colors"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        const end = d.toISOString().slice(0, 10);
                        const start = new Date(d.getTime() - 7 * 86400000)
                          .toISOString()
                          .slice(0, 10);
                        update({ from: start, to: end });
                      }}
                      className="rounded px-2 py-1 text-2xs font-medium text-ink-600 bg-ink-100 hover:bg-ink-200 transition-colors"
                    >
                      Past 7d
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        const end = d.toISOString().slice(0, 10);
                        const start = new Date(d.getTime() - 30 * 86400000)
                          .toISOString()
                          .slice(0, 10);
                        update({ from: start, to: end });
                      }}
                      className="rounded px-2 py-1 text-2xs font-medium text-ink-600 bg-ink-100 hover:bg-ink-200 transition-colors"
                    >
                      Past 30d
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        const firstDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
                          .toISOString()
                          .slice(0, 10);
                        const todayStr = d.toISOString().slice(0, 10);
                        update({ from: firstDay, to: todayStr });
                      }}
                      className="rounded px-2 py-1 text-2xs font-medium text-ink-600 bg-ink-100 hover:bg-ink-200 transition-colors"
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        const firstDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
                          .toISOString()
                          .slice(0, 10);
                        const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))
                          .toISOString()
                          .slice(0, 10);
                        update({ from: firstDay, to: lastDay });
                      }}
                      className="rounded px-2 py-1 text-2xs font-medium text-ink-600 bg-ink-100 hover:bg-ink-200 transition-colors"
                    >
                      Last Month
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        const from = `${d.getUTCFullYear()}-01-01`;
                        const to = d.toISOString().slice(0, 10);
                        update({ from, to });
                      }}
                      className="rounded px-2 py-1 text-2xs font-medium text-ink-600 bg-ink-100 hover:bg-ink-200 transition-colors"
                    >
                      YTD
                    </button>
                  </div>
                </div>
              )}

              {period.kind === "month" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-1 rounded-control bg-white p-0.5 ring-1 ring-ink-200">
                    <button
                      type="button"
                      onClick={() => {
                        const prevM = period.month === 1 ? 12 : period.month - 1;
                        const prevY = period.month === 1 ? year - 1 : year;
                        update({ month: String(prevM), year: String(prevY) });
                      }}
                      className="flex size-7 items-center justify-center rounded text-ink-600 hover:bg-ink-100 transition-colors"
                      title="Previous month"
                      aria-label="Previous month"
                    >
                      ‹
                    </button>
                    <div className="flex items-center gap-0.5 overflow-x-auto">
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = i + 1;
                        const activeM = period.month === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => update({ month: String(m) })}
                            className={cn(
                              "rounded px-2 py-1 text-2xs font-medium transition-colors",
                              activeM
                                ? "bg-blue-600 text-white font-semibold shadow-xs"
                                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                            )}
                          >
                            {shortMonthName(m)}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextM = period.month === 12 ? 1 : period.month + 1;
                        const nextY = period.month === 12 ? year + 1 : year;
                        update({ month: String(nextM), year: String(nextY) });
                      }}
                      className="flex size-7 items-center justify-center rounded text-ink-600 hover:bg-ink-100 transition-colors"
                      title="Next month"
                      aria-label="Next month"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
              {period.kind === "quarter" && (
                <MiniSelect
                  value={String(period.quarter)}
                  onChange={(v) => update({ quarter: v })}
                  aria-label="Quarter"
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      Q{q}
                    </option>
                  ))}
                </MiniSelect>
              )}
              {period.kind !== "range" && (
                <MiniSelect
                  value={String(year)}
                  onChange={(v) => update({ year: v })}
                  aria-label="Year"
                >
                  {options.years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </MiniSelect>
              )}
            </div>
          )}
        </div>

        {/* Dimensions */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="hidden size-4 text-ink-300 lg:block" aria-hidden />
          {dimensions.map((dimension) => (
            <DimensionSelect
              key={dimension}
              dimension={dimension}
              scope={scope}
              options={options}
              onChange={(value) => update({ [FILTER_KEY[dimension]]: value })}
            />
          ))}
          {hasFilters && (
            <button
              onClick={() =>
                startTransition(() => router.replace(pathname, { scroll: false }))
              }
              className="flex items-center gap-1.5 rounded-control px-2.5 py-2 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Reset
            </button>
          )}
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3">
          {activeFilters.map((dimension) => {
            const key = FILTER_KEY[dimension];
            const label = labelFor(dimension, scope[key]!, options);
            return (
              <button
                key={dimension}
                onClick={() => update({ [key]: null })}
                className="group flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-1.5 pl-2.5 text-2xs font-medium text-blue-800 ring-1 ring-inset ring-blue-200/70 transition-colors hover:bg-blue-100"
              >
                <span className="text-blue-500">{DIMENSION_LABEL[dimension]}</span>
                {label}
                <X className="size-3 text-blue-400 group-hover:text-blue-700" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const FILTER_KEY = {
  project: "projectId",
  community: "communityId",
  thematicArea: "thematicAreaId",
  activityType: "activityTypeId",
  ageGroup: "ageGroupId",
  officer: "createdById",
} as const;

const DIMENSION_LABEL = {
  project: "Project",
  community: "Community",
  thematicArea: "Theme",
  activityType: "Activity",
  ageGroup: "Age",
  officer: "Officer",
} as const;

/** Written out rather than derived — "communitys" and "activitys" are not words. */
const DIMENSION_ALL_LABEL = {
  project: "All projects",
  community: "All communities",
  thematicArea: "All themes",
  activityType: "All activity types",
  ageGroup: "All age groups",
  officer: "All officers",
} as const;

function listFor(
  dimension: keyof typeof FILTER_KEY,
  options: ScopeBarOptions,
): { id: string; name: string }[] {
  switch (dimension) {
    case "project": {
      const list = [...options.projects];
      if (!list.some((p) => p.id === "proj-other" || p.name.includes("Other"))) {
        list.push({ id: "proj-other", name: "Other / Unlisted Initiatives" });
      }
      if (!list.some((p) => p.id === "unassigned")) {
        list.push({ id: "unassigned", name: "Core VIAC (Unassigned)" });
      }
      return list;
    }
    case "community":
      return options.communities;
    case "thematicArea":
      return options.thematicAreas;
    case "activityType":
      return options.activityTypes;
    case "ageGroup":
      return options.ageGroups;
    case "officer":
      return options.officers;
  }
}

function labelFor(
  dimension: keyof typeof FILTER_KEY,
  id: string,
  options: ScopeBarOptions,
) {
  return listFor(dimension, options).find((x) => x.id === id)?.name ?? id;
}

function DimensionSelect({
  dimension,
  scope,
  options,
  onChange,
}: {
  dimension: keyof typeof FILTER_KEY;
  scope: Scope;
  options: ScopeBarOptions;
  onChange: (value: string | null) => void;
}) {
  const key = FILTER_KEY[dimension];
  const list = listFor(dimension, options);
  const value = scope[key] ?? "";

  return (
    <MiniSelect
      value={value}
      onChange={(v) => onChange(v || null)}
      aria-label={DIMENSION_LABEL[dimension]}
      active={Boolean(value)}
    >
      <option value="">{DIMENSION_ALL_LABEL[dimension]}</option>
      {list.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </MiniSelect>
  );
}

function MiniSelect({
  value,
  onChange,
  children,
  active,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  active?: boolean;
} & Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange" | "children"
>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 max-w-[190px] cursor-pointer truncate rounded-control bg-white pr-8 pl-3 text-[13px]",
        "ring-1 ring-inset transition-shadow duration-150",
        "focus:ring-2 focus:ring-blue-500 focus:outline-none",
        active
          ? "font-medium text-blue-800 ring-blue-300"
          : "text-ink-700 ring-ink-200 hover:ring-ink-300",
      )}
      style={{
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23909599' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}
