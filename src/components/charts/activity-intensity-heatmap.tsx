"use client";

import * as React from "react";
import {
  Calendar,
  Flame,
  TrendingUp,
  Clock,
} from "lucide-react";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { SessionListRow } from "@/components/sessions/sessions-table";

export type DayStats = {
  dayIndex: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  shortName: string;
  fullName: string;
  sessions: number;
  participants: number;
  avgPerSession: number;
  share: number; // fraction of total sessions
  intensity: number; // 0 to 4
  topActivity: string | null;
  topCommunity: string | null;
  activityBreakdown: { name: string; count: number }[];
  communityBreakdown: { name: string; count: number }[];
};

const DAYS_CONFIG = [
  { index: 1, shortName: "Mon", fullName: "Monday" },
  { index: 2, shortName: "Tue", fullName: "Tuesday" },
  { index: 3, shortName: "Wed", fullName: "Wednesday" },
  { index: 4, shortName: "Thu", fullName: "Thursday" },
  { index: 5, shortName: "Fri", fullName: "Friday" },
  { index: 6, shortName: "Sat", fullName: "Saturday" },
  { index: 0, shortName: "Sun", fullName: "Sunday" },
];

export function ActivityIntensityHeatmap({
  rows = [],
  className,
}: {
  rows?: SessionListRow[];
  className?: string;
}) {
  const [selectedDayIndex, setSelectedDayIndex] = React.useState<number | null>(
    null,
  );

  const { dayStats, maxSessions, totalSessions, peakDay } =
    React.useMemo(() => {
      const tally: Record<
        number,
        {
          sessions: number;
          participants: number;
          activities: Map<string, number>;
          communities: Map<string, number>;
        }
      > = {};

      for (const d of DAYS_CONFIG) {
        tally[d.index] = {
          sessions: 0,
          participants: 0,
          activities: new Map(),
          communities: new Map(),
        };
      }

      let totalSess = 0;
      let totalPart = 0;

      for (const r of rows) {
        if (!r.date) continue;
        const dateStr =
          r.date.length === 10 ? `${r.date}T00:00:00Z` : r.date;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) continue;

        const dayIdx = d.getUTCDay();
        const slot = tally[dayIdx];
        if (!slot) continue;

        const count = r.total || 0;
        slot.sessions += 1;
        slot.participants += count;
        totalSess += 1;
        totalPart += count;

        if (r.activityType) {
          slot.activities.set(
            r.activityType,
            (slot.activities.get(r.activityType) || 0) + 1,
          );
        }
        if (r.community) {
          slot.communities.set(
            r.community,
            (slot.communities.get(r.community) || 0) + 1,
          );
        }
      }

      let max = 0;
      for (const d of DAYS_CONFIG) {
        if (tally[d.index].sessions > max) {
          max = tally[d.index].sessions;
        }
      }

      const computed: DayStats[] = DAYS_CONFIG.map((cfg) => {
        const item = tally[cfg.index];
        const sessions = item.sessions;
        const participants = item.participants;
        const avg = sessions > 0 ? Math.round(participants / sessions) : 0;
        const share = totalSess > 0 ? sessions / totalSess : 0;

        // Calculate intensity tier 0 to 4
        let intensity = 0;
        if (max > 0 && sessions > 0) {
          const ratio = sessions / max;
          if (ratio >= 0.8) intensity = 4;
          else if (ratio >= 0.55) intensity = 3;
          else if (ratio >= 0.3) intensity = 2;
          else intensity = 1;
        }

        // Top activity
        let topAct: string | null = null;
        let topActCount = 0;
        const actArr: { name: string; count: number }[] = [];
        for (const [name, cnt] of item.activities.entries()) {
          actArr.push({ name, count: cnt });
          if (cnt > topActCount) {
            topActCount = cnt;
            topAct = name;
          }
        }
        actArr.sort((a, b) => b.count - a.count);

        // Top community
        let topComm: string | null = null;
        let topCommCount = 0;
        const commArr: { name: string; count: number }[] = [];
        for (const [name, cnt] of item.communities.entries()) {
          commArr.push({ name, count: cnt });
          if (cnt > topCommCount) {
            topCommCount = cnt;
            topComm = name;
          }
        }
        commArr.sort((a, b) => b.count - a.count);

        return {
          dayIndex: cfg.index,
          shortName: cfg.shortName,
          fullName: cfg.fullName,
          sessions,
          participants,
          avgPerSession: avg,
          share,
          intensity,
          topActivity: topAct,
          topCommunity: topComm,
          activityBreakdown: actArr.slice(0, 4),
          communityBreakdown: commArr.slice(0, 4),
        };
      });

      // Determine peak day
      let peak = computed[0];
      for (const cs of computed) {
        if (
          cs.sessions > peak.sessions ||
          (cs.sessions === peak.sessions && cs.participants > peak.participants)
        ) {
          peak = cs;
        }
      }

      return {
        dayStats: computed,
        maxSessions: max,
        totalSessions: totalSess,
        totalParticipants: totalPart,
        peakDay: peak && peak.sessions > 0 ? peak : null,
      };
    }, [rows]);

  const activeDay = React.useMemo(() => {
    if (selectedDayIndex === null) return null;
    return dayStats.find((d) => d.dayIndex === selectedDayIndex) ?? null;
  }, [selectedDayIndex, dayStats]);

  // Weekend vs Weekday analysis
  const weekdayAnalysis = React.useMemo(() => {
    let weekdaySess = 0;
    let weekendSess = 0;
    for (const d of dayStats) {
      if (d.dayIndex === 0 || d.dayIndex === 6) {
        weekendSess += d.sessions;
      } else {
        weekdaySess += d.sessions;
      }
    }
    const weekdayPct =
      totalSessions > 0 ? (weekdaySess / totalSessions) * 100 : 0;
    const weekendPct =
      totalSessions > 0 ? (weekendSess / totalSessions) * 100 : 0;
    return {
      weekdaySess,
      weekendSess,
      weekdayPct: Math.round(weekdayPct),
      weekendPct: Math.round(weekendPct),
    };
  }, [dayStats, totalSessions]);

  if (rows.length === 0 || totalSessions === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-control bg-ink-50/50 p-6 text-center text-xs text-ink-400">
        No session frequency data recorded for the selected period.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Top Intensity Subtitle & Legend */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {peakDay ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-2xs font-semibold text-blue-800 ring-1 ring-blue-200">
              <Flame className="size-3 text-blue-600 fill-blue-600" />
              <span>
                Peak outreach: <strong>{peakDay.fullName}</strong> ({peakDay.sessions} sessions · {formatNumber(peakDay.participants)} reach)
              </span>
            </div>
          ) : (
            <span className="text-2xs text-ink-500 font-medium">
              Outreach session distribution by day of the week
            </span>
          )}
        </div>

        {/* Intensity Legend */}
        <div className="flex items-center gap-1.5 text-2xs text-ink-500">
          <span className="text-ink-400">Activity:</span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-ink-100 ring-1 ring-ink-200" />
            <span className="text-2xs">None</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-blue-100 ring-1 ring-blue-200" />
            <span className="text-2xs">Low</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-blue-300 ring-1 ring-blue-400" />
            <span className="text-2xs">Mid</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-blue-600 ring-1 ring-blue-700" />
            <span className="text-2xs font-medium text-ink-800">Peak</span>
          </span>
        </div>
      </div>

      {/* 7-Day Heatmap Intensity Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {dayStats.map((day) => {
          const isSelected = selectedDayIndex === day.dayIndex;
          const isPeak = peakDay?.dayIndex === day.dayIndex && day.sessions > 0;

          // Intensity visual styles
          let heatClasses =
            "bg-ink-50/60 border-ink-100 text-ink-600 hover:bg-ink-100/70";
          let badgeColor = "bg-ink-200/80 text-ink-700";

          if (day.intensity === 4) {
            heatClasses =
              "bg-blue-600 border-blue-700 text-white shadow-tile hover:bg-blue-700";
            badgeColor = "bg-white/20 text-white";
          } else if (day.intensity === 3) {
            heatClasses =
              "bg-blue-200/80 border-blue-300/80 text-blue-950 hover:bg-blue-200";
            badgeColor = "bg-blue-300/60 text-blue-900";
          } else if (day.intensity === 2) {
            heatClasses =
              "bg-blue-100/70 border-blue-200 text-blue-900 hover:bg-blue-100";
            badgeColor = "bg-blue-200/60 text-blue-800";
          } else if (day.intensity === 1) {
            heatClasses =
              "bg-blue-50/60 border-blue-100 text-blue-900 hover:bg-blue-50";
            badgeColor = "bg-blue-100/70 text-blue-700";
          }

          return (
            <button
              key={day.dayIndex}
              type="button"
              onClick={() =>
                setSelectedDayIndex(isSelected ? null : day.dayIndex)
              }
              className={cn(
                "group relative flex flex-col justify-between rounded-control border p-3 text-left transition-all duration-150",
                heatClasses,
                isSelected && "ring-2 ring-blue-600 ring-offset-1 scale-[1.02]",
              )}
            >
              {/* Day title & Peak Indicator */}
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "text-xs font-bold tracking-tight",
                    day.intensity === 4 ? "text-white" : "text-ink-900",
                  )}
                >
                  {day.shortName}
                </span>

                {isPeak ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider",
                      badgeColor,
                    )}
                  >
                    ★ Peak
                  </span>
                ) : (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular",
                      badgeColor,
                    )}
                  >
                    {formatPercent(day.share, 0)}
                  </span>
                )}
              </div>

              {/* Sessions Metric */}
              <div className="my-2.5">
                <div
                  className={cn(
                    "text-2xl font-extrabold tracking-tight tabular",
                    day.intensity === 4 ? "text-white" : "text-ink-900",
                  )}
                >
                  {day.sessions}
                </div>
                <div
                  className={cn(
                    "text-2xs font-medium",
                    day.intensity === 4 ? "text-blue-100" : "text-ink-500",
                  )}
                >
                  sessions
                </div>
              </div>

              {/* Relative intensity bar */}
              <div
                className={cn(
                  "h-1 w-full overflow-hidden rounded-full",
                  day.intensity === 4 ? "bg-white/30" : "bg-ink-200/50",
                )}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    day.intensity === 4 ? "bg-white" : "bg-blue-600",
                  )}
                  style={{
                    width: `${maxSessions > 0 ? Math.max((day.sessions / maxSessions) * 100, 4) : 0}%`,
                  }}
                />
              </div>

              {/* Footer info: reach & avg */}
              <div
                className={cn(
                  "mt-2 flex items-center justify-between border-t pt-1.5 text-[11px] tabular",
                  day.intensity === 4
                    ? "border-white/20 text-blue-100"
                    : "border-ink-100 text-ink-500",
                )}
              >
                <span>{formatNumber(day.participants)} reach</span>
                <span>~{day.avgPerSession}/sess</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Deep Dive Drawer */}
      {activeDay && (
        <div className="rounded-control border border-blue-200 bg-blue-50/40 p-4 transition-all animate-in fade-in">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-blue-700" />
              <h4 className="text-xs font-bold tracking-wide text-ink-900 uppercase">
                {activeDay.fullName} Outreach Insights
              </h4>
              <span className="text-2xs font-semibold text-blue-700">
                ({activeDay.sessions} sessions · {formatNumber(activeDay.participants)} participants)
              </span>
            </div>

            <button
              onClick={() => setSelectedDayIndex(null)}
              className="self-start text-2xs font-semibold text-ink-500 hover:text-ink-800 transition-colors"
            >
              Close detail
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {/* Top Activity Formats */}
            <div className="rounded-control bg-white p-3 ring-1 ring-ink-100 shadow-xs">
              <span className="text-2xs font-semibold tracking-wider text-ink-400 uppercase">
                Leading Activities on {activeDay.shortName}
              </span>
              {activeDay.activityBreakdown.length === 0 ? (
                <p className="mt-1 text-2xs text-ink-400">None specified</p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  {activeDay.activityBreakdown.map((act) => (
                    <div
                      key={act.name}
                      className="flex items-center justify-between text-2xs"
                    >
                      <span className="truncate font-medium text-ink-800">
                        {act.name}
                      </span>
                      <span className="font-semibold text-blue-700 tabular">
                        {act.count} sess
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leading Communities */}
            <div className="rounded-control bg-white p-3 ring-1 ring-ink-100 shadow-xs">
              <span className="text-2xs font-semibold tracking-wider text-ink-400 uppercase">
                Active Localities on {activeDay.shortName}
              </span>
              {activeDay.communityBreakdown.length === 0 ? (
                <p className="mt-1 text-2xs text-ink-400">None specified</p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  {activeDay.communityBreakdown.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between text-2xs"
                    >
                      <span className="truncate font-medium text-ink-800">
                        {c.name}
                      </span>
                      <span className="font-semibold text-ink-700 tabular">
                        {c.count} sess
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Productivity Analysis */}
            <div className="rounded-control bg-white p-3 ring-1 ring-ink-100 shadow-xs">
              <span className="text-2xs font-semibold tracking-wider text-ink-400 uppercase">
                Daily Productivity Profile
              </span>
              <div className="mt-1.5 space-y-1 text-2xs text-ink-600">
                <div className="flex justify-between">
                  <span>Share of outreach:</span>
                  <strong className="text-ink-900 tabular">
                    {formatPercent(activeDay.share, 1)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Attendance density:</span>
                  <strong className="text-ink-900 tabular">
                    ~{activeDay.avgPerSession} per session
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-semibold text-blue-700">
                    {activeDay.intensity === 4
                      ? "High-volume peak"
                      : activeDay.intensity >= 2
                        ? "Steady weekday cadence"
                        : "Lighter mobilisation day"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operational Takeaways & Scheduling Recommendations */}
      <div className="grid gap-3 sm:grid-cols-2 pt-1">
        <div className="flex items-start gap-2.5 rounded-control bg-white p-3 ring-1 ring-ink-100 shadow-xs">
          <TrendingUp className="size-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-ink-600 leading-relaxed">
            <strong className="text-ink-900">Most Productive Field Rhythm:</strong>{" "}
            {peakDay ? (
              <span>
                <strong>{peakDay.fullName}s</strong> produce the highest session
                frequency ({peakDay.sessions} sessions,{" "}
                {formatPercent(peakDay.share, 0)} of all outreach). Mobilizing
                community venues on {peakDay.fullName} maximizes attendance.
              </span>
            ) : (
              <span>Sessions are distributed evenly across days.</span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-control bg-white p-3 ring-1 ring-ink-100 shadow-xs">
          <Clock className="size-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-ink-600 leading-relaxed">
            <strong className="text-ink-900">Weekday vs Weekend Deployment:</strong>{" "}
            <span>
              Weekdays account for <strong>{weekdayAnalysis.weekdayPct}%</strong>{" "}
              ({weekdayAnalysis.weekdaySess} sessions), while weekends capture{" "}
              <strong>{weekdayAnalysis.weekendPct}%</strong> (
              {weekdayAnalysis.weekendSess} sessions) for out-of-school and
              working demographics.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
