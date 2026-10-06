import { Download, Plus } from "lucide-react";
import { requireUser, canEditSession, seesEverything } from "@/lib/auth";
import { aggregate, getFilterOptions, getDataYears } from "@/lib/aggregate";
import { db } from "@/lib/db";
import { scopeFromSearchParams, scopeToSearchParams } from "@/lib/scope";
import { toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScopeBar } from "@/components/filters/scope-bar";
import {
  ProjectsBar,
  ProjectDetail,
} from "@/components/projects/project-detail";
import {
  SessionsTable,
  SessionsTableToolbar,
  type SessionListRow,
} from "@/components/sessions/sessions-table";

export const metadata = { title: "Sessions" };

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = scopeFromSearchParams(params);
  const user = await requireUser();

  const [data, options, years, sessionAuthors] = await Promise.all([
    aggregate(scope, user, { withPrevious: false }),
    getFilterOptions(),
    getDataYears(),
    db.session.findMany({ select: { id: true, createdById: true } }),
  ]);

  const authorById = new Map(sessionAuthors.map((s) => [s.id, s.createdById]));

  const rows: SessionListRow[] = data.rows
    .slice()
    .reverse() // newest first in the list; the aggregate is date-ascending
    .map((row) => ({
      id: row.id,
      date: toDateInputValue(row.date),
      week: row.week,
      community: row.community,
      divisionSubdivision: row.divisionSubdivision,
      project: row.project,
      activityType: row.activityType,
      thematicArea: row.thematicArea,
      ageGroup: row.ageGroup,
      facilitators: row.facilitators,
      total: row.total,
      createdBy: row.createdBy,
      canEdit: canEditSession(user, authorById.get(row.id) ?? ""),
    }));

  const exportHref = `/api/export/excel?${scopeToSearchParams(scope).toString()}`;
  const hasFilters =
    scope.period.kind !== "all" ||
    Boolean(
      scope.projectId ||
        scope.communityId ||
        scope.thematicAreaId ||
        scope.activityTypeId ||
        scope.createdById,
    );

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Sessions"
        description={
          seesEverything(user)
            ? "Every outreach session logged across South West and North West."
            : `Sessions you logged${user.divisionName ? `, plus everything in ${user.divisionName}` : ""}.`
        }
        actions={
          <>
            <LinkButton href={exportHref} variant="secondary" prefetch={false}>
              <Download className="size-4" aria-hidden />
              Export
            </LinkButton>
            <LinkButton href="/sessions/new">
              <Plus className="size-4" aria-hidden />
              Log a session
            </LinkButton>
          </>
        }
      />

      <ScopeBar
        scope={scope}
        className="mb-4"
        dimensions={
          seesEverything(user)
            ? ["project", "community", "activityType", "officer"]
            : ["project", "community", "activityType"]
        }
        options={{
          projects: options.projects,
          thematicAreas: options.thematicAreas,
          activityTypes: options.activityTypes,
          ageGroups: options.ageGroups,
          communities: options.communities.map((c) => ({
            id: c.id,
            name: c.name,
            divisionSubdivision: `${c.subdivision.division.name} - ${c.subdivision.name}`,
          })),
          officers: options.users,
          years,
        }}
      />

      <ProjectsBar
        projects={options.projects}
        selectedProjectId={scope.projectId}
        rows={rows}
        className="mb-4"
      />

      {scope.projectId && (
        <ProjectDetail
          projectId={scope.projectId}
          projects={options.projects}
          rows={rows}
          periodLabelText={data.label}
          activityTypes={options.activityTypes}
          className="mb-5"
        />
      )}

      <Card className="overflow-hidden">
        <SessionsTableToolbar
          count={data.totals.sessions}
          participants={data.totals.participants}
        />
        <SessionsTable rows={rows} hasFilters={hasFilters} />
      </Card>

      {!seesEverything(user) && (
        <p className="mt-4 flex items-center gap-2 text-2xs text-ink-400">
          <Badge tone="neutral">Officer view</Badge>
          Your role scopes what you can see, never what you can write — you can
          author any report from this data.
        </p>
      )}
    </>
  );
}
