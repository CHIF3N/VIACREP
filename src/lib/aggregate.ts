import "server-only";

import { Prisma, Sex } from "@prisma/client";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { seesEverything } from "./auth";
import {
  type Scope,
  periodBounds,
  periodLabel,
  previousScope,
} from "./scope";
import { excelMonthLabel, excelWeekNumber, shortMonthName } from "./utils";

/**
 * The one scoped query engine.
 *
 * The workbook computed its numbers with a scatter of SUMIFs, COUNTAs and four
 * pivot sheets, each with its own idea of the truth. This file replaces all of
 * them: the dashboard, every AUTO section of every report, and the Excel export
 * all call `aggregate()` and read the same object. Add a statistic here and it
 * appears in all three at once.
 */

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                  */
/* -------------------------------------------------------------------------- */

export type Breakdown = {
  id: string;
  name: string;
  sessions: number;
  participants: number;
  /** Share of the scope's total participants, 0-1. */
  share: number;
};

export type CommunityBreakdown = Breakdown & {
  subdivision: string;
  division: string;
  region: string;
};

export type TimePoint = {
  key: string;
  label: string;
  sessions: number;
  participants: number;
  male: number;
  female: number;
};

export type KeyPopulationReach = {
  id: string;
  name: string;
  shortName: string;
  male: number;
  female: number;
  total: number;
  tracksMale: boolean;
  tracksFemale: boolean;
};

export type FacilitatorTally = {
  name: string;
  sessions: number;
  participants: number;
};

export type SessionRow = {
  id: string;
  date: Date;
  week: number;
  month: string;
  community: string;
  subdivision: string;
  division: string;
  region: string;
  divisionSubdivision: string;
  project: string | null;
  thematicArea: string | null;
  ageGroup: string | null;
  activityType: string | null;
  facilitators: string[];
  notes: string | null;
  createdBy: string;
  /** keyPopulationId → { MALE, FEMALE } */
  counts: Record<string, { MALE: number; FEMALE: number }>;
  total: number;
};

export type Aggregate = {
  scope: Scope;
  label: string;
  periodStart: Date | null;
  periodEnd: Date | null;

  totals: {
    sessions: number;
    participants: number;
    communities: number;
    facilitators: number;
    averagePerSession: number;
  };
  gender: { male: number; female: number };

  /** Previous comparable period, for deltas. Null when there isn't one. */
  previous: {
    sessions: number;
    participants: number;
    sessionsDelta: number | null;
    participantsDelta: number | null;
  } | null;

  overTime: TimePoint[];
  byCommunity: CommunityBreakdown[];
  bySubdivision: Breakdown[];
  byDivision: Breakdown[];
  byThematicArea: Breakdown[];
  byProject: Breakdown[];
  byActivityType: Breakdown[];
  byAgeGroup: Breakdown[];
  byKeyPopulation: KeyPopulationReach[];
  facilitators: FacilitatorTally[];

  /** Every session in scope, ready for the table and the Excel Data sheet. */
  rows: SessionRow[];
};

/* -------------------------------------------------------------------------- */
/* Visibility — roles scope what you can see, never what you can write         */
/* -------------------------------------------------------------------------- */

export function visibilityWhere(user: SessionUser): Prisma.SessionWhereInput {
  if (seesEverything(user)) return {};
  // An officer sees what they logged, plus everything in their division.
  const clauses: Prisma.SessionWhereInput[] = [{ createdById: user.id }];
  if (user.divisionId) {
    clauses.push({
      community: { subdivision: { divisionId: user.divisionId } },
    });
  }
  return { OR: clauses };
}

function scopeWhere(scope: Scope): Prisma.SessionWhereInput {
  if (scope.sessionId) return { id: scope.sessionId };

  const where: Prisma.SessionWhereInput = {};
  const { start, end } = periodBounds(scope.period);
  if (start || end) {
    where.date = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };
  }
  if (scope.projectId) {
    if (scope.projectId === "unassigned") {
      where.projectId = null;
    } else {
      where.projectId = scope.projectId;
    }
  }
  if (scope.thematicAreaId) where.thematicAreaId = scope.thematicAreaId;
  if (scope.activityTypeId) where.activityTypeId = scope.activityTypeId;
  if (scope.ageGroupId) where.ageGroupId = scope.ageGroupId;
  if (scope.createdById) where.createdById = scope.createdById;

  if (scope.communityId) {
    where.communityId = scope.communityId;
  } else if (scope.subdivisionId) {
    where.community = { subdivisionId: scope.subdivisionId };
  } else if (scope.divisionId) {
    where.community = { subdivision: { divisionId: scope.divisionId } };
  } else if (scope.regionId) {
    where.community = {
      subdivision: { division: { regionId: scope.regionId } },
    };
  }
  return where;
}

