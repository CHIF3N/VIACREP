import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Download,
  FileText,
  MapPin,
  Phone,
  Plus,
  Star,
  Users,
  UserRoundCheck,
  Video,
  Brain,
} from "lucide-react";
import { requireUser, seesEverything } from "@/lib/auth";
import { aggregate, getDataYears, getFilterOptions } from "@/lib/aggregate";
import { aggregateMama } from "@/lib/aggregate-mama";
import { aggregateWhw } from "@/lib/aggregate-whw";
import { parseLens } from "@/lib/lens";
import { getQualityAlerts } from "@/lib/quality";
import {
  periodLabel,
  scopeFromSearchParams,
  scopeToSearchParams,
} from "@/lib/scope";
import { formatNumber, toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ScopeBar } from "@/components/filters/scope-bar";
import {
  ProjectsBar,
  ProjectDetail,
} from "@/components/projects/project-detail";
import type { SessionListRow } from "@/components/sessions/sessions-table";
import { StatTile } from "@/components/charts/stat-tile";
import { RankedBars, SERIES } from "@/components/charts/chart-kit";
import {
  AgeGroupChart,
  GenderSplit,
  KeyPopulationChart,
  ParticipantsOverTime,
  SessionsOverTime,
  ActivityIntensityHeatmap,
} from "@/components/charts/charts";
import { LensSwitcher } from "@/components/lens/lens-switcher";
import { QualityAlerts } from "@/components/quality/quality-alerts";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = scopeFromSearchParams(params);
  const user = await requireUser();
  const lens = parseLens(params["lens"]);

  const [data, options, years, qualityAlerts] = await Promise.all([
    aggregate(scope, user),
    getFilterOptions(),
    getDataYears(),
    getQualityAlerts(user),
  ]);

  // Load lens-specific data in parallel
  const [mamaData, whwData] = await Promise.all([
    lens === "mama" ? aggregateMama(scope, user) : Promise.resolve(null),
    lens === "whw" ? aggregateWhw(scope, user) : Promise.resolve(null),
  ]);

  const query = scopeToSearchParams(scope).toString();
  const spark = data.overTime.map((p) => p.participants);
  const sessionSpark = data.overTime.map((p) => p.sessions);
  const comparison =
    scope.period.kind === "month"
      ? "vs last month"
      : scope.period.kind === "quarter"
        ? "vs last quarter"
        : scope.period.kind === "year"
          ? "vs last year"
          : undefined;

  const rows: SessionListRow[] = data.rows.map((row) => ({
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
    canEdit: false,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Community outreach dashboard"
        description={
          <>
            {periodLabel(scope.period)}
            {!seesEverything(user) && user.divisionName && (
              <> · scoped to {user.divisionName} and your own entries</>
            )}
          </>
        }
        actions={
          <>
            <LensSwitcher activeLens={lens} />
            <LinkButton
              href={`/api/export/excel?${query}`}
              variant="secondary"
              prefetch={false}
            >
              <Download className="size-4" aria-hidden />
              Excel
            </LinkButton>
            <LinkButton href={`/reports/build?${query}`} variant="secondary">
              <FileText className="size-4" aria-hidden />
              Build report
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
        className="mb-5"
        dimensions={["project", "community", "thematicArea", "activityType"]}
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

      {/* Quality alerts — always visible when there are issues */}
      {qualityAlerts.length > 0 && (
        <div className="mb-5">
          <QualityAlerts alerts={qualityAlerts} />
        </div>
      )}

      {data.totals.sessions === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="Nothing recorded for this period"
            description="Pick a different period above, or log the first session and this dashboard fills in immediately."
            action={
              <LinkButton href="/sessions/new">
                <Plus className="size-4" aria-hidden />
                Log a session
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5 lg:space-y-6">
          {/* ──────────── KPI Tiles — lens-conditional ──────────── */}
          {lens === "viac" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Total participants"
                value={data.totals.participants}
                icon={<Users />}
                tone="blue"
                spark={spark}
                delta={data.previous?.participantsDelta}
                deltaLabel={comparison}
                footnote={`${formatNumber(data.totals.averagePerSession)} on average per session`}
              />
              <StatTile
                label="Sessions conducted"
                value={data.totals.sessions}
                icon={<Activity />}
                tone="gold"
                spark={sessionSpark}
                delta={data.previous?.sessionsDelta}
                deltaLabel={comparison}
                footnote={
                  data.overTime.length > 1
                    ? `Across ${data.overTime.length} reporting periods`
                    : undefined
                }
              />
              <StatTile
                label="Communities reached"
                value={data.totals.communities}
                icon={<MapPin />}
                tone="ink"
                footnote={
                  data.byDivision.length > 0
                    ? data.byDivision.map((d) => d.name).join(" · ")
                    : undefined
                }
              />
              <StatTile
                label="Facilitators"
                value={data.totals.facilitators}
                icon={<UserRoundCheck />}
                tone="ink"
                footnote={
                  data.facilitators[0]
                    ? `Most active: ${data.facilitators[0].name}`
                    : undefined
                }
              />
            </div>
          )}

          {lens === "mama" && mamaData && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Hotline contacts"
                value={mamaData.hotlineContacts}
                icon={<Phone />}
                tone="blue"
                footnote="Peer/hotline interactions"
              />
              <StatTile
                label="Peer accompaniment"
                value={mamaData.peerAccompanimentCases}
                icon={<Users />}
                tone="gold"
                footnote="MAMA project sessions"
              />
              <StatTile
                label="Safe space outreaches"
                value={mamaData.safeSpaceOutreaches}
                icon={<MapPin />}
                tone="ink"
                footnote="Safe space sessions"
              />
              <StatTile
                label="Mean PASE score"
                value={mamaData.meanPaseScore ?? "—"}
                icon={<Brain />}
                tone="ink"
                footnote="Perceived Abortion Self-Efficacy (5–25)"
              />
            </div>
          )}

          {lens === "whw" && whwData && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Tele-counseling reach"
                value={whwData.telecounselingReach}
                icon={<Video />}
                tone="blue"
                footnote="Telecounseling sessions"
              />
              <StatTile
                label="Complete outcome"
                value={
                  whwData.outcomeCompletionPct !== null
                    ? `${Math.round(whwData.outcomeCompletionPct * 100)}%`
                    : "—"
                }
                icon={<Star />}
                tone="gold"
                footnote={`${whwData.outcomesRecorded} outcomes recorded`}
              />
              <StatTile
                label="Additional care sought"
                value={
                  whwData.additionalCarePct !== null
                    ? `${Math.round(whwData.additionalCarePct * 100)}%`
                    : "—"
                }
                icon={<Activity />}
                tone={
                  whwData.additionalCareDelta !== null && whwData.additionalCareDelta > 0
                    ? "gold"
                    : "ink"
                }
                footnote={`Benchmark: ≤${Math.round(whwData.benchmarks.additionalCarePct * 100)}%`}
              />
              <StatTile
                label="Client satisfaction"
                value={
                  whwData.satisfactionPct !== null
                    ? `${Math.round(whwData.satisfactionPct * 100)}%`
                    : "—"
                }
                icon={<Star />}
                tone={
                  whwData.satisfactionDelta !== null && whwData.satisfactionDelta >= 0
                    ? "blue"
                    : "ink"
                }
                footnote={`Benchmark: ≥${Math.round(whwData.benchmarks.satisfactionPct * 100)}%`}
              />
            </div>
          )}

          {/* ──────────── Charts — universal for all lenses ──────────── */}
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Participants over time"
                description={
                  scope.period.kind === "month"
                    ? "By week within the month"
                    : "By month"
                }
              />
              <CardBody>
                <ParticipantsOverTime
                  data={data.overTime.map((p) => ({
                    label: p.label,
                    participants: p.participants,
                    sessions: p.sessions,
                  }))}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Gender split"
                description="Across every key population"
              />
              <CardBody>
                <GenderSplit male={data.gender.male} female={data.gender.female} />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <Card>
              <CardHeader
                title="Key populations reached"
                description="Split by sex, as recorded in the count matrix"
              />
              <CardBody>
                <KeyPopulationChart
                  data={data.byKeyPopulation.map((k) => ({
                    shortName: k.shortName,
                    male: k.male,
                    female: k.female,
                    total: k.total,
                  }))}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Communities"
                description={`Top ${Math.min(data.byCommunity.length, 8)} of ${data.byCommunity.length} reached`}
                action={
                  <Link
                    href={`/sessions?${query}`}
                    className="flex items-center gap-1 text-[13px] font-medium text-blue-700 transition-colors hover:text-blue-800"
                  >
                    All sessions
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                }
              />
              <CardBody>
                <RankedBars
                  rows={data.byCommunity.slice(0, 8).map((c) => ({
                    id: c.id,
                    name: c.name,
                    participants: c.participants,
                    sessions: c.sessions,
                    meta: c.subdivision,
                  }))}
                  total={data.totals.participants}
                  metaKey
                />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            <Card>
              <CardHeader
                title="Thematic areas"
                description="What the sessions covered"
              />
              <CardBody>
                <RankedBars
                  rows={data.byThematicArea.slice(0, 6)}
                  total={data.totals.participants}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Projects" description="Participants by programme" />
              <CardBody>
                <RankedBars
                  rows={data.byProject}
                  total={data.totals.participants}
                  color={SERIES.accent}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Activity types"
                description="How the sessions were run"
              />
              <CardBody>
                <RankedBars
                  rows={data.byActivityType.slice(0, 6)}
                  total={data.totals.participants}
                  color={SERIES.third}
                />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <Card>
              <CardHeader
                title="Age groups"
                description="Adolescents, youth and adults"
              />
              <CardBody>
                <AgeGroupChart
                  data={data.byAgeGroup.map((a) => ({
                    name: a.name,
                    participants: a.participants,
                  }))}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Sessions conducted"
                description={
                  scope.period.kind === "month" ? "By week" : "By month"
                }
              />
              <CardBody>
                <SessionsOverTime
                  data={data.overTime.map((p) => ({
                    label: p.label,
                    sessions: p.sessions,
                  }))}
                />
              </CardBody>
            </Card>
          </div>

          {/* ──────────── Outreach Activity Intensity Heatmap by Day of the Week ──────────── */}
          <Card>
            <CardHeader
              title="Outreach activity intensity"
              description="Session frequency by day of the week to identify peak field productivity"
            />
            <CardBody>
              <ActivityIntensityHeatmap rows={rows} />
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
