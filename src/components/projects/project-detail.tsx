"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  FolderKanban,
  Activity,
  MapPin,
  Users,
  Plus,
  FileText,
  X,
  Sparkles,
  Calendar,
  Layers,
  Info,
  CheckCircle2,
  Filter,
  HeartHandshake,
  HeartPulse,
} from "lucide-react";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { SessionListRow } from "@/components/sessions/sessions-table";

export type ProjectItem = {
  id: string;
  name: string;
};

/* -------------------------------------------------------------------------- */
/* Projects Bar (Interactive Ribbon)                                          */
/* -------------------------------------------------------------------------- */

export function ProjectsBar({
  projects,
  selectedProjectId,
  rows = [],
  className,
}: {
  projects: ProjectItem[];
  selectedProjectId?: string;
  rows?: SessionListRow[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  // Compute session counts and participant reach per project from current rows
  const projectStats = React.useMemo(() => {
    const counts: Record<string, { sessions: number; participants: number }> = {
      all: { sessions: rows.length, participants: 0 },
      unassigned: { sessions: 0, participants: 0 },
      "proj-other": { sessions: 0, participants: 0 },
    };
    for (const p of projects) {
      counts[p.id] = { sessions: 0, participants: 0 };
    }

    for (const r of rows) {
      const total = r.total || 0;
      counts.all.participants += total;

      if (!r.project) {
        counts.unassigned.sessions += 1;
        counts.unassigned.participants += total;
      } else {
        const found = projects.find(
          (p) =>
            p.name.toLowerCase() === r.project?.toLowerCase() ||
            p.id === r.project,
        );
        if (found) {
          counts[found.id].sessions += 1;
          counts[found.id].participants += total;
        } else if (
          r.project.toLowerCase().includes("other") ||
          r.project.toLowerCase().includes("unlisted")
        ) {
          counts["proj-other"].sessions += 1;
          counts["proj-other"].participants += total;
        } else {
          // If project name doesn't match predefined list, attribute to other/unlisted
          counts["proj-other"].sessions += 1;
          counts["proj-other"].participants += total;
        }
      }
    }
    return counts;
  }, [projects, rows]);

  const selectProject = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!id || id === "all") {
      params.delete("projectId");
    } else {
      params.set("projectId", id);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const isAll = !selectedProjectId;

  // Make sure we have "Other / Unlisted Initiatives" in the list
  const displayProjects = React.useMemo(() => {
    const list = [...projects];
    if (!list.some((p) => p.id === "proj-other" || p.name.includes("Other"))) {
      list.push({ id: "proj-other", name: "Other / Unlisted Initiatives" });
    }
    return list;
  }, [projects]);

  return (
    <div
      className={cn(
        "rounded-card bg-surface p-3 shadow-card ring-1 ring-ink-100/70 sm:p-4",
        pending && "opacity-75 transition-opacity",
        className,
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="size-4 text-blue-600" aria-hidden />
            <h3 className="text-xs font-semibold tracking-wide text-ink-900 uppercase">
              Projects & Programmes
            </h3>
            <span className="hidden text-2xs text-ink-400 sm:inline">
              Select a project to inspect specific community activities & reach
            </span>
          </div>

          {selectedProjectId && (
            <button
              onClick={() => selectProject(null)}
              className="flex items-center gap-1 text-2xs font-medium text-ink-500 transition-colors hover:text-ink-800"
            >
              <X className="size-3" />
              Clear project selection
            </button>
          )}
        </div>

        {/* Scrollable pill ribbon */}
        <div className="scroll-slim flex items-center gap-2 overflow-x-auto pb-1">
          {/* All Projects button */}
          <button
            onClick={() => selectProject(null)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
              isAll
                ? "bg-ink-900 text-white shadow-tile ring-1 ring-ink-900"
                : "bg-ink-100/80 text-ink-600 hover:bg-ink-200/80 hover:text-ink-900",
            )}
          >
            <span>All Projects</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular",
                isAll ? "bg-white/20 text-white" : "bg-ink-200 text-ink-600",
              )}
            >
              {projectStats.all?.sessions ?? 0}
            </span>
          </button>

          {/* Individual Projects */}
          {displayProjects.map((p) => {
            const active = selectedProjectId === p.id;
            const isOther =
              p.id === "proj-other" || p.name.toLowerCase().includes("other");
            const stat = projectStats[p.id] ?? { sessions: 0, participants: 0 };

            return (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
                  active
                    ? isOther
                      ? "bg-amber-600 text-white shadow-tile ring-1 ring-amber-600"
                      : "bg-blue-600 text-white shadow-tile ring-1 ring-blue-600"
                    : isOther
                      ? "bg-amber-50 text-amber-800 ring-1 ring-amber-300/70 hover:bg-amber-100"
                      : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                {isOther && <Sparkles className="size-3 text-amber-500 active:text-white" />}
                <span>{p.name}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular",
                    active
                      ? "bg-white/25 text-white"
                      : isOther
                        ? "bg-amber-200/70 text-amber-900"
                        : "bg-ink-100 text-ink-600",
                  )}
                >
                  {stat.sessions}
                </span>
              </button>
            );
          })}

          {/* Core VIAC (Unassigned) */}
          <button
            onClick={() => selectProject("unassigned")}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
              selectedProjectId === "unassigned"
                ? "bg-ink-800 text-white shadow-tile"
                : "bg-ink-50 text-ink-600 ring-1 ring-dashed ring-ink-200 hover:bg-ink-100",
            )}
          >
            <span>Core VIAC (Unassigned)</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular",
                selectedProjectId === "unassigned"
                  ? "bg-white/20 text-white"
                  : "bg-ink-200 text-ink-700",
              )}
            >
              {projectStats.unassigned?.sessions ?? 0}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Interactive Project Detail Breakdown Component                             */
