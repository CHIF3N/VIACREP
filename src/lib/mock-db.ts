import { Role, Sex, NarrativeStatus, type Organization, type User, type Community, type Project, type ThematicArea, type ActivityType, type AgeGroup, type KeyPopulation, type Session } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GEOGRAPHY } from "../../prisma/data/geography";
import { COMMUNITY_COORDS } from "../../prisma/data/coordinates";
import {
  PROJECTS,
  AGE_GROUPS,
  THEMATIC_AREAS,
  ACTIVITY_TYPES,
  KEY_POPULATIONS,
} from "../../prisma/data/lookups";
import {
  DEFAULT_OBJECTIVES,
  DEFAULT_METHODOLOGY,
  DEFAULT_LESSONS_LEARNT,
  DEFAULT_CHALLENGES,
  DEFAULT_RECOMMENDATIONS,
} from "../../prisma/data/narrative-defaults";

/* -------------------------------------------------------------------------- */
/* Deterministic RNG for reproducible seed data                                */
/* -------------------------------------------------------------------------- */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
const rng = makeRng(20260401);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const between = (min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));
const chance = (p: number) => rng() < p;

/* -------------------------------------------------------------------------- */
/* Static Data Setup                                                           */
/* -------------------------------------------------------------------------- */

const DEMO_PASSWORD_HASH = bcrypt.hashSync("viac2026", 10);

const FACILITATOR_POOL = [
  "Ngwa Brenda",
  "Tabe Emmanuel",
  "Achu Vivian",
  "Njie Samuel",
  "Ekema Prudence",
  "Fon Clarisse",
  "Mbah Derick",
  "Ashu Gladys",
  "Lyonga Peter",
  "Nkeng Marie",
];

