import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { resolveReport } from "@/lib/resolve-report";
import { getFilterOptions, getDataYears } from "@/lib/aggregate";
import { aggregateMama } from "@/lib/aggregate-mama";
import { aggregateWhw } from "@/lib/aggregate-whw";
import { parseLens } from "@/lib/lens";
import { scopeToSearchParams } from "@/lib/scope";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScopeBar } from "@/components/filters/scope-bar";
import { NarrativeEditor } from "@/components/report/narrative-editor";
import { LensKpiPanel } from "@/components/report/lens-kpi-panel";
import {
  LetterheadDocument,
  LetterheadStyles,
} from "@/components/report/letterhead";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Build a report" };

export default async function BuildReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const lens = parseLens(params.lens);

  const [resolved, options, years] = await Promise.all([
    resolveReport(params, user),
    getFilterOptions(),
    getDataYears(),
  ]);

  const { scope, data, doc, title, origin, carriedFrom, status } = resolved;

  // Donor-specific KPIs, scoped to the same period as the report
  const [mamaScoped, whwScoped] = await Promise.all([
    lens === "mama" ? aggregateMama(scope, user).catch(() => null) : Promise.resolve(null),
    lens === "whw"  ? aggregateWhw(scope, user).catch(() => null)  : Promise.resolve(null),
  ]);

  const query = scopeToSearchParams(scope).toString();
  const lensQuery = lens !== "viac" ? `${query}&lens=${lens}` : query;

  return (
    <>
      <PageHeader
        eyebrow="Report builder"
        title={title}
        description="Statistics are computed from the sessions in scope. The five narrative sections are yours to write — they carry forward from last period."
        breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: "Build" }]}
        actions={
          <>
            <Badge tone="blue">
              {formatNumber(data.totals.sessions)} sessions
            </Badge>
            <Badge tone="gold">
              {formatNumber(data.totals.participants)} participants
            </Badge>
            {lens !== "viac" && (
              <Badge tone={lens === "mama" ? "gold" : "blue"}>
                {lens === "mama" ? "MAMA Network" : "Women Help Women"}
              </Badge>
            )}
          </>
        }
      />

      {!scope.sessionId && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <ScopeBar
            scope={scope}
            className="flex-1"
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
          {/* Lens switcher for report context */}
          <div className="flex shrink-0 items-center gap-1 rounded-control border border-hairline bg-white p-1 shadow-tile">
            {(["viac", "mama", "whw"] as const).map((l) => {
              const label = l === "viac" ? "Universal" : l === "mama" ? "MAMA" : "WHW";
              const href = l === "viac"
                ? `/reports/build?${query}`
                : `/reports/build?${query}&lens=${l}`;
              const active = lens === l;
              return (
                <a
                  key={l}
                  href={href}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-ink-500 hover:bg-ink-100"
                  }`}
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:gap-6">
        <div className="space-y-5">
          {/* Donor KPI panel — shown above the narrative editor for MAMA/WHW lenses */}
          {lens !== "viac" && (mamaScoped || whwScoped) && (
            <div className="rounded-card border border-hairline bg-ink-50/50 p-4 shadow-tile">
              <LensKpiPanel lens={lens} mama={mamaScoped} whw={whwScoped} />
            </div>
          )}
          <NarrativeEditor
            query={lensQuery}
            title={title}
            exportBase="/api/export"
            origin={origin}
            carriedFrom={carriedFrom}
            status={status}
            initial={{
              objectives: docText(doc, 7),
              methodology: docText(doc, 8),
              lessonsLearnt: docText(doc, 9),
              challenges: docText(doc, 10),
              recommendations: docText(doc, 12),
              preparedBy: doc.signature.preparedBy,
              preparedDesignation: doc.signature.preparedDesignation,
              approvedBy: doc.signature.approvedBy,
              approvedDesignation: doc.signature.approvedDesignation,
            }}
          />
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden">
            <CardHeader
              title="Live preview"
              description="Exactly what the PDF will print, letterhead included."
              action={
                <Link
                  href={`/print/report?${lensQuery}`}
                  target="_blank"
                  className="flex items-center gap-1.5 text-[13px] font-medium text-blue-700 transition-colors hover:text-blue-800"
                >
                  Open full page
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              }
            />
            <div className="border-t border-ink-100 bg-ink-100/60 p-3 sm:p-5">
              <div className="scroll-slim max-h-[calc(100vh-16rem)] overflow-auto rounded-[6px] bg-white shadow-lifted">
                <LetterheadStyles />
                <div className="origin-top scale-[0.86] sm:scale-100">
                  <div className="pb-8">
                    <LetterheadDocument doc={doc} />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Pulls the bullet text back out of a built section, for the editor. */
function docText(
  doc: Awaited<ReturnType<typeof resolveReport>>["doc"],
  sectionNumber: number,
) {
  const section = doc.sections.find((s) => s.number === sectionNumber);
  const bullets = section?.blocks.find((b) => b.type === "bullets");
  return bullets && bullets.type === "bullets" ? bullets.items.join("\n") : "";
}