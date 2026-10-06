import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function matchLookup(list: { id: string; name: string }[], name: string | null): string | null {
  if (!name || !name.trim()) return null;
  const raw = name.trim();
  const lower = raw.toLowerCase();

  // 1. Direct exact or case-insensitive match
  const exact = list.find((x) => x.name.toLowerCase() === lower);
  if (exact) return exact.id;

  // 2. Normalized alphanumeric match (ignores multiple spaces, hyphens, brackets)
  const norm = cleanStr(raw);
  const normMatch = list.find((x) => cleanStr(x.name) === norm);
  if (normMatch) return normMatch.id;

  // 3. Substring / acronym match
  const subMatch = list.find(
    (x) => cleanStr(x.name).includes(norm) || (norm.length >= 3 && norm.includes(cleanStr(x.name))),
  );
  if (subMatch) return subMatch.id;

  return null;
}

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
    return NextResponse.json({ error: "This import batch has already been committed." }, { status: 409 });
  }

  const parsed = doc.extractedData as {
    rows: Array<{
      date: string | null;
      community: string | null;
      project: string | null;
      thematicArea: string | null;
      ageGroup: string | null;
      activityType?: string | null;
      flags: string[];
      counts: Record<string, { male: number; female: number }>;
      rawTotalMale: number;
      rawTotalFemale: number;
    }>;
  } | null;

  if (!parsed?.rows || parsed.rows.length === 0) {
    return NextResponse.json({ error: "No parsed rows to commit." }, { status: 400 });
  }

  // Filter out rows with fatal errors (missing date or missing community)
  const validRows = parsed.rows.filter(
    (r) => !r.flags.includes("missing_date") && !r.flags.includes("missing_community"),
  );

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found to commit. Please resolve missing date or community errors first." },
      { status: 400 },
    );
  }

  const [communities, projects, thematicAreas, ageGroups, activityTypes, keyPopulations, subdivisions] =
    await Promise.all([
      db.community.findMany({ select: { id: true, name: true } }),
      db.project.findMany({ select: { id: true, name: true } }),
      db.thematicArea.findMany({ select: { id: true, name: true } }),
      db.ageGroup.findMany({ select: { id: true, name: true } }),
      db.activityType.findMany({ select: { id: true, name: true } }),
      db.keyPopulation.findMany({ select: { id: true, name: true } }),
      db.subdivision.findMany({ select: { id: true, name: true }, take: 1 }),
    ]);

  // Default activity type to "Community Outreach"
  const defaultActivityId =
    activityTypes.find((a) => cleanStr(a.name).includes("communityoutreach"))?.id ??
    activityTypes[0]?.id ??
    null;

  let created = 0;
  const skippedReasons: string[] = [];

  for (const row of validRows) {
    if (!row.date) {
      skippedReasons.push(`Row skipped: missing valid date`);
      continue;
    }

    // Community matching
    let communityId = matchLookup(communities, row.community);

    if (!communityId && row.community) {
      // Auto-create community if it doesn't exist yet
      try {
        const fallbackSubdivisionId = subdivisions[0]?.id ?? "sub-1";
        const newComm = await db.community.create({
          data: {
            name: row.community.trim(),
            subdivisionId: fallbackSubdivisionId,
            isCustom: true,
            createdById: user.id,
          },
        });
        communityId = newComm.id;
        communities.push({ id: newComm.id, name: newComm.name });
      } catch (err) {
        console.error("Failed to auto-create community:", err);
      }
    }

    if (!communityId) {
      skippedReasons.push(`Row for date ${row.date}: community "${row.community}" could not be resolved`);
      continue;
    }

    // Project matching
    let projectId = matchLookup(projects, row.project);
    if (!projectId && row.project) {
      const pNorm = cleanStr(row.project);
      if (pNorm.includes("viac")) projectId = projects.find((p) => cleanStr(p.name).includes("viac"))?.id ?? null;
      else if (pNorm.includes("sps")) projectId = projects.find((p) => cleanStr(p.name).includes("sps"))?.id ?? null;
      else if (pNorm.includes("hvf")) projectId = projects.find((p) => cleanStr(p.name).includes("hvf"))?.id ?? null;
      else if (pNorm.includes("mama")) projectId = projects.find((p) => cleanStr(p.name).includes("mama"))?.id ?? null;
      else if (pNorm.includes("whw")) projectId = projects.find((p) => cleanStr(p.name).includes("whw"))?.id ?? null;
    }

    // Thematic area matching
    let thematicAreaId = matchLookup(thematicAreas, row.thematicArea);
    if (!thematicAreaId && row.thematicArea) {
      const tNorm = cleanStr(row.thematicArea);
      if (tNorm.includes("srhr")) thematicAreaId = thematicAreas.find((t) => cleanStr(t.name).includes("srhr"))?.id ?? null;
      else if (tNorm.includes("gbv") || tNorm.includes("violence"))
        thematicAreaId = thematicAreas.find((t) => cleanStr(t.name).includes("violence"))?.id ?? null;
      else if (tNorm.includes("sti")) thematicAreaId = thematicAreas.find((t) => cleanStr(t.name).includes("sti"))?.id ?? null;
      else if (tNorm.includes("hiv")) thematicAreaId = thematicAreas.find((t) => cleanStr(t.name).includes("hiv"))?.id ?? null;
      else if (tNorm.includes("planning")) thematicAreaId = thematicAreas.find((t) => cleanStr(t.name).includes("planning"))?.id ?? null;
      else if (tNorm.includes("menstrual") || tNorm.includes("hygiene"))
        thematicAreaId = thematicAreas.find((t) => cleanStr(t.name).includes("menstrual"))?.id ?? null;
      else if (tNorm.includes("mental"))
        thematicAreaId = thematicAreas.find((t) => cleanStr(t.name).includes("mental"))?.id ?? null;
    }

    // Age group matching
    const ageGroupId = matchLookup(ageGroups, row.ageGroup);

    // Activity type
    const activityTypeId = row.activityType
      ? matchLookup(activityTypes, row.activityType) ?? defaultActivityId
      : defaultActivityId;

    // Key population counts
    const totalParticipants = Math.max(0, row.rawTotalMale + row.rawTotalFemale);
    const countRecords: { keyPopulationId: string; sex: "MALE" | "FEMALE"; count: number }[] = [];

    if (row.counts) {
      for (const [kpName, { male, female }] of Object.entries(row.counts)) {
        const kpId = matchLookup(keyPopulations, kpName);
        if (!kpId) continue;
        if (male > 0) countRecords.push({ keyPopulationId: kpId, sex: "MALE", count: male });
        if (female > 0) countRecords.push({ keyPopulationId: kpId, sex: "FEMALE", count: female });
      }
    }

    try {
      const sessionDate = new Date(row.date);
      await db.session.create({
        data: {
          date: sessionDate,
          communityId,
          projectId,
          thematicAreaId,
          ageGroupId,
          activityTypeId,
          totalParticipants,
          sourceDocumentId: documentId,
          createdById: user.id,
          counts: { create: countRecords },
        },
      });
      created++;
    } catch (createErr) {
      console.error("Failed to insert session row:", createErr);
      skippedReasons.push(`Row for date ${row.date}: database insert failed`);
    }
  }

  await db.document.update({
    where: { id: documentId },
    data: { extractionStatus: "COMMITTED" },
  });

  return NextResponse.json({
    created,
    skipped: validRows.length - created,
    skippedReasons,
    total: validRows.length,
  });
}
