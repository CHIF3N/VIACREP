import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aggregate } from "@/lib/aggregate";
import { ALL_TIME } from "@/lib/scope";
import { PageHeader } from "@/components/layout/page-header";
import { MapViewClient } from "@/components/map/map-view-client";

export const metadata = { title: "Map Intelligence" };

export default async function MapPage() {
  const user = await requireUser();
  const data = await aggregate(ALL_TIME, user, { withPrevious: false });

  // Community ids from the aggregation result
  const communityIds = data.byCommunity.map((c) => c.id);

  // Fetch coordinates and gender/project data from DB
  const communitiesWithCoords = await db.community.findMany({
    where: {
      id: { in: communityIds },
      lat: { not: null },
    },
    select: {
      id: true,
      lat: true,
      lng: true,
      name: true,
      subdivision: {
        select: {
          name: true,
          division: { select: { name: true, region: { select: { name: true } } } },
        },
      },
      sessions: {
        select: {
          counts: { select: { sex: true, count: true } },
          project: { select: { name: true } },
        },
      },
    },
  });

  // Build markers merging aggregate stats with geo data
  const aggregateById = new Map(
    data.byCommunity.map((c) => [c.id, c]),
  );

  const markers = communitiesWithCoords.map((c) => {
    const agg = aggregateById.get(c.id);
    const male = c.sessions.flatMap((s) => s.counts)
      .filter((ct) => ct.sex === "MALE")
      .reduce((sum, ct) => sum + ct.count, 0);
    const female = c.sessions.flatMap((s) => s.counts)
      .filter((ct) => ct.sex === "FEMALE")
      .reduce((sum, ct) => sum + ct.count, 0);
    const projects = [...new Set(
      c.sessions.map((s) => s.project?.name).filter((p): p is string => Boolean(p))
    )];

    return {
      id: c.id,
      name: c.name,
      subdivision: c.subdivision.name,
      division: c.subdivision.division.name,
      region: c.subdivision.division.region.name,
      lat: c.lat!,
      lng: c.lng!,
      participants: agg?.participants ?? 0,
      sessions: agg?.sessions ?? 0,
      male,
      female,
      projects,
    };
  }).filter((m) => m.participants > 0);

  return (
    <>
      <PageHeader
        eyebrow="Geospatial"
        title="Map intelligence"
        description={`${markers.length} communities with recorded activity and GPS coordinates`}
      />
      <div className="h-[calc(100vh-220px)] min-h-[540px]">
        <MapViewClient
          markers={markers}
          defaultCenter={[5.2, 9.8]}
          defaultZoom={8}
        />
      </div>
    </>
  );
}