export function combineWhere(
  scope: Scope,
  user: SessionUser,
): Prisma.SessionWhereInput {
  const visibility = visibilityWhere(user);
  const scoped = scopeWhere(scope);
  return Object.keys(visibility).length === 0
    ? scoped
    : { AND: [scoped, visibility] };
}

/* -------------------------------------------------------------------------- */
/* The query                                                                   */
/* -------------------------------------------------------------------------- */

const sessionInclude = {
  community: {
    include: {
      subdivision: { include: { division: { include: { region: true } } } },
    },
  },
  project: true,
  thematicArea: true,
  ageGroup: true,
  activityType: true,
  createdBy: { select: { id: true, name: true } },
  facilitators: { select: { name: true } },
  counts: { include: { keyPopulation: true } },
} satisfies Prisma.SessionInclude;

type LoadedSession = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

export async function aggregate(
  scope: Scope,
  user: SessionUser,
  options: { withPrevious?: boolean } = {},
): Promise<Aggregate> {
  const { withPrevious = true } = options;

  const sessions = await db.session.findMany({
    where: combineWhere(scope, user),
    include: sessionInclude,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const result = summarise(scope, sessions);

  if (withPrevious) {
    const prev = previousScope(scope);
    if (prev) {
      const [sessionCount, sums] = await Promise.all([
        db.session.count({ where: combineWhere(prev, user) }),
        db.session.aggregate({
          where: combineWhere(prev, user),
          _sum: { totalParticipants: true },
        }),
      ]);
      const participants = sums._sum.totalParticipants ?? 0;
      result.previous = {
        sessions: sessionCount,
        participants,
        sessionsDelta: growth(result.totals.sessions, sessionCount),
        participantsDelta: growth(result.totals.participants, participants),
      };
    }
  }

  return result;
}

function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null renders as "new"
  return (current - previous) / previous;
}

/* -------------------------------------------------------------------------- */
/* Rolling up                                                                  */
/* -------------------------------------------------------------------------- */

class Tally {
  private map = new Map<
    string,
    { id: string; name: string; sessions: number; participants: number; sort: number }
  >();

  add(id: string, name: string, participants: number, sort = 0) {
    const entry =
      this.map.get(id) ?? { id, name, sessions: 0, participants: 0, sort };
    entry.sessions += 1;
    entry.participants += participants;
    this.map.set(id, entry);
  }

  /** Ranked by participants — the order every chart and report list uses. */
  ranked(total: number): Breakdown[] {
    return [...this.map.values()]
      .sort((a, b) => b.participants - a.participants || a.name.localeCompare(b.name))
      .map(({ id, name, sessions, participants }) => ({
        id,
        name,
        sessions,
        participants,
        share: total > 0 ? participants / total : 0,
      }));
  }

  /** Keeps the lookup list's own order — right for ordered bands like age. */
  ordered(total: number): Breakdown[] {
    return [...this.map.values()]
      .sort((a, b) => a.sort - b.sort)
      .map(({ id, name, sessions, participants }) => ({
        id,
        name,
        sessions,
        participants,
        share: total > 0 ? participants / total : 0,
      }));
  }
}

function summarise(scope: Scope, sessions: LoadedSession[]): Aggregate {
  const { start, end } = periodBounds(scope.period);

  const community = new Tally();
  const subdivision = new Tally();
  const division = new Tally();
  const thematic = new Tally();
  const project = new Tally();
  const activity = new Tally();
  const age = new Tally();

  const communityMeta = new Map<
    string,
    { subdivision: string; division: string; region: string }
  >();
  const keyPop = new Map<string, KeyPopulationReach>();
  const facilitators = new Map<string, FacilitatorTally>();
  const buckets = new Map<string, TimePoint>();

  let participants = 0;
  let male = 0;
  let female = 0;
  const rows: SessionRow[] = [];

  for (const s of sessions) {
    const total = s.totalParticipants;
    participants += total;

    const sub = s.community.subdivision;
    const div = sub.division;
    const region = div.region;

    community.add(s.community.id, s.community.name, total, s.community.sortOrder);
    communityMeta.set(s.community.id, {
      subdivision: sub.name,
      division: div.name,
      region: region.name,
    });
    subdivision.add(sub.id, `${div.name} — ${sub.name}`, total, sub.sortOrder);
    division.add(div.id, div.name, total, div.sortOrder);
    if (s.thematicArea)
      thematic.add(s.thematicArea.id, s.thematicArea.name, total, s.thematicArea.sortOrder);
    if (s.project)
      project.add(s.project.id, s.project.name, total, s.project.sortOrder);
    if (s.activityType)
      activity.add(s.activityType.id, s.activityType.name, total, s.activityType.sortOrder);
    if (s.ageGroup)
      age.add(s.ageGroup.id, s.ageGroup.name, total, s.ageGroup.sortOrder);

    const counts: SessionRow["counts"] = {};
    let rowMale = 0;
    let rowFemale = 0;
    for (const c of s.counts) {
      const kp = c.keyPopulation;
      const entry =
        keyPop.get(kp.id) ??
        {
          id: kp.id,
          name: kp.name,
          shortName: kp.shortName,
          male: 0,
          female: 0,
          total: 0,
          tracksMale: kp.tracksMale,
          tracksFemale: kp.tracksFemale,
        };
      if (c.sex === Sex.MALE) {
        entry.male += c.count;
        rowMale += c.count;
      } else {
        entry.female += c.count;
        rowFemale += c.count;
      }
      entry.total += c.count;
      keyPop.set(kp.id, entry);

      const slot = counts[kp.id] ?? { MALE: 0, FEMALE: 0 };
      slot[c.sex] += c.count;
      counts[kp.id] = slot;
    }
    male += rowMale;
    female += rowFemale;

    for (const f of s.facilitators) {
      const entry =
        facilitators.get(f.name) ?? { name: f.name, sessions: 0, participants: 0 };
      entry.sessions += 1;
      entry.participants += total;
      facilitators.set(f.name, entry);
    }

    // Group over time by month, except for a single day or a short range where
    // months would collapse to one bar.
    const bucketKey = timeBucketKey(s.date, scope);
    const point =
      buckets.get(bucketKey.key) ??
      {
        key: bucketKey.key,
        label: bucketKey.label,
        sessions: 0,
        participants: 0,
        male: 0,
        female: 0,
      };
    point.sessions += 1;
    point.participants += total;
    point.male += rowMale;
    point.female += rowFemale;
    buckets.set(bucketKey.key, point);

    rows.push({
      id: s.id,
      date: s.date,
      week: excelWeekNumber(s.date),
      month: excelMonthLabel(s.date),
      community: s.community.name,
      subdivision: sub.name,
      division: div.name,
      region: region.name,
      divisionSubdivision: `${div.name} - ${sub.name}`,
      project: s.project?.name ?? null,
      thematicArea: s.thematicArea?.name ?? null,
      ageGroup: s.ageGroup?.name ?? null,
      activityType: s.activityType?.name ?? null,
      facilitators: s.facilitators.map((f) => f.name),
      notes: s.notes,
      createdBy: s.createdBy.name,
      counts,
      total,
    });
  }

  const byCommunity: CommunityBreakdown[] = community
    .ranked(participants)
    .map((row) => ({
      ...row,
      ...(communityMeta.get(row.id) ?? {
        subdivision: "",
        division: "",
        region: "",
      }),
    }));

  return {
    scope,
    label: periodLabel(scope.period),
    periodStart: start ?? (sessions[0]?.date ?? null),
    periodEnd: end ?? (sessions[sessions.length - 1]?.date ?? null),
    totals: {
      sessions: sessions.length,
      participants,
      communities: community.ranked(participants).length,
      facilitators: facilitators.size,
      averagePerSession:
        sessions.length > 0 ? Math.round(participants / sessions.length) : 0,
    },
    gender: { male, female },
    previous: null,
    overTime: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byCommunity,
    bySubdivision: subdivision.ranked(participants),
    byDivision: division.ranked(participants),
    byThematicArea: thematic.ranked(participants),
    byProject: project.ranked(participants),
    byActivityType: activity.ranked(participants),
    byAgeGroup: age.ordered(participants), // Adolescents → Youth → Adults
    byKeyPopulation: [...keyPop.values()].sort((a, b) => b.total - a.total),
    facilitators: [...facilitators.values()].sort(
      (a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name),
    ),
    rows,
  };
}

function timeBucketKey(date: Date, scope: Scope) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  // Inside a single month, weeks tell a better story than one lone bar.
  if (scope.period.kind === "month" || scope.sessionId) {
    const week = excelWeekNumber(date);
    return {
      key: `${year}-W${String(week).padStart(2, "0")}`,
      label: `Week ${week}`,
    };
  }
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: `${shortMonthName(month)} ${String(year).slice(2)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Lookups for the filter bars                                                 */
/* -------------------------------------------------------------------------- */

export async function getFilterOptions() {
  const [projects, thematicAreas, activityTypes, ageGroups, communities, users] =
    await Promise.all([
      db.project.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      db.thematicArea.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      db.activityType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      db.ageGroup.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      db.community.findMany({
        orderBy: { name: "asc" },
        include: {
          subdivision: { include: { division: { include: { region: true } } } },
        },
      }),
      db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

  return { projects, thematicAreas, activityTypes, ageGroups, communities, users };
}

export type FilterOptions = Awaited<ReturnType<typeof getFilterOptions>>;

/** The years that actually have data, for the period picker. */
export async function getDataYears(): Promise<number[]> {
  const rows = await db.$queryRaw<{ year: number }[]>`
    select distinct extract(year from "date")::int as year
    from "Session"
    order by year desc
  `;
  const years = rows.map((r) => r.year);
  const thisYear = new Date().getUTCFullYear();
  if (!years.includes(thisYear)) years.unshift(thisYear);
  return years;
}
