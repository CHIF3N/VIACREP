import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { combineWhere } from "@/lib/aggregate";
import { ALL_TIME } from "@/lib/scope";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const where = combineWhere(ALL_TIME, user);

  const [sessions, communities, reports] = await Promise.all([
    db.session.findMany({
      where: {
        ...where,
        community: { name: { contains: q, mode: "insensitive" } },
      },
      select: { id: true, date: true, community: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 5,
    }),
    db.community.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, subdivision: { select: { name: true, division: { select: { name: true } } } } },
      take: 5,
    }),
    db.narrativePeriod.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, scopeKey: true, scope: true },
      orderBy: { periodStart: "desc" },
      take: 5,
    }),
  ]);

  type Result = { id: string; label: string; sublabel?: string; href: string; category: "Session" | "Community" | "Report" };

  const results: Result[] = [
    ...sessions.map((s) => ({
      id: `session-${s.id}`,
      label: s.community.name,
      sublabel: s.date.toISOString().slice(0, 10),
      href: `/sessions/${s.id}`,
      category: "Session" as const,
    })),
    ...communities.map((c) => ({
      id: `community-${c.id}`,
      label: c.name,
      sublabel: `${c.subdivision.division.name} — ${c.subdivision.name}`,
      href: `/sessions?communityId=${c.id}`,
      category: "Community" as const,
    })),
    ...reports.map((r) => ({
      id: `report-${r.id}`,
      label: r.title,
      sublabel: r.scopeKey,
      href: `/reports/build?${new URLSearchParams(
        Object.fromEntries(
          Object.entries((r.scope as Record<string, unknown>).period as Record<string, string> ?? {})
            .map(([k, v]) => [k, String(v)])
        )
      ).toString()}`,
      category: "Report" as const,
    })),
  ];

  return NextResponse.json(results);
}
