import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId } = (await req.json()) as { documentId: string };
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: { id: true, extractedData: true, extractionStatus: true },
  });

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.extractionStatus === "COMMITTED") {
    return NextResponse.json({ error: "Already committed" }, { status: 409 });
  }

  const parsed = doc.extractedData as {
    rows: Array<{
      date: string | null;
      community: string | null;
      project: string | null;
      thematicArea: string | null;
      ageGroup: string | null;
      flags: string[];
      counts: Record<string, { male: number; female: number }>;
      rawTotalMale: number;
      rawTotalFemale: number;
    }>;
  } | null;

  if (!parsed?.rows) return NextResponse.json({ error: "No parsed data" }, { status: 400 });

  const cleanRows = parsed.rows.filter(
    (r) => !r.flags.includes("missing_date") && !r.flags.includes("missing_community"),
  );

  const [communities, projects, thematicAreas, ageGroups, keyPopulations] = await Promise.all([
    db.community.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.thematicArea.findMany({ select: { id: true, name: true } }),
    db.ageGroup.findMany({ select: { id: true, name: true } }),
    db.keyPopulation.findMany({ select: { id: true, name: true } }),
  ]);

  const findByName = (list: { id: string; name: string }[], name: string | null) =>
    name ? list.find((x) => x.name.toLowerCase() === name.toLowerCase())?.id ?? null : null;

  let created = 0;
  for (const row of cleanRows) {
    const communityId = findByName(communities, row.community);
    if (!communityId) continue;

    const totalParticipants = row.rawTotalMale + row.rawTotalFemale;
    const countRecords: { keyPopulationId: string; sex: "MALE" | "FEMALE"; count: number }[] = [];
    for (const [kpName, { male, female }] of Object.entries(row.counts)) {
      const kpId = findByName(keyPopulations, kpName);
      if (!kpId) continue;
      if (male > 0) countRecords.push({ keyPopulationId: kpId, sex: "MALE", count: male });
      if (female > 0) countRecords.push({ keyPopulationId: kpId, sex: "FEMALE", count: female });
    }

    await db.session.create({
      data: {
        date: new Date(row.date!),
        communityId,
        projectId: findByName(projects, row.project),
        thematicAreaId: findByName(thematicAreas, row.thematicArea),
        ageGroupId: findByName(ageGroups, row.ageGroup),
        totalParticipants,
        sourceDocumentId: documentId,
        createdById: user.id,
        counts: { create: countRecords },
      },
    });
    created++;
  }

  await db.document.update({
    where: { id: documentId },
    data: { extractionStatus: "COMMITTED" },
  });

  return NextResponse.json({ created, skipped: cleanRows.length - created });
}