/* -------------------------------------------------------------------------- */

export function ProjectDetail({
  projectId,
  projects,
  rows = [],
  periodLabelText = "All time",
  activityTypes = [],
  className,
}: {
  projectId: string;
  projects: ProjectItem[];
  rows: SessionListRow[];
  periodLabelText?: string;
  activityTypes?: { id: string; name: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedActivity, setSelectedActivity] = React.useState<string | null>(
    null,
  );

  const isUnassigned = projectId === "unassigned";
  const projectObj = isUnassigned
    ? { id: "unassigned", name: "Core VIAC (Unassigned Outreach)" }
    : projects.find((p) => p.id === projectId) ?? {
        id: projectId,
        name:
          projectId === "proj-other"
            ? "Other / Unlisted Initiatives"
            : projectId,
      };

  const isOther =
    projectId === "proj-other" ||
    projectObj.name.toLowerCase().includes("other") ||
    projectObj.name.toLowerCase().includes("unlisted");

  // Filter rows matching this project
  const projectRows = React.useMemo(() => {
    if (isUnassigned) {
      return rows.filter((r) => !r.project);
    }
    return rows.filter((r) => {
      if (!r.project) return false;
      if (r.project.toLowerCase() === projectObj.name.toLowerCase()) return true;
      if (r.project === projectId) return true;
      if (
        isOther &&
        (r.project.toLowerCase().includes("other") ||
          r.project.toLowerCase().includes("unlisted"))
      ) {
        return true;
      }
      return false;
    });
  }, [rows, projectId, projectObj.name, isUnassigned, isOther]);

  // Aggregate comprehensive stats for this project
  const stats = React.useMemo(() => {
    let totalParticipants = 0;
    const communities = new Set<string>();
    const facilitators = new Set<string>();
    const thematicMap = new Map<string, { sessions: number; participants: number }>();
    const activityMap = new Map<
      string,
      {
        sessions: number;
        participants: number;
        communities: Set<string>;
        rows: SessionListRow[];
      }
    >();
    const communityMap = new Map<
      string,
      { sessions: number; participants: number; subdivision: string }
    >();

    for (const r of projectRows) {
      const rowTotal = r.total || 0;
      totalParticipants += rowTotal;

      if (r.community) {
        communities.add(r.community);
        const cur = communityMap.get(r.community) ?? {
          sessions: 0,
          participants: 0,
          subdivision: r.divisionSubdivision || "Unknown division",
        };
        cur.sessions += 1;
        cur.participants += rowTotal;
        communityMap.set(r.community, cur);
      }

      for (const f of r.facilitators) {
        if (f) facilitators.add(f);
      }

      if (r.thematicArea) {
        const curThem = thematicMap.get(r.thematicArea) ?? {
          sessions: 0,
          participants: 0,
        };
        curThem.sessions += 1;
        curThem.participants += rowTotal;
        thematicMap.set(r.thematicArea, curThem);
      }

      const act = r.activityType || "General Outreach";
      const curAct = activityMap.get(act) ?? {
        sessions: 0,
        participants: 0,
        communities: new Set<string>(),
        rows: [],
      };
      curAct.sessions += 1;
      curAct.participants += rowTotal;
      if (r.community) curAct.communities.add(r.community);
      curAct.rows.push(r);
      activityMap.set(act, curAct);
    }

    const activities = Array.from(activityMap.entries())
      .map(([name, data]) => ({
        name,
        sessions: data.sessions,
        participants: data.participants,
        share: totalParticipants > 0 ? data.participants / totalParticipants : 0,
        avgPerSession:
          data.sessions > 0 ? Math.round(data.participants / data.sessions) : 0,
        distinctCommunities: data.communities.size,
        rows: data.rows,
      }))
      .sort((a, b) => b.participants - a.participants);

    const topCommunities = Array.from(communityMap.entries())
      .map(([name, data]) => ({
        name,
        sessions: data.sessions,
        participants: data.participants,
        subdivision: data.subdivision,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);

    const themes = Array.from(thematicMap.entries())
      .map(([name, data]) => ({
        name,
        sessions: data.sessions,
        participants: data.participants,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    return {
      totalSessions: projectRows.length,
      totalParticipants,
      uniqueCommunities: communities.size,
      uniqueFacilitators: facilitators.size,
      avgPerSession:
        projectRows.length > 0
          ? Math.round(totalParticipants / projectRows.length)
          : 0,
      activities,
      topCommunities,
      themes,
    };
  }, [projectRows]);

  const clearProject = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("projectId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const filterByActivity = (activityName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // Find ID if available
    const found = activityTypes.find(
      (a) => a.name.toLowerCase() === activityName.toLowerCase(),
    );
    if (found) {
      params.set("activityTypeId", found.id);
    } else {
      params.set("activityTypeId", activityName);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const filterByCommunity = (communityName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("communityId", communityName);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Inspect selected activity
  const activeActivityData = React.useMemo(() => {
    if (!selectedActivity) return null;
    return stats.activities.find((a) => a.name === selectedActivity) ?? null;
  }, [selectedActivity, stats.activities]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-tile border border-blue-200/80 bg-gradient-to-b from-blue-50/50 via-white to-white p-5 shadow-card sm:p-6",
        isOther && "border-amber-200/80 from-amber-50/40 via-white to-white",
        className,
      )}
    >
      {/* Decorative accent banner */}
      <div
        className={cn(
          "absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-500",
          isOther && "from-amber-500 via-yellow-400 to-amber-600",
        )}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lifted",
              isOther && "bg-amber-600",
              isUnassigned && "bg-ink-700",
            )}
          >
            {isOther ? (
              <Sparkles className="size-6" />
            ) : isUnassigned ? (
              <Layers className="size-6" />
            ) : (
              <FolderKanban className="size-6" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-ink-900 sm:text-xl">
                {projectObj.name}
              </h2>
              <Badge
                tone={isOther ? "gold" : isUnassigned ? "neutral" : "blue"}
              >
                {isOther
                  ? "Ad-hoc / Unlisted"
                  : isUnassigned
                    ? "Core VIAC Mandate"
                    : "Official Grant"}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5 text-ink-400" />
                <span>Period: {periodLabelText}</span>
              </span>
              <span>·</span>
              <span>
                <strong className="text-ink-800 font-semibold">
                  {stats.totalSessions}
                </strong>{" "}
                sessions logged
              </span>
              <span>·</span>
              <span>
                <strong className="text-ink-800 font-semibold">
                  {formatNumber(stats.totalParticipants)}
                </strong>{" "}
                participants reached
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start">
          <Link
            href={`/sessions/new?projectId=${projectId === "unassigned" ? "" : projectId}`}
            className="flex items-center gap-1.5 rounded-control bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-tile transition-colors hover:bg-blue-700"
          >
            <Plus className="size-3.5" />
            Log session
          </Link>

          <Link
            href={`/reports/build?projectId=${projectId === "unassigned" ? "" : projectId}`}
            className="flex items-center gap-1.5 rounded-control bg-white px-3 py-1.5 text-xs font-medium text-ink-700 ring-1 ring-ink-200 transition-colors hover:bg-ink-50"
          >
            <FileText className="size-3.5 text-ink-500" />
            Report
          </Link>

          <button
            onClick={clearProject}
            className="rounded-control p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            title="Close project breakdown"
            aria-label="Close project breakdown"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-control bg-white p-3.5 ring-1 ring-ink-100 shadow-sm">
          <div className="flex items-center justify-between text-2xs font-semibold tracking-wider text-ink-400 uppercase">
            <span>Total Reach</span>
            <Users className="size-3.5 text-blue-500" />
          </div>
          <p className="mt-1 text-xl font-bold tracking-tight text-ink-900 tabular sm:text-2xl">
            {formatNumber(stats.totalParticipants)}
          </p>
          <span className="text-2xs text-ink-500">community participants</span>
        </div>

        <div className="rounded-control bg-white p-3.5 ring-1 ring-ink-100 shadow-sm">
          <div className="flex items-center justify-between text-2xs font-semibold tracking-wider text-ink-400 uppercase">
            <span>Sessions</span>
            <Activity className="size-3.5 text-indigo-500" />
          </div>
          <p className="mt-1 text-xl font-bold tracking-tight text-ink-900 tabular sm:text-2xl">
            {formatNumber(stats.totalSessions)}
          </p>
          <span className="text-2xs text-ink-500">conducted in scope</span>
        </div>

        <div className="rounded-control bg-white p-3.5 ring-1 ring-ink-100 shadow-sm">
          <div className="flex items-center justify-between text-2xs font-semibold tracking-wider text-ink-400 uppercase">
            <span>Communities</span>
            <MapPin className="size-3.5 text-emerald-500" />
          </div>
          <p className="mt-1 text-xl font-bold tracking-tight text-ink-900 tabular sm:text-2xl">
            {formatNumber(stats.uniqueCommunities)}
          </p>
          <span className="text-2xs text-ink-500">distinct localities</span>
        </div>

        <div className="rounded-control bg-white p-3.5 ring-1 ring-ink-100 shadow-sm">
          <div className="flex items-center justify-between text-2xs font-semibold tracking-wider text-ink-400 uppercase">
            <span>Avg / Session</span>
            <HeartPulse className="size-3.5 text-amber-500" />
          </div>
          <p className="mt-1 text-xl font-bold tracking-tight text-ink-900 tabular sm:text-2xl">
            {stats.avgPerSession}
          </p>
          <span className="text-2xs text-ink-500">participants / session</span>
        </div>
      </div>

      {/* Community Activities Breakdown (Interactive Breakdown Component) */}
      <div className="mt-6 border-t border-ink-100/80 pt-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-blue-600" />
            <h4 className="text-xs font-bold tracking-wider text-ink-900 uppercase">
              Specific Community Activities Conducted Under This Project
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xs font-medium text-ink-500">
              {stats.activities.length} activity format{stats.activities.length === 1 ? "" : "s"}
            </span>
            {selectedActivity && (
              <button
                onClick={() => setSelectedActivity(null)}
                className="text-2xs font-medium text-blue-600 underline hover:text-blue-800"
              >
                Reset activity view
              </button>
            )}
          </div>
        </div>

        <p className="mt-1 text-xs text-ink-500">
          Click any community activity to drill down into dates, localities, and participant attendance.
        </p>

        {stats.activities.length === 0 ? (
          <div className="mt-3 rounded-control bg-white/70 p-6 text-center text-xs text-ink-500 ring-1 ring-ink-100">
            No specific activities recorded for this project in the selected period.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.activities.map((act) => {
              const isSelected = selectedActivity === act.name;

              return (
                <div
                  key={act.name}
                  onClick={() =>
                    setSelectedActivity(isSelected ? null : act.name)
                  }
                  className={cn(
                    "group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-control bg-white p-3.5 shadow-sm transition-all duration-150 ring-1",
                    isSelected
                      ? "ring-2 ring-blue-600 shadow-md bg-blue-50/30"
                      : "ring-ink-100 hover:ring-blue-300 hover:shadow-tile",
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink-900 text-[13px] group-hover:text-blue-700 transition-colors">
                          {act.name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="size-3.5 text-blue-600 shrink-0" />
                        )}
                      </div>
                      <span className="shrink-0 font-bold text-xs text-blue-700 tabular">
                        {formatPercent(act.share, 1)}
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isSelected
                            ? "bg-blue-600"
                            : "bg-gradient-to-r from-blue-500 to-indigo-600",
                        )}
                        style={{ width: `${Math.max(act.share * 100, 4)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-ink-50 pt-2 text-2xs text-ink-500">
                    <span className="tabular">
                      <strong className="text-ink-900 font-semibold">
                        {act.sessions}
                      </strong>{" "}
                      session{act.sessions === 1 ? "" : "s"}
                    </span>
                    <span className="tabular">
                      <strong className="text-ink-900 font-semibold">
                        {formatNumber(act.participants)}
                      </strong>{" "}
                      participants
                    </span>
                    <span className="text-2xs text-ink-400">
                      ~{act.avgPerSession}/sess
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Activity Inspector Drawer */}
        {activeActivityData && (
          <div className="mt-4 rounded-control border border-blue-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="blue">Activity Drilldown</Badge>
                  <h5 className="text-sm font-bold text-ink-900">
                    {activeActivityData.name}
                  </h5>
                  <span className="text-xs text-ink-500">
                    ({activeActivityData.sessions} sessions ·{" "}
                    {formatNumber(activeActivityData.participants)} participants)
                  </span>
                </div>
                <p className="mt-0.5 text-2xs text-ink-500">
                  Conducted across {activeActivityData.distinctCommunities} distinct localities
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => filterByActivity(activeActivityData.name)}
                  className="flex items-center gap-1 rounded-control bg-blue-50 px-2.5 py-1.5 text-2xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <Filter className="size-3" />
                  Filter table to this activity
                </button>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="rounded-control p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  title="Close activity details"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* List of sessions conducted under this activity */}
            <div className="mt-3 divide-y divide-ink-100/60 overflow-hidden rounded-control border border-ink-100">
              <div className="grid grid-cols-12 bg-ink-50/70 px-3 py-1.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                <span className="col-span-3 sm:col-span-2">Date</span>
                <span className="col-span-4 sm:col-span-4">Community & Subdivision</span>
                <span className="col-span-3 sm:col-span-3">Facilitators</span>
                <span className="col-span-2 sm:col-span-2 text-right">Reach</span>
                <span className="hidden sm:col-span-1 sm:block text-right">Actions</span>
              </div>

              {activeActivityData.rows.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-12 items-center px-3 py-2 text-xs transition-colors hover:bg-blue-50/40"
                >
                  <div className="col-span-3 sm:col-span-2 font-medium text-ink-800">
                    <span>{r.date}</span>
                    <span className="ml-1 text-2xs text-ink-400">W{r.week}</span>
                  </div>

                  <div className="col-span-4 sm:col-span-4 truncate">
                    <span className="font-semibold text-ink-900">{r.community}</span>
                    {r.divisionSubdivision && (
                      <span className="block text-2xs text-ink-500 truncate">
                        {r.divisionSubdivision}
                      </span>
                    )}
                  </div>

                  <div className="col-span-3 sm:col-span-3 truncate text-2xs text-ink-600">
                    {r.facilitators.length > 0
                      ? r.facilitators.join(", ")
                      : "VIAC Team"}
                  </div>

                  <div className="col-span-2 sm:col-span-2 text-right font-bold text-ink-900 tabular">
                    {r.total}
                  </div>

                  <div className="hidden sm:col-span-1 sm:flex sm:justify-end">
                    <Link
                      href={`/sessions/${r.id}/history`}
                      className="text-2xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {activeActivityData.rows.length > 8 && (
              <p className="mt-2 text-center text-2xs text-ink-400">
                Showing 8 of {activeActivityData.rows.length} sessions conducted. Use the filter button above to see the full table.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Geographic Localities & Thematic Health Coverage */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2 border-t border-ink-100/80 pt-4">
        {/* Active Communities */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
              <MapPin className="size-3.5 text-ink-500" />
              <span>Active Communities & Localities</span>
            </div>
            <span className="text-2xs text-ink-400">Click to filter</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.topCommunities.length === 0 ? (
              <span className="text-2xs text-ink-400">None recorded in scope</span>
            ) : (
              stats.topCommunities.map((c) => (
                <button
                  key={c.name}
                  onClick={() => filterByCommunity(c.name)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-2xs text-ink-700 ring-1 ring-ink-200 transition-colors hover:bg-blue-50 hover:text-blue-800 hover:ring-blue-300"
                  title={`Filter sessions to ${c.name}`}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-ink-400 font-semibold">
                    ({c.sessions} sess · {c.participants} reach)
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thematic Areas Covered */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
            <HeartHandshake className="size-3.5 text-ink-500" />
            <span>Health & Social Themes Addressed</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.themes.length === 0 ? (
              <span className="text-2xs text-ink-400">
                General health and community sensitisation
              </span>
            ) : (
              stats.themes.map((t) => (
                <span
                  key={t.name}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50/70 px-2.5 py-1 text-2xs text-indigo-900 ring-1 ring-indigo-200/60"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-indigo-600 font-semibold">
                    ({t.sessions})
                  </span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Strategic Project Status Notes */}
      <div className="mt-4 rounded-control bg-ink-50/50 p-3 ring-1 ring-ink-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
          <Info className="size-3.5 text-ink-500" />
          <span>Project Governance & Operational Notes</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">
          {isOther ? (
            <span>
              <strong>Ad-hoc / Unlisted Initiatives:</strong> These outreach
              activities were conducted for partner missions, pilot field trials,
              or newly formulated donor proposals that have not yet been coded as
              permanent grants in VIAC database. When funded, they can be
              promoted to standard projects in Settings.
            </span>
          ) : isUnassigned ? (
            <span>
              <strong>Core VIAC Mandate:</strong> Community outreach sessions
              conducted under VIAC&apos;s baseline health mission without an
              external grant ringfence. Facilitators are deployed across South West
              and North West Cameroon.
            </span>
          ) : (
            <span>
              <strong>{projectObj.name} Grant Framework:</strong> Standardized
              community outreach deployed under donor-approved reporting
              specifications. Field data feeds directly into monthly narrative
              and clinical indicator matrices.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
