import "server-only";

import { db } from "./db";
import type { SessionUser } from "./auth";
import type { Scope } from "./scope";
import { combineWhere } from "./aggregate";

export type MamaAggregate = {
  hotlineContacts: number;
  peerAccompanimentCases: number;
  safeSpaceOutreaches: number;
  meanPaseScore: number | null;
  gbvDisclosures: number;
  gbvReferralsCompleted: number;
  autonomousDecisions: number;
  totalClinicalRecords: number;
};

/**
 * MAMA Network KPIs computed from SrhrClinicalTelemetry records
 * for sessions in the given scope.
 *
 * "Hotline contacts" = isTelecounseling=false records (peer/hotline).
 * "Peer accompaniment" = sessions whose project name contains "MAMA".
 * "Safe space" = sessions whose activityType contains "Safe Space".
 */
export async function aggregateMama(
  scope: Scope,
  user: SessionUser,
): Promise<MamaAggregate> {
  const sessionWhere = combineWhere(scope, user);

  // Fetch all clinical records for sessions in scope
  const records = await db.srhrClinicalTelemetry.findMany({
    where: { session: sessionWhere },
    select: {
      paseScore: true,
      gbvDisclosed: true,
      gbvReferralCompleted: true,
      autonomousDecisionMade: true,
      isTelecounseling: true,
    },
  });

  // Hotline contacts = non-telecounseling clinical records
  const hotlineContacts = records.filter((r) => !r.isTelecounseling).length;

  // Peer accompaniment = MAMA project sessions
  const peerAccompanimentCases = await db.session.count({
    where: {
      ...sessionWhere,
      project: { name: { contains: "MAMA", mode: "insensitive" } },
    },
  });

  // Safe space outreaches
  const safeSpaceOutreaches = await db.session.count({
    where: {
      ...sessionWhere,
      activityType: { name: { contains: "Safe Space", mode: "insensitive" } },
    },
  });

  const paseScores = records
    .map((r) => r.paseScore)
    .filter((s): s is number => s !== null && s >= 5 && s <= 25);
  const meanPaseScore =
    paseScores.length > 0
      ? Math.round((paseScores.reduce((a, b) => a + b, 0) / paseScores.length) * 10) / 10
      : null;

  const gbvDisclosures = records.filter((r) => r.gbvDisclosed === true).length;
  const gbvReferralsCompleted = records.filter((r) => r.gbvReferralCompleted === true).length;
  const autonomousDecisions = records.filter((r) => r.autonomousDecisionMade === true).length;

  return {
    hotlineContacts,
    peerAccompanimentCases,
    safeSpaceOutreaches,
    meanPaseScore,
    gbvDisclosures,
    gbvReferralsCompleted,
    autonomousDecisions,
    totalClinicalRecords: records.length,
  };
}
