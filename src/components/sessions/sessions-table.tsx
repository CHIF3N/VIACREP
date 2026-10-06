"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil, Trash2, Plus, Search, X } from "lucide-react";
import { Badge, AvatarStack } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ConfirmDialog, useToast } from "@/components/ui/feedback";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { deleteSessionAction } from "@/app/(app)/sessions/actions";

export type SessionListRow = {
  id: string;
  date: string;
  week: number;
  community: string;
  divisionSubdivision: string;
  project: string | null;
  activityType: string | null;
  thematicArea: string | null;
  ageGroup: string | null;
  facilitators: string[];
  total: number;
  createdBy: string;
  canEdit: boolean;
};

export function SessionsTable({
  rows,
  hasFilters,
}: {
  rows: SessionListRow[];
  hasFilters: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = React.useState("");
  const [pendingDelete, setPendingDelete] =
    React.useState<SessionListRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const displayRows = React.useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase().trim();
    return rows.filter(
      (r) =>
        r.date.includes(q) ||
        r.community.toLowerCase().includes(q) ||
        r.divisionSubdivision.toLowerCase().includes(q) ||
        (r.project && r.project.toLowerCase().includes(q)) ||
        (r.activityType && r.activityType.toLowerCase().includes(q)) ||
        r.facilitators.some((f) => f.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await deleteSessionAction(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
    if (result.ok) {
      toast("success", "Session deleted", `${pendingDelete.community}`);
      router.refresh();
    } else {
      toast("error", result.error);
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={hasFilters ? "Nothing matches those filters" : "No sessions logged yet"}
        description={
          hasFilters
            ? "Try widening the period or clearing a filter."
            : "Type up your first paper attendance sheet and the dashboard will come alive."
        }
        action={
          !hasFilters && (
            <LinkButton href="/sessions/new">
              <Plus className="size-4" aria-hidden />
              Log a session
            </LinkButton>
          )
        }
      />
    );
  }

  return (
    <>
      {/* Quick Search Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/40 px-4 py-2.5 sm:px-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search date (e.g. 2026-03), community, facilitator…"
            className="h-8 w-full rounded-control bg-white pl-8 pr-7 text-xs text-ink-900 ring-1 ring-ink-200 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {query && (
          <span className="text-2xs text-ink-500 font-medium">
            Showing {displayRows.length} of {rows.length} sessions
          </span>
        )}
      </div>

      {/* Phones get cards; the table would be unreadable at this width. */}
      <ul className="divide-y divide-ink-100 lg:hidden">
        {displayRows.map((row) => (
          <li key={row.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {row.community}
                </p>
                <p className="mt-0.5 truncate text-2xs text-ink-500">
                  {row.divisionSubdivision}
                </p>
              </div>
              <p className="shrink-0 text-right">
                <span className="block text-lg leading-tight font-semibold text-ink-900 tabular">
                  {formatNumber(row.total)}
                </span>
                <span className="text-2xs text-ink-400">participants</span>
              </p>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">{formatDate(row.date)}</Badge>
              {row.project && <Badge tone="blue">{row.project}</Badge>}
              {row.activityType && <Badge tone="gold">{row.activityType}</Badge>}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <AvatarStack names={row.facilitators} />
              {row.canEdit && (
                <div className="flex gap-1">
                  <Link
                    href={`/sessions/${row.id}/edit`}
                    className="rounded-control p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-blue-700"
                    aria-label="Edit session"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <button
                    onClick={() => setPendingDelete(row)}
                    className="rounded-control p-2 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-500"
                    aria-label="Delete session"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="scroll-slim hidden max-h-[70vh] overflow-auto lg:block">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10">
            <tr>
              {COLUMNS.map((column, i) => (
                <th
                  key={column.label || i}
                  scope="col"
                  className={cn(
                    "border-b border-ink-100 bg-ink-50/90 px-3 py-3 text-2xs font-semibold",
                    "tracking-[0.08em] text-ink-500 uppercase backdrop-blur-sm",
                    column.align === "right" && "text-right",
                    column.hideBelow,
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.id}
                className="group transition-colors hover:bg-blue-50/40"
              >
                <td className="border-b border-ink-100 px-3 py-3 text-[13px] whitespace-nowrap text-ink-700">
                  {formatDate(row.date)}
                  <span className="ml-1.5 text-ink-300">W{row.week}</span>
                </td>
                <td className="border-b border-ink-100 px-3 py-3 text-[13px] font-medium text-ink-900">
                  {row.community}
                </td>
                <td className="hidden border-b border-ink-100 px-3 py-3 text-[13px] whitespace-nowrap text-ink-500 xl:table-cell">
                  {row.divisionSubdivision}
                </td>
                <td className="border-b border-ink-100 px-3 py-3">
                  {row.project ? (
                    <Badge tone="blue">{row.project}</Badge>
                  ) : (
                    <Dash />
                  )}
                </td>
                <td className="hidden border-b border-ink-100 px-3 py-3 xl:table-cell">
                  {row.activityType ? (
                    <Badge tone="gold">{row.activityType}</Badge>
                  ) : (
                    <Dash />
                  )}
                </td>
                <td className="hidden max-w-[200px] border-b border-ink-100 px-3 py-3 text-[13px] text-ink-600 2xl:table-cell">
                  <span className="block truncate" title={row.thematicArea ?? ""}>
                    {row.thematicArea ?? <Dash />}
                  </span>
                </td>
                <td className="border-b border-ink-100 px-3 py-3">
                  <AvatarStack names={row.facilitators} />
                </td>
                <td className="border-b border-ink-100 px-3 py-3 text-right text-sm font-semibold text-ink-900 tabular">
                  {formatNumber(row.total)}
                </td>
                <td className="border-b border-ink-100 px-2 py-3">
                  {row.canEdit && (
                    <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Link
                        href={`/sessions/${row.id}/edit`}
                        className="rounded-control p-2 text-ink-400 transition-colors hover:bg-white hover:text-blue-700"
                        aria-label={`Edit session in ${row.community}`}
                      >
                        <Pencil className="size-4" />
                      </Link>
                      <button
                        onClick={() => setPendingDelete(row)}
                        className="rounded-control p-2 text-ink-400 transition-colors hover:bg-white hover:text-danger-500"
                        aria-label={`Delete session in ${row.community}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        loading={deleting}
        title="Delete this session?"
        body={
          pendingDelete && (
            <>
              The session in{" "}
              <span className="font-medium text-ink-900">
                {pendingDelete.community}
              </span>{" "}
              on {formatDate(pendingDelete.date)} — {formatNumber(pendingDelete.total)}{" "}
              participants — will be removed from every report and export. This
              cannot be undone.
            </>
          )
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function Dash() {
  return <span className="text-ink-300">—</span>;
}

/**
 * Nine columns will not fit a laptop without pushing Participants — the number
 * people actually came for — off the right edge. The secondary columns drop out
 * as the window narrows; the full set is always in the Excel export.
 */
const COLUMNS: {
  label: string;
  align?: "right";
  hideBelow?: string;
}[] = [
  { label: "Date" },
  { label: "Community" },
  { label: "Division — Subdivision", hideBelow: "hidden xl:table-cell" },
  { label: "Project" },
  { label: "Activity", hideBelow: "hidden xl:table-cell" },
  { label: "Thematic area", hideBelow: "hidden 2xl:table-cell" },
  { label: "Facilitators" },
  { label: "Participants", align: "right" },
  { label: "" },
];

export function SessionsTableToolbar({
  count,
  participants,
}: {
  count: number;
  participants: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-ink-100 px-5 py-3.5">
      <p className="text-[13px] text-ink-500">
        <span className="font-semibold text-ink-900 tabular">
          {formatNumber(count)}
        </span>{" "}
        session{count === 1 ? "" : "s"}
      </p>
      <span className="hidden h-3 w-px bg-ink-200 sm:block" aria-hidden />
      <p className="text-[13px] text-ink-500">
        <span className="font-semibold text-ink-900 tabular">
          {formatNumber(participants)}
        </span>{" "}
        participants
      </p>
    </div>
  );
}
