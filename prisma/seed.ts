/**
 * Seeds everything the demo needs:
 *   - VIAC organisation record (letterhead + brand tokens + default narrative)
 *   - Three funder/lens rows (VIAC, MAMA, WHW)
 *   - Four demo accounts
 *   - Full geography tree from Sheet1 (103 communities) + GPS coordinates
 *   - Lookup lists from the workbook dropdowns
 *   - Key-population count matrix from Data_Entry
 *   - ~5 months of realistic outreach sessions
 *
 * Safe to re-run: everything is upserted; sessions regenerated from a fixed seed.
 */
import { PrismaClient, Role, Sex, NarrativeStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GEOGRAPHY, SEEDED_COMMUNITY_COUNT } from "./data/geography";
import {
  PROJECTS,
  AGE_GROUPS,
  THEMATIC_AREAS,
  ACTIVITY_TYPES,
  KEY_POPULATIONS,
} from "./data/lookups";
import {
  DEFAULT_OBJECTIVES,
  DEFAULT_METHODOLOGY,
  DEFAULT_LESSONS_LEARNT,
  DEFAULT_CHALLENGES,
  DEFAULT_RECOMMENDATIONS,
} from "./data/narrative-defaults";
import { COMMUNITY_COORDS } from "./data/coordinates";

const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/* Deterministic randomness                                                    */
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

const DEMO_PASSWORD = "viac2026";

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

