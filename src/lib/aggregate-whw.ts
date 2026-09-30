import "server-only";

import { db } from "./db";
import type { SessionUser } from "./auth";
import type { Scope } from "./scope";
import { combineWhere } from "./aggregate";

/** WHW benchmark constants */
export const WHW_BENCHMARKS = {
  /** Target: ≤12.6% of clients seek additional medical care */
  additionalCarePct: 0.126,
  /** Target: ≥87.5% client satisfaction (very satisfied + satisfied) */
  satisfactionPct: 0.875,
} as const;

export type WhwAggregate = {
  telecounselingReach: number;
  /** Total clinical records with a recorded outcome */
  outcomesRecorded: number;
  /** % of outcomes where outcome = NO_LONGER_PREGNANT */
  outcomeCompletionPct: number | null;
  /** Raw count of additional care sought */
  additionalCareSought: number;
  /** % of clients who sought additional care */
  additionalCarePct: number | null;
  /** % of clients who were very satisfied or satisfied */
  satisfactionPct: number | null;
  satisfiedCount: number;
  totalWithSatisfactionRating: number;
  benchmarks: typeof WHW_BENCHMARKS;
  /** Additional care sought vs benchmark (positive = over benchmark) */
  additionalCareDelta: number | null;
  /** Satisfaction vs benchmark (positive = above benchmark) */
  satisfactionDelta: number | null;
};

/**
 * WHW-specific aggregations from SrhrClinicalTelemetry records.
 */
export async function aggregateWhw(
  scope: Scope,
  user: SessionUser,
): Promise<WhwAggregate> {
  const sessionWhere = combineWhere(scope, user);

  const records = await db.srhrClinicalTelemetry.findMany({
    where: { session: sessionWhere },
    select: {
      isTelecounseling: true,
      outcomeReported: true,
      additionalMedicalCareSought: true,
      satisfactionRating: true,
    },
  });

  // Telehealth reach = sessions with telecounseling records
  const telecounselingReach = await db.session.count({
    where: {
      ...sessionWhere,
      clinicalRecords: { some: { isTelecounseling: true } },
    },
  });

  const withOutcome = records.filter((r) => r.outcomeReported !== null);
  const completedOutcomes = withOutcome.filter(
    (r) => r.outcomeReported === "NO_LONGER_PREGNANT",
  ).length;
  const outcomeCompletionPct =
    withOutcome.length > 0 ? completedOutcomes / withOutcome.length : null;

  const withCareInfo = records.filter((r) => r.additionalMedicalCareSought !== null);
  const additionalCareSought = withCareInfo.filter(
    (r) => r.additionalMedicalCareSought === true,
  ).length;
  const additionalCarePct =
    withCareInfo.length > 0 ? additionalCareSought / withCareInfo.length : null;

  const withRating = records.filter((r) => r.satisfactionRating !== null);
  const satisfiedCount = withRating.filter(
    (r) =>
      r.satisfactionRating === "VERY_SATISFIED" || r.satisfactionRating === "SATISFIED",
  ).length;
  const satisfactionPct = withRating.length > 0 ? satisfiedCount / withRating.length : null;

  return {
    telecounselingReach,
    outcomesRecorded: withOutcome.length,
    outcomeCompletionPct,
    additionalCareSought,
    additionalCarePct,
    satisfactionPct,
    satisfiedCount,
    totalWithSatisfactionRating: withRating.length,
    benchmarks: WHW_BENCHMARKS,
    additionalCareDelta:
      additionalCarePct !== null
        ? additionalCarePct - WHW_BENCHMARKS.additionalCarePct
        : null,
    satisfactionDelta:
      satisfactionPct !== null
        ? satisfactionPct - WHW_BENCHMARKS.satisfactionPct
        : null,
  };
}