// 1. Organization
let orgRecord: Organization = {
  id: "org-viac",
  name: "Vision in Action Cameroon",
  shortName: "VIAC",
  headerImageUrl: "/letterhead/viac_header.png",
  footerImageUrl: "/letterhead/viac_footer.png",
  brandTokens: {
    blue: "#1CA3EC",
    gold: "#DDA328",
    charcoal: "#2A2A2A",
    lightGrey: "#ECECEC",
  } as unknown as object,
  defaultObjectives: DEFAULT_OBJECTIVES,
  defaultMethodology: DEFAULT_METHODOLOGY,
  defaultLessonsLearnt: DEFAULT_LESSONS_LEARNT,
  defaultChallenges: DEFAULT_CHALLENGES,
  defaultRecommendations: DEFAULT_RECOMMENDATIONS,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// 2. Funders
const fundersList = [
  {
    id: "funder-viac",
    slug: "viac",
    name: "Universal VIAC Standard",
    reportingFrequency: "monthly",
    templateConfig: {
      description: "Standard VIAC outreach reporting framework",
      kpis: ["totalReach", "sessions", "communities", "facilitators"],
      narrativeSections: [
        "Executive Summary",
        "Service Delivery Update",
        "Advocacy & Movement Building",
        "Lessons Learned",
        "Next Steps",
      ],
    },
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "funder-mama",
    slug: "mama",
    name: "MAMA Network",
    reportingFrequency: "quarterly",
    templateConfig: {
      description: "Grassroots SMA accompaniment and peer referral framework",
      kpis: ["hotlineContacts", "peerAccompanimentCases", "safeSpaceOutreaches", "meanPaseScore"],
      benchmarks: {},
      narrativeSections: [
        "Hotline Activity Log",
        "Peer Accompaniment Summary",
        "Community Feedback",
        "Safe Space Sessions",
        "Feminist M&E Reflections",
        "Next Steps",
      ],
    },
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "funder-whw",
    slug: "whw",
    name: "Women Help Women",
    reportingFrequency: "quarterly",
    templateConfig: {
      description: "Digital telehealth consultations and abortion outcome tracking",
      kpis: ["telecounselingReach", "outcomeCompletionPct", "additionalCarePct", "satisfactionPct"],
      benchmarks: {
        additionalCarePct: 0.126,
        satisfactionPct: 0.875,
      },
      narrativeSections: [
        "Telehealth Volume",
        "Clinical Outcomes",
        "Additional Care-Seeking",
        "Client Satisfaction",
        "Lessons Learned",
        "Next Steps",
      ],
    },
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];

// 3. Lookups
const projectsList: Project[] = [
  ...PROJECTS.map((name, i) => ({
    id: `proj-${i + 1}`,
    name,
    sortOrder: i,
    isActive: true,
  })),
  {
    id: "proj-other",
    name: "Other / Unlisted Initiatives",
    sortOrder: PROJECTS.length,
    isActive: true,
  },
];

const ageGroupsList: AgeGroup[] = AGE_GROUPS.map((name, i) => ({
  id: `age-${i + 1}`,
  name,
  sortOrder: i,
  isActive: true,
}));

const thematicAreasList: ThematicArea[] = THEMATIC_AREAS.map((name, i) => ({
  id: `them-${i + 1}`,
  name,
  sortOrder: i,
  isActive: true,
}));

const activityTypesList: ActivityType[] = ACTIVITY_TYPES.map((name, i) => ({
  id: `act-${i + 1}`,
  name,
  sortOrder: i,
  isActive: true,
}));

const keyPopulationsList: KeyPopulation[] = KEY_POPULATIONS.map((kp, i) => ({
  id: `kp-${i + 1}`,
  name: kp.name,
  shortName: kp.shortName,
  tracksMale: kp.tracksMale,
  tracksFemale: kp.tracksFemale,
  maleLabel: kp.maleLabel,
  femaleLabel: kp.femaleLabel,
  exportGroupLabel: kp.exportGroupLabel,
  exportMaleHeader: kp.exportMaleHeader,
  exportFemaleHeader: kp.exportFemaleHeader,
  sortOrder: i,
  isActive: true,
}));

// 4. Geography Tree
type RegionData = {
  id: string;
  name: string;
  sortOrder: number;
  divisions: DivisionData[];
};

type DivisionData = {
  id: string;
  name: string;
  sortOrder: number;
  regionId: string;
  region: { id: string; name: string };
  subdivisions: SubdivisionData[];
  users?: User[];
};

type SubdivisionData = {
  id: string;
  name: string;
  sortOrder: number;
  divisionId: string;
  division: {
    id: string;
    name: string;
    region: { id: string; name: string };
  };
  communities?: CommunityData[];
  _count?: { communities: number };
};

type CommunityData = Community & {
  subdivision: SubdivisionData;
  sessions?: SessionData[];
};

const regionsList: RegionData[] = [];
const divisionsList: DivisionData[] = [];
const subdivisionsList: SubdivisionData[] = [];
const communitiesList: CommunityData[] = [];

let divCounter = 1;
let subCounter = 1;
let commCounter = 1;

for (const [ri, region] of GEOGRAPHY.entries()) {
  const rId = `reg-${ri + 1}`;
  const rObj: RegionData = {
    id: rId,
    name: region.name,
    sortOrder: ri,
    divisions: [],
  };
  regionsList.push(rObj);

  for (const [di, division] of region.divisions.entries()) {
    const dId = `div-${divCounter++}`;
    const dObj: DivisionData = {
      id: dId,
      name: division.name,
      sortOrder: di,
      regionId: rId,
      region: { id: rId, name: region.name },
      subdivisions: [],
    };
    divisionsList.push(dObj);
    rObj.divisions.push(dObj);

    for (const [si, subdivision] of division.subdivisions.entries()) {
      const sId = `sub-${subCounter++}`;
      const sObj: SubdivisionData = {
        id: sId,
        name: subdivision.name,
        sortOrder: si,
        divisionId: dId,
        division: {
          id: dId,
          name: division.name,
          region: { id: rId, name: region.name },
        },
        communities: [],
        _count: { communities: subdivision.communities.length },
      };
      subdivisionsList.push(sObj);
      dObj.subdivisions.push(sObj);

      for (const [ci, commName] of subdivision.communities.entries()) {
        const cId = `comm-${commCounter++}`;
        const coords = COMMUNITY_COORDS[subdivision.name]?.[commName];
        const cObj: CommunityData = {
          id: cId,
          name: commName,
          sortOrder: ci,
          subdivisionId: sId,
          subdivision: sObj,
          lat: coords?.[0] ?? null,
          lng: coords?.[1] ?? null,
          isCustom: false,
          createdById: null,
          createdAt: new Date("2026-01-01"),
        };
        communitiesList.push(cObj);
        sObj.communities?.push(cObj);
      }
    }
  }
}

// Division lookups by name
const fakoDiv = divisionsList.find((d) => d.name === "Fako");
const mezamDiv = divisionsList.find((d) => d.name === "Mezam");

// 5. Users
type UserData = User & {
  division: DivisionData | null;
};

const usersList: UserData[] = [
  {
    id: "user-coordinator",
    name: "Ndip Claudia",
    email: "coordinator@viacame.org",
    passwordHash: DEMO_PASSWORD_HASH,
    role: Role.COORDINATOR,
    designation: "Programme Coordinator",
    divisionId: null,
    division: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "user-approver",
    name: "Ebong Martin",
    email: "approver@viacame.org",
    passwordHash: DEMO_PASSWORD_HASH,
    role: Role.APPROVER,
    designation: "Executive Director",
    divisionId: null,
    division: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "user-officer-fako",
    name: "Ngwa Brenda",
    email: "officer.fako@viacame.org",
    passwordHash: DEMO_PASSWORD_HASH,
    role: Role.OFFICER,
    designation: "Field Officer — Fako",
    divisionId: fakoDiv?.id ?? null,
    division: fakoDiv ?? null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "user-officer-mezam",
    name: "Achu Vivian",
    email: "officer.mezam@viacame.org",
    passwordHash: DEMO_PASSWORD_HASH,
    role: Role.OFFICER,
    designation: "Field Officer — Mezam",
    divisionId: mezamDiv?.id ?? null,
    division: mezamDiv ?? null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];

// 6. Sessions, Counts, Facilitators, Clinical Records
type SessionCountData = {
  id: string;
  sessionId: string;
  keyPopulationId: string;
  keyPopulation: KeyPopulation;
  sex: Sex;
  count: number;
};

type SessionFacilitatorData = {
  id: string;
  sessionId: string;
  name: string;
  userId: string | null;
};

type SrhrClinicalRecordData = {
  id: string;
  sessionId: string;
  gestationalAgeWeeks: number | null;
  outcomeReported: "NO_LONGER_PREGNANT" | "STILL_PREGNANT" | "UNKNOWN" | "LOST_TO_FOLLOW_UP" | null;
  outcomeConfirmationMethods: string[];
  additionalMedicalCareSought: boolean | null;
  additionalCareType: string | null;
  additionalCareReason: string | null;
  satisfactionRating: "VERY_SATISFIED" | "SATISFIED" | "NEUTRAL" | "DISSATISFIED" | null;
  paseScore: number | null;
  autonomousDecisionMade: boolean | null;
  gbvDisclosed: boolean | null;
  gbvReferralCompleted: boolean | null;
  isTelecounseling: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AuditLogData = {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  userId: string | null;
  user?: { name: string } | null;
  sessionId: string | null;
  createdAt: Date;
};

type SessionData = Session & {
  community: CommunityData;
  project: Project | null;
  thematicArea: ThematicArea | null;
  ageGroup: AgeGroup | null;
  activityType: ActivityType | null;
  createdBy: UserData;
  facilitators: SessionFacilitatorData[];
  counts: SessionCountData[];
  clinicalRecords?: SrhrClinicalRecordData[];
  auditLogs?: AuditLogData[];
};

const globalForDb = globalThis as unknown as {
  __mock_sessionsList?: SessionData[];
  __mock_sessionCountsList?: SessionCountData[];
  __mock_sessionFacilitatorsList?: SessionFacilitatorData[];
  __mock_clinicalRecordsList?: SrhrClinicalRecordData[];
  __mock_auditLogsList?: AuditLogData[];
  __mock_documentsList?: any[];
  __mock_reportsList?: any[];
};

if (!globalForDb.__mock_documentsList) globalForDb.__mock_documentsList = [];
const documentsList: any[] = globalForDb.__mock_documentsList;

if (!globalForDb.__mock_reportsList) globalForDb.__mock_reportsList = [];
const reportsList: any[] = globalForDb.__mock_reportsList;

if (!globalForDb.__mock_sessionsList) globalForDb.__mock_sessionsList = [];
const sessionsList: SessionData[] = globalForDb.__mock_sessionsList;

if (!globalForDb.__mock_sessionCountsList) globalForDb.__mock_sessionCountsList = [];
const sessionCountsList: SessionCountData[] = globalForDb.__mock_sessionCountsList;

if (!globalForDb.__mock_sessionFacilitatorsList) globalForDb.__mock_sessionFacilitatorsList = [];
const sessionFacilitatorsList: SessionFacilitatorData[] = globalForDb.__mock_sessionFacilitatorsList;

if (!globalForDb.__mock_clinicalRecordsList) globalForDb.__mock_clinicalRecordsList = [];
const clinicalRecordsList: SrhrClinicalRecordData[] = globalForDb.__mock_clinicalRecordsList;

if (!globalForDb.__mock_auditLogsList) globalForDb.__mock_auditLogsList = [];
const auditLogsList: AuditLogData[] = globalForDb.__mock_auditLogsList;

// Seed demo sessions
const officers = usersList.filter((u) => u.role === Role.OFFICER);
const coordinator = usersList[0];
const today = new Date();
const months: { year: number; month: number }[] = [];
for (let back = 5; back >= 1; back--) {
  const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
  months.push({ year: d.getFullYear(), month: d.getMonth() });
}

let sessionCounter = 1;
let countCounter = 1;
let facCounter = 1;
let clinicCounter = 1;

if (sessionsList.length === 0) {
  for (const [index, { year, month }] of months.entries()) {
  const perMonth = 5 + index;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let n = 0; n < perMonth; n++) {
    const author = chance(0.25) ? coordinator : pick(officers);
    const day = between(1, daysInMonth);
    const date = new Date(Date.UTC(year, month, day));

    // Pick community
    const pool = author.divisionId
      ? communitiesList.filter((c) => c.subdivision.divisionId === author.divisionId)
      : communitiesList;
    const community = pool.length > 0 ? pick(pool) : communitiesList[0];

    const proj = chance(0.92) ? pick(projectsList) : null;
    const them = chance(0.95) ? pick(thematicAreasList) : null;
    const age = chance(0.9) ? pick(ageGroupsList) : null;
    const act = chance(0.9) ? pick(activityTypesList) : null;

    const sId = `sess-${sessionCounter++}`;
    const sCounts: SessionCountData[] = [];

    const addCount = (kpName: string, sex: Sex, count: number) => {
      if (count <= 0) return;
      const kp = keyPopulationsList.find((k) => k.name === kpName);
      if (!kp) return;
      const cRow: SessionCountData = {
        id: `cnt-${countCounter++}`,
        sessionId: sId,
        keyPopulationId: kp.id,
        keyPopulation: kp,
        sex,
        count,
      };
      sCounts.push(cRow);
      sessionCountsList.push(cRow);
    };

    addCount("General", Sex.FEMALE, between(6, 26));
    addCount("General", Sex.MALE, between(4, 20));
    if (chance(0.55)) addCount("Adolescent Girls & Young Women (AGYW)", Sex.FEMALE, between(3, 14));
    if (chance(0.45)) addCount("Adolescent & Young Boys/Men (AYBM)", Sex.MALE, between(2, 12));
    if (chance(0.4)) {
      addCount("Internally Displaced Persons (IDPs)", Sex.FEMALE, between(2, 11));
      addCount("Internally Displaced Persons (IDPs)", Sex.MALE, between(1, 8));
    }
    if (chance(0.28)) {
      addCount("Sex Workers", Sex.FEMALE, between(2, 9));
      if (chance(0.3)) addCount("Sex Workers", Sex.MALE, between(1, 3));
    }
    if (chance(0.22)) {
      addCount("Persons with Disabilities", Sex.FEMALE, between(1, 5));
      addCount("Persons with Disabilities", Sex.MALE, between(1, 5));
    }
    if (chance(0.18)) {
      addCount("Gender Minorities", Sex.FEMALE, between(1, 4));
      addCount("Gender Minorities", Sex.MALE, between(1, 4));
    }

    const totalParticipants = sCounts.reduce((sum, c) => sum + c.count, 0);

    const facNames = Array.from(
      new Set(Array.from({ length: between(1, 3) }, () => pick(FACILITATOR_POOL))),
    );
    const sFacs: SessionFacilitatorData[] = facNames.map((name) => {
      const fObj: SessionFacilitatorData = {
        id: `fac-${facCounter++}`,
        sessionId: sId,
        name,
        userId: null,
      };
      sessionFacilitatorsList.push(fObj);
      return fObj;
    });

    const sessionObj: SessionData = {
      id: sId,
      date,
      communityId: community.id,
      community,
      projectId: proj?.id ?? null,
      project: proj,
      thematicAreaId: them?.id ?? null,
      thematicArea: them,
      ageGroupId: age?.id ?? null,
      ageGroup: age,
      activityTypeId: act?.id ?? null,
      activityType: act,
      notes: chance(0.2) ? "Community leadership endorsed the initiative; high youth engagement." : null,
      totalParticipants,
      sourceDocumentId: null,
      createdById: author.id,
      createdBy: author,
      facilitators: sFacs,
      counts: sCounts,
      clinicalRecords: [],
      auditLogs: [],
      createdAt: date,
      updatedAt: date,
    };

    // Attach to community's session list for map querying
    if (!community.sessions) community.sessions = [];
    community.sessions.push(sessionObj);

    // If MAMA or WHW, add clinical telemetry
    if (proj?.name.includes("MAMA") || proj?.name.includes("WHW") || chance(0.35)) {
      const numRecords = between(1, 3);
      for (let cr = 0; cr < numRecords; cr++) {
        const clinRecord: SrhrClinicalRecordData = {
          id: `clin-${clinicCounter++}`,
          sessionId: sId,
          gestationalAgeWeeks: between(5, 11),
          outcomeReported: chance(0.85) ? "NO_LONGER_PREGNANT" : "LOST_TO_FOLLOW_UP",
          outcomeConfirmationMethods: ["URINE_HCG", "SYMPTOM_RESOLUTION"],
          additionalMedicalCareSought: chance(0.12),
          additionalCareType: chance(0.12) ? "Ultrasound verification" : null,
          additionalCareReason: null,
          satisfactionRating: chance(0.7) ? "VERY_SATISFIED" : "SATISFIED",
          paseScore: between(12, 15),
          autonomousDecisionMade: chance(0.92),
          gbvDisclosed: chance(0.08),
          gbvReferralCompleted: chance(0.08),
          isTelecounseling: proj?.name.includes("WHW") || chance(0.4),
          createdAt: date,
          updatedAt: date,
        };
        sessionObj.clinicalRecords?.push(clinRecord);
        clinicalRecordsList.push(clinRecord);
      }
    }

    sessionsList.push(sessionObj);
  }
}
}

// 7. Narrative Periods
type NarrativePeriodData = {
  id: string;
  scopeKey: string;
  scope: any;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  objectives: string;
  methodology: string;
  lessonsLearnt: string;
  challenges: string;
  recommendations: string;
  preparedBy: string | null;
  preparedDesignation: string | null;
  approvedBy: string | null;
  approvedDesignation: string | null;
  status: NarrativeStatus;
  createdById: string;
  createdBy: UserData;
  createdAt: Date;
  updatedAt: Date;
};

const narrativePeriodsList: NarrativePeriodData[] = [];
const lastMonthInfo = months[months.length - 1];
const periodStart = new Date(Date.UTC(lastMonthInfo.year, lastMonthInfo.month, 1));
const periodEnd = new Date(Date.UTC(lastMonthInfo.year, lastMonthInfo.month + 1, 0));
const scopeKey = `monthly:${lastMonthInfo.year}-${String(lastMonthInfo.month + 1).padStart(2, "0")}`;
const title = `${periodStart.toLocaleDateString("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})} Monthly Narrative Report`;

narrativePeriodsList.push({
  id: "narrative-initial",
  scopeKey,
  scope: { period: { kind: "month", year: lastMonthInfo.year, month: lastMonthInfo.month + 1 } },
  title,
  periodStart,
  periodEnd,
  objectives: DEFAULT_OBJECTIVES,
  methodology: DEFAULT_METHODOLOGY,
  lessonsLearnt: DEFAULT_LESSONS_LEARNT,
  challenges: DEFAULT_CHALLENGES,
  recommendations: DEFAULT_RECOMMENDATIONS,
  preparedBy: "Ndip Claudia",
  preparedDesignation: "Programme Coordinator",
  approvedBy: "Ebong Martin",
  approvedDesignation: "Executive Director",
  status: NarrativeStatus.FINAL,
  createdById: coordinator.id,
  createdBy: coordinator,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/* -------------------------------------------------------------------------- */
/* Query Matching Helpers                                                      */
/* -------------------------------------------------------------------------- */

function matchesCondition(actual: any, expected: any): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (typeof expected === "object" && expected !== null && !(expected instanceof Date)) {
    if (expected.not !== undefined) {
      if (expected.not === null) return actual !== null && actual !== undefined;
      return !matchesCondition(actual, expected.not);
    }
    if (expected.in !== undefined && Array.isArray(expected.in)) {
      return expected.in.includes(actual);
    }
    if (expected.contains !== undefined) {
      if (typeof actual !== "string") return false;
      const search = String(expected.contains).toLowerCase();
      return actual.toLowerCase().includes(search);
    }
    if (expected.gte !== undefined || expected.lte !== undefined || expected.gt !== undefined || expected.lt !== undefined) {
      const actVal = actual instanceof Date ? actual.getTime() : actual;
      if (expected.gte !== undefined) {
        const cmp = expected.gte instanceof Date ? expected.gte.getTime() : expected.gte;
        if (actVal < cmp) return false;
      }
      if (expected.gt !== undefined) {
        const cmp = expected.gt instanceof Date ? expected.gt.getTime() : expected.gt;
        if (actVal <= cmp) return false;
      }
      if (expected.lte !== undefined) {
        const cmp = expected.lte instanceof Date ? expected.lte.getTime() : expected.lte;
        if (actVal > cmp) return false;
      }
      if (expected.lt !== undefined) {
        const cmp = expected.lt instanceof Date ? expected.lt.getTime() : expected.lt;
        if (actVal >= cmp) return false;
      }
      return true;
    }
    // Deep match
    return Object.entries(expected).every(([k, v]) => matchesCondition(actual?.[k], v));
  }
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }
  return actual === expected;
}

export function matchesWhere(record: any, where?: any): boolean {
  if (!where || Object.keys(where).length === 0) return true;

  for (const [key, value] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(value)) {
      if (!value.some((cond) => matchesWhere(record, cond))) return false;
      continue;
    }
    if (key === "AND" && Array.isArray(value)) {
      if (!value.every((cond) => matchesWhere(record, cond))) return false;
      continue;
    }
    if (key === "NOT") {
      if (matchesWhere(record, value)) return false;
      continue;
    }

    const actual = record[key];
    if (!matchesCondition(actual, value)) return false;
  }
  return true;
}

function applySort<T>(items: T[], orderBy?: any): T[] {
  if (!orderBy) return items;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...items].sort((a: any, b: any) => {
    for (const order of orders) {
      for (const [key, dir] of Object.entries(order)) {
        const valA = a[key];
        const valB = b[key];
        const multiplier = dir === "desc" ? -1 : 1;
        if (valA instanceof Date && valB instanceof Date) {
          if (valA.getTime() !== valB.getTime()) {
            return (valA.getTime() - valB.getTime()) * multiplier;
          }
        } else if (valA !== valB) {
          if (valA == null) return 1 * multiplier;
          if (valB == null) return -1 * multiplier;
          if (typeof valA === "string") {
            const cmp = valA.localeCompare(String(valB));
            if (cmp !== 0) return cmp * multiplier;
          } else if (valA < valB) return -1 * multiplier;
          else if (valA > valB) return 1 * multiplier;
        }
      }
    }
    return 0;
  });
}

function applySelectOrInclude(item: any, select?: any, include?: any): any {
  if (!item) return null;
  if (Array.isArray(item)) {
    return item.map((el) => applySelectOrInclude(el, select, include));
  }
  if (!select && !include) return item;

  const result: any = select ? {} : { ...item };

  if (select) {
    for (const [key, val] of Object.entries(select)) {
      if (val === true) {
        result[key] = item[key];
      } else if (typeof val === "object" && val !== null) {
        result[key] = applySelectOrInclude(item[key], (val as any).select, (val as any).include);
      }
    }
  }

  if (include) {
    for (const [key, val] of Object.entries(include)) {
      if (val === true) {
        result[key] = item[key];
      } else if (typeof val === "object" && val !== null) {
        result[key] = applySelectOrInclude(item[key], (val as any).select, (val as any).include);
      }
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Mock Database Client                                                        */
/* -------------------------------------------------------------------------- */

export const mockDb = {
  organization: {
    findFirst: async () => orgRecord,
    create: async ({ data }: any) => {
      orgRecord = { ...orgRecord, ...data, id: "org-viac", updatedAt: new Date() };
      return orgRecord;
    },
    update: async ({ data }: any) => {
      orgRecord = { ...orgRecord, ...data, updatedAt: new Date() };
      return orgRecord;
    },
  },

  funder: {
    findMany: async (args?: any) => {
      const filtered = fundersList.filter((f) => matchesWhere(f, args?.where));
      return applySort(filtered, args?.orderBy);
    },
    findUnique: async ({ where }: any) => {
      return fundersList.find((f) => matchesWhere(f, where)) ?? null;
    },
    upsert: async ({ where, update, create }: any) => {
      const idx = fundersList.findIndex((f) => matchesWhere(f, where));
      if (idx >= 0) {
        fundersList[idx] = { ...fundersList[idx], ...update, updatedAt: new Date() };
        return fundersList[idx];
      }
      const newFunder = { id: `funder-${create.slug}`, ...create, createdAt: new Date(), updatedAt: new Date() };
      fundersList.push(newFunder);
      return newFunder;
    },
  },

  user: {
    findUnique: async (args: any) => {
      const u = usersList.find((usr) => matchesWhere(usr, args.where));
      return applySelectOrInclude(u, args.select, args.include);
    },
    findMany: async (args?: any) => {
      const filtered = usersList.filter((usr) => matchesWhere(usr, args?.where));
      const sorted = applySort(filtered, args?.orderBy);
      return sorted.map((u) => applySelectOrInclude(u, args?.select, args?.include));
    },
    create: async ({ data }: any) => {
      const id = data.id || `user-${Date.now()}`;
      const div = divisionsList.find((d) => d.id === data.divisionId) || null;
      const u: UserData = { ...data, id, division: div, createdAt: new Date(), updatedAt: new Date() };
      usersList.push(u);
      return u;
    },
    update: async ({ where, data }: any) => {
      const idx = usersList.findIndex((u) => matchesWhere(u, where));
      if (idx >= 0) {
        usersList[idx] = { ...usersList[idx], ...data, updatedAt: new Date() };
        return usersList[idx];
      }
      return null;
    },
  },

  project: {
    findMany: async (args?: any) => {
      const filtered = projectsList.filter((p) => matchesWhere(p, args?.where));
      return applySort(filtered, args?.orderBy);
    },
    findUnique: async (args: any) => {
      return projectsList.find((p) => matchesWhere(p, args.where)) ?? null;
    },
    count: async (args?: any) => {
      return projectsList.filter((p) => matchesWhere(p, args?.where)).length;
    },
    create: async ({ data }: any) => {
      const id = data.id || `proj-${Date.now()}`;
      const newProj = {
        id,
        name: data.name,
        sortOrder: projectsList.length,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };
      projectsList.push(newProj);
      return newProj;
    },
  },

  thematicArea: {
    findMany: async (args?: any) => {
      const filtered = thematicAreasList.filter((t) => matchesWhere(t, args?.where));
      return applySort(filtered, args?.orderBy);
    },
  },

  activityType: {
    findMany: async (args?: any) => {
      const filtered = activityTypesList.filter((a) => matchesWhere(a, args?.where));
      return applySort(filtered, args?.orderBy);
    },
  },

  ageGroup: {
    findMany: async (args?: any) => {
      const filtered = ageGroupsList.filter((a) => matchesWhere(a, args?.where));
      return applySort(filtered, args?.orderBy);
    },
  },

  keyPopulation: {
    findMany: async (args?: any) => {
      const filtered = keyPopulationsList.filter((k) => matchesWhere(k, args?.where));
      return applySort(filtered, args?.orderBy);
    },
  },

  region: {
    findMany: async (args?: any) => {
      const filtered = regionsList.filter((r) => matchesWhere(r, args?.where));
      return applySort(filtered, args?.orderBy).map((r) => applySelectOrInclude(r, args?.select, args?.include));
    },
  },

  division: {
    findMany: async (args?: any) => {
      const filtered = divisionsList.filter((d) => matchesWhere(d, args?.where));
      return applySort(filtered, args?.orderBy);
    },
  },

  subdivision: {
    findMany: async (args?: any) => {
      const filtered = subdivisionsList.filter((s) => matchesWhere(s, args?.where));
      return applySort(filtered, args?.orderBy);
    },
  },

  community: {
    count: async (args?: any) => {
      return communitiesList.filter((c) => matchesWhere(c, args?.where)).length;
    },
    findMany: async (args?: any) => {
      const filtered = communitiesList.filter((c) => matchesWhere(c, args?.where));
      const sorted = applySort(filtered, args?.orderBy);
      return sorted.map((c) => applySelectOrInclude(c, args?.select, args?.include));
    },
    findUnique: async (args: any) => {
      const c = communitiesList.find((comm) => matchesWhere(comm, args.where));
      return applySelectOrInclude(c, args.select, args.include);
    },
    create: async ({ data }: any) => {
      const id = `comm-${commCounter++}`;
      const sub = subdivisionsList.find((s) => s.id === data.subdivisionId)!;
      const cObj: CommunityData = {
        id,
        name: data.name,
        sortOrder: communitiesList.length,
        subdivisionId: data.subdivisionId,
        subdivision: sub,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        isCustom: true,
        createdById: data.createdById ?? null,
        createdAt: new Date(),
      };
      communitiesList.push(cObj);
      sub.communities?.push(cObj);
      return cObj;
    },
  },

  session: {
    count: async (args?: any) => {
      return sessionsList.filter((s) => matchesWhere(s, args?.where)).length;
    },
    aggregate: async (args?: any) => {
      const matched = sessionsList.filter((s) => matchesWhere(s, args?.where));
      let sumParticipants = 0;
      for (const s of matched) {
        sumParticipants += s.totalParticipants || 0;
      }
      return {
        _sum: {
          totalParticipants: sumParticipants,
        },
      };
    },
    findMany: async (args?: any) => {
      const matched = sessionsList.filter((s) => matchesWhere(s, args?.where));
      const sorted = applySort(matched, args?.orderBy);
      const sliced = args?.take ? sorted.slice(0, args.take) : sorted;
      return sliced.map((s) => applySelectOrInclude(s, args?.select, args?.include));
    },
    findUnique: async (args: any) => {
      const s = sessionsList.find((sess) => matchesWhere(sess, args.where));
      return applySelectOrInclude(s, args.select, args.include);
    },
    create: async ({ data }: any) => {
      const sId = `sess-${sessionCounter++}`;
      const comm = communitiesList.find((c) => c.id === data.communityId)!;
      const author = usersList.find((u) => u.id === data.createdById)!;
      const proj = data.projectId ? projectsList.find((p) => p.id === data.projectId) ?? null : null;
      const them = data.thematicAreaId ? thematicAreasList.find((t) => t.id === data.thematicAreaId) ?? null : null;
      const age = data.ageGroupId ? ageGroupsList.find((a) => a.id === data.ageGroupId) ?? null : null;
      const act = data.activityTypeId ? activityTypesList.find((a) => a.id === data.activityTypeId) ?? null : null;

      const sCounts: SessionCountData[] = [];
      if (data.counts?.create) {
        for (const c of data.counts.create) {
          const kp = keyPopulationsList.find((k) => k.id === c.keyPopulationId)!;
          const cRow: SessionCountData = {
            id: `cnt-${countCounter++}`,
            sessionId: sId,
            keyPopulationId: c.keyPopulationId,
            keyPopulation: kp,
            sex: c.sex,
            count: c.count,
          };
          sCounts.push(cRow);
          sessionCountsList.push(cRow);
        }
      }

      const sFacs: SessionFacilitatorData[] = [];
      if (data.facilitators?.create) {
        for (const f of data.facilitators.create) {
          const fObj: SessionFacilitatorData = {
            id: `fac-${facCounter++}`,
            sessionId: sId,
            name: f.name,
            userId: null,
          };
          sFacs.push(fObj);
          sessionFacilitatorsList.push(fObj);
        }
      }

      const sessionObj: SessionData = {
        id: sId,
        date: data.date instanceof Date ? data.date : new Date(data.date),
        communityId: data.communityId,
        community: comm,
        projectId: proj?.id ?? null,
        project: proj,
        thematicAreaId: them?.id ?? null,
        thematicArea: them,
        ageGroupId: age?.id ?? null,
        ageGroup: age,
        activityTypeId: act?.id ?? null,
        activityType: act,
        notes: data.notes ?? null,
        totalParticipants: data.totalParticipants || sCounts.reduce((acc, cur) => acc + cur.count, 0),
        sourceDocumentId: data.sourceDocumentId ?? null,
        createdById: data.createdById,
        createdBy: author,
        facilitators: sFacs,
        counts: sCounts,
        clinicalRecords: [],
        auditLogs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      sessionsList.push(sessionObj);
      if (!comm.sessions) comm.sessions = [];
      comm.sessions.push(sessionObj);
      return sessionObj;
    },
    update: async ({ where, data }: any) => {
      const idx = sessionsList.findIndex((s) => matchesWhere(s, where));
      if (idx >= 0) {
        const cur = sessionsList[idx];
        const updated: SessionData = {
          ...cur,
          ...data,
          date: data.date ? (data.date instanceof Date ? data.date : new Date(data.date)) : cur.date,
          updatedAt: new Date(),
        };
        sessionsList[idx] = updated;
        return updated;
      }
      return null;
    },
    deleteMany: async ({ where }: any) => {
      const before = sessionsList.length;
      for (let i = sessionsList.length - 1; i >= 0; i--) {
        if (matchesWhere(sessionsList[i], where)) {
          sessionsList.splice(i, 1);
        }
      }
      return { count: before - sessionsList.length };
    },
  },

  sessionCount: {
    deleteMany: async ({ where }: any) => {
      let count = 0;
      for (let i = sessionCountsList.length - 1; i >= 0; i--) {
        if (matchesWhere(sessionCountsList[i], where)) {
          sessionCountsList.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
  },

  sessionFacilitator: {
    findMany: async (args?: any) => {
      let list = sessionFacilitatorsList.filter((f) => matchesWhere(f, args?.where));
      if (args?.distinct?.includes("name")) {
        const seen = new Set<string>();
        list = list.filter((f) => {
          if (seen.has(f.name)) return false;
          seen.add(f.name);
          return true;
        });
      }
      return applySort(list, args?.orderBy).map((f) =>
        applySelectOrInclude(f, args?.select, args?.include),
      );
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      for (let i = sessionFacilitatorsList.length - 1; i >= 0; i--) {
        if (matchesWhere(sessionFacilitatorsList[i], where)) {
          sessionFacilitatorsList.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
  },

  srhrClinicalTelemetry: {
    findMany: async (args?: any) => {
      // Find matching sessions first if where.session
      const sessionFilter = args?.where?.session;
      const matched = clinicalRecordsList.filter((r) => {
        if (sessionFilter) {
          const sess = sessionsList.find((s) => s.id === r.sessionId);
          if (!sess || !matchesWhere(sess, sessionFilter)) return false;
        }
        return matchesWhere(r, args?.where);
      });
      return matched.map((r) => applySelectOrInclude(r, args?.select, args?.include));
    },
    create: async ({ data }: any) => {
      const rObj: SrhrClinicalRecordData = {
        id: `clin-${clinicCounter++}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      clinicalRecordsList.push(rObj);
      return rObj;
    },
  },

  narrativePeriod: {
    findMany: async (args?: any) => {
      const matched = narrativePeriodsList.filter((n) => matchesWhere(n, args?.where));
      const sorted = applySort(matched, args?.orderBy);
      const sliced = args?.take ? sorted.slice(0, args.take) : sorted;
      return sliced.map((n) => applySelectOrInclude(n, args?.select, args?.include));
    },
    findUnique: async (args: any) => {
      const n = narrativePeriodsList.find((np) => matchesWhere(np, args.where));
      return applySelectOrInclude(n, args.select, args.include);
    },
    findFirst: async (args?: any) => {
      const matched = narrativePeriodsList.filter((n) => matchesWhere(n, args?.where));
      const sorted = applySort(matched, args?.orderBy);
      return sorted[0] ? applySelectOrInclude(sorted[0], args?.select, args?.include) : null;
    },
    upsert: async ({ where, update, create }: any) => {
      const idx = narrativePeriodsList.findIndex((n) => matchesWhere(n, where));
      if (idx >= 0) {
        narrativePeriodsList[idx] = {
          ...narrativePeriodsList[idx],
          ...update,
          updatedAt: new Date(),
        };
        return narrativePeriodsList[idx];
      }
      const author = usersList.find((u) => u.id === create.createdById) || coordinator;
      const newNarrative: NarrativePeriodData = {
        id: `narrative-${Date.now()}`,
        ...create,
        createdBy: author,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      narrativePeriodsList.push(newNarrative);
      return newNarrative;
    },
  },

  report: {
    findMany: async (args?: any) => {
      const matched = reportsList.filter((r) => matchesWhere(r, args?.where));
      return applySort(matched, args?.orderBy);
    },
    create: async ({ data }: any) => {
      const r = { id: `rep-${Date.now()}`, ...data, generatedAt: new Date() };
      reportsList.push(r);
      return r;
    },
  },

  auditLog: {
    findMany: async (args?: any) => {
      const matched = auditLogsList.filter((a) => matchesWhere(a, args?.where));
      const sorted = applySort(matched, args?.orderBy);
      const sliced = args?.take ? sorted.slice(0, args.take) : sorted;
      return sliced.map((a) => applySelectOrInclude(a, args?.select, args?.include));
    },
    create: async ({ data }: any) => {
      const a: AuditLogData = {
        id: `audit-${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      auditLogsList.push(a);
      return a;
    },
  },

  document: {
    findMany: async (args?: any) => {
      const matched = documentsList.filter((d) => matchesWhere(d, args?.where));
      return applySort(matched, args?.orderBy);
    },
    findUnique: async (args: any) => {
      const doc = documentsList.find((d) => matchesWhere(d, args.where));
      return applySelectOrInclude(doc, args.select, args.include);
    },
    create: async ({ data }: any) => {
      const doc = {
        id: `doc-${Date.now()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        uploadedBy: usersList.find((u) => u.id === data.uploadedById) || coordinator,
      };
      documentsList.push(doc);
      return doc;
    },
    update: async ({ where, data }: any) => {
      const idx = documentsList.findIndex((d) => matchesWhere(d, where));
      if (idx >= 0) {
        documentsList[idx] = { ...documentsList[idx], ...data, updatedAt: new Date() };
        return documentsList[idx];
      }
      return null;
    },
  },

  $queryRaw: async (..._args: any[]) => {
    const years = Array.from(new Set(sessionsList.map((s) => new Date(s.date).getUTCFullYear())));
    return years.sort((a, b) => b - a).map((year) => ({ year }));
  },
  $executeRaw: async (..._args: any[]) => {
    return 0;
  },

  $transaction: async (arg: any) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    if (typeof arg === "function") {
      return arg(mockDb);
    }
    return [];
  },
};