async function main() {
  console.log("· Seeding VIAC Reports\n");

  /* --- organisation ------------------------------------------------------ */
  const orgData = {
    name: "Vision in Action Cameroon",
    shortName: "VIAC",
    headerImageUrl: "/letterhead/viac_header.png",
    footerImageUrl: "/letterhead/viac_footer.png",
    brandTokens: {
      blue: "#1CA3EC",
      gold: "#DDA328",
      charcoal: "#2A2A2A",
      lightGrey: "#ECECEC",
    },
    defaultObjectives: DEFAULT_OBJECTIVES,
    defaultMethodology: DEFAULT_METHODOLOGY,
    defaultLessonsLearnt: DEFAULT_LESSONS_LEARNT,
    defaultChallenges: DEFAULT_CHALLENGES,
    defaultRecommendations: DEFAULT_RECOMMENDATIONS,
  };
  const existingOrg = await prisma.organization.findFirst();
  const org = existingOrg
    ? await prisma.organization.update({ where: { id: existingOrg.id }, data: orgData })
    : await prisma.organization.create({ data: orgData });
  console.log(`  organisation      ${org.name}`);

  /* --- funders / lenses -------------------------------------------------- */
  const FUNDERS = [
    {
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
    },
    {
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
    },
    {
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
    },
  ];
  for (const f of FUNDERS) {
    await prisma.funder.upsert({
      where: { slug: f.slug },
      update: { name: f.name, templateConfig: f.templateConfig, reportingFrequency: f.reportingFrequency },
      create: f,
    });
  }
  console.log(`  funders           ${FUNDERS.length} (viac, mama, whw)`);

  /* --- geography + coordinates ------------------------------------------- */
  const communityIds: string[] = [];
  const divisionIdByName = new Map<string, string>();

  for (const [ri, region] of GEOGRAPHY.entries()) {
    const r = await prisma.region.upsert({
      where: { name: region.name },
      update: { sortOrder: ri },
      create: { name: region.name, sortOrder: ri },
    });

    for (const [di, division] of region.divisions.entries()) {
      const d = await prisma.division.upsert({
        where: { regionId_name: { regionId: r.id, name: division.name } },
        update: { sortOrder: di },
        create: { name: division.name, regionId: r.id, sortOrder: di },
      });
      divisionIdByName.set(division.name, d.id);

      for (const [si, subdivision] of division.subdivisions.entries()) {
        const s = await prisma.subdivision.upsert({
          where: { divisionId_name: { divisionId: d.id, name: subdivision.name } },
          update: { sortOrder: si },
          create: { name: subdivision.name, divisionId: d.id, sortOrder: si },
        });

        for (const [ci, name] of subdivision.communities.entries()) {
          const coords = COMMUNITY_COORDS[subdivision.name]?.[name];
          const c = await prisma.community.upsert({
            where: { subdivisionId_name: { subdivisionId: s.id, name } },
            update: {
              sortOrder: ci,
              lat: coords?.[0] ?? null,
              lng: coords?.[1] ?? null,
            },
            create: {
              name,
              subdivisionId: s.id,
              sortOrder: ci,
              lat: coords?.[0] ?? null,
              lng: coords?.[1] ?? null,
            },
          });
          communityIds.push(c.id);
        }
      }
    }
  }
  console.log(
    `  geography         ${communityIds.length} communities (workbook has ${SEEDED_COMMUNITY_COUNT})`,
  );

  /* --- users ------------------------------------------------------------- */
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = await Promise.all(
    [
      {
        name: "Ndip Claudia",
        email: "coordinator@viacame.org",
        role: Role.COORDINATOR,
        designation: "Programme Coordinator",
        divisionName: null,
      },
      {
        name: "Ebong Martin",
        email: "approver@viacame.org",
        role: Role.APPROVER,
        designation: "Executive Director",
        divisionName: null,
      },
      {
        name: "Ngwa Brenda",
        email: "officer.fako@viacame.org",
        role: Role.OFFICER,
        designation: "Field Officer — Fako",
        divisionName: "Fako",
      },
      {
        name: "Achu Vivian",
        email: "officer.mezam@viacame.org",
        role: Role.OFFICER,
        designation: "Field Officer — Mezam",
        divisionName: "Mezam",
      },
    ].map(({ divisionName, ...u }) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          role: u.role,
          designation: u.designation,
          divisionId: divisionName ? (divisionIdByName.get(divisionName) ?? null) : null,
        },
        create: {
          ...u,
          passwordHash,
          divisionId: divisionName ? (divisionIdByName.get(divisionName) ?? null) : null,
        },
      }),
    ),
  );
  const coordinator = users[0];
  console.log(`  users             ${users.length} (password: ${DEMO_PASSWORD})`);

  /* --- lookups ----------------------------------------------------------- */
  const projects = await Promise.all(
    PROJECTS.map((name, i) =>
      prisma.project.upsert({
        where: { name },
        update: { sortOrder: i },
        create: { name, sortOrder: i },
      }),
    ),
  );
  const ageGroups = await Promise.all(
    AGE_GROUPS.map((name, i) =>
      prisma.ageGroup.upsert({
        where: { name },
        update: { sortOrder: i },
        create: { name, sortOrder: i },
      }),
    ),
  );
  const thematicAreas = await Promise.all(
    THEMATIC_AREAS.map((name, i) =>
      prisma.thematicArea.upsert({
        where: { name },
        update: { sortOrder: i },
        create: { name, sortOrder: i },
      }),
    ),
  );
  const activityTypes = await Promise.all(
    ACTIVITY_TYPES.map((name, i) =>
      prisma.activityType.upsert({
        where: { name },
        update: { sortOrder: i },
        create: { name, sortOrder: i },
      }),
    ),
  );
  const keyPopulations = await Promise.all(
    KEY_POPULATIONS.map((kp, i) =>
      prisma.keyPopulation.upsert({
        where: { name: kp.name },
        update: { ...kp, sortOrder: i },
        create: { ...kp, sortOrder: i },
      }),
    ),
  );
  console.log(
    `  lookups           ${projects.length} projects · ${thematicAreas.length} thematic areas · ` +
      `${activityTypes.length} activity types · ${ageGroups.length} age groups · ` +
      `${keyPopulations.length} key populations`,
  );

  /* --- demo sessions ----------------------------------------------------- */
  await prisma.session.deleteMany({});

  const officers = users.filter((u) => u.role === Role.OFFICER);
  const communitiesByDivision = new Map<string, string[]>();
  for (const community of await prisma.community.findMany({
    include: { subdivision: { include: { division: true } } },
  })) {
    const key = community.subdivision.division.id;
    const list = communitiesByDivision.get(key) ?? [];
    list.push(community.id);
    communitiesByDivision.set(key, list);
  }

  const today = new Date();
  const months: { year: number; month: number }[] = [];
  for (let back = 5; back >= 1; back--) {
    const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  let sessionCount = 0;
  for (const [index, { year, month }] of months.entries()) {
    const perMonth = 4 + index;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let n = 0; n < perMonth; n++) {
      const author = chance(0.25) ? coordinator : pick(officers);
      const pool =
        author.divisionId && communitiesByDivision.has(author.divisionId)
          ? communitiesByDivision.get(author.divisionId)!
          : communityIds;

      const date = new Date(Date.UTC(year, month, between(1, daysInMonth)));

      const counts: { keyPopulationId: string; sex: Sex; count: number }[] = [];
      const add = (kpName: string, sex: Sex, count: number) => {
        if (count <= 0) return;
        const kp = keyPopulations.find((k) => k.name === kpName);
        if (!kp) return;
        counts.push({ keyPopulationId: kp.id, sex, count });
      };

      add("General", Sex.FEMALE, between(6, 26));
      add("General", Sex.MALE, between(4, 20));
      if (chance(0.55))
        add("Adolescent Girls & Young Women (AGYW)", Sex.FEMALE, between(3, 14));
      if (chance(0.45))
        add("Adolescent & Young Boys/Men (AYBM)", Sex.MALE, between(2, 12));
      if (chance(0.4)) {
        add("Internally Displaced Persons (IDPs)", Sex.FEMALE, between(2, 11));
        add("Internally Displaced Persons (IDPs)", Sex.MALE, between(1, 8));
      }
      if (chance(0.28)) {
        add("Sex Workers", Sex.FEMALE, between(2, 9));
        if (chance(0.3)) add("Sex Workers", Sex.MALE, between(1, 3));
      }
      if (chance(0.22)) {
        add("Persons with Disabilities", Sex.FEMALE, between(1, 5));
        add("Persons with Disabilities", Sex.MALE, between(1, 5));
      }
      if (chance(0.18)) {
        add("Gender Minorities", Sex.FEMALE, between(1, 4));
        add("Gender Minorities", Sex.MALE, between(1, 4));
      }

      const totalParticipants = counts.reduce((sum, c) => sum + c.count, 0);

      const facilitators = Array.from(
        new Set(Array.from({ length: between(1, 3) }, () => pick(FACILITATOR_POOL))),
      );

      await prisma.session.create({
        data: {
          date,
          communityId: pick(pool),
          projectId: chance(0.92) ? pick(projects).id : null,
          thematicAreaId: chance(0.95) ? pick(thematicAreas).id : null,
          ageGroupId: chance(0.9) ? pick(ageGroups).id : null,
          activityTypeId: chance(0.9) ? pick(activityTypes).id : null,
          notes: null,
          totalParticipants,
          createdById: author.id,
          counts: { create: counts },
          facilitators: { create: facilitators.map((name) => ({ name })) },
        },
      });
      sessionCount++;
    }
  }
  console.log(`  sessions          ${sessionCount} across ${months.length} months`);

  /* --- a finished narrative for the most recent complete month ----------- */
  const last = months[months.length - 1];
  const periodStart = new Date(Date.UTC(last.year, last.month, 1));
  const periodEnd = new Date(Date.UTC(last.year, last.month + 1, 0));
  const scopeKey = `monthly:${last.year}-${String(last.month + 1).padStart(2, "0")}`;
  const title = `${periodStart.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })} Monthly Narrative Report`;

  await prisma.narrativePeriod.upsert({
    where: { scopeKey },
    update: {},
    create: {
      scopeKey,
      scope: { period: { kind: "month", year: last.year, month: last.month + 1 } },
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
    },
  });
  console.log(`  narrative         ${title}`);

  console.log("\n· Done.\n");
  console.log("  Sign in with any of:");
  console.log("    coordinator@viacame.org    (Coordinator — sees everything)");
  console.log("    approver@viacame.org       (Approver)");
  console.log("    officer.fako@viacame.org   (Officer — Fako only)");
  console.log("    officer.mezam@viacame.org  (Officer — Mezam only)");
  console.log(`  Password for all: ${DEMO_PASSWORD}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
