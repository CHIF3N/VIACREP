import "server-only";

import { db } from "./db";
import type { SessionUser } from "./auth";
import { combineWhere } from "./aggregate";
import { ALL_TIME } from "./scope";

export type QualityAlert = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  count: number;
  /** Link to filter sessions showing the issue */
  filterHref?: string;
};

/**
 * Returns a list of data quality alerts for sessions visible to the user.
 * These are cached at the page level — revalidated on each dashboard load.
 */
export async function getQualityAlerts(user: SessionUser): Promise<QualityAlert[]> {
  const where = combineWhere(ALL_TIME, user);
  const alerts: QualityAlert[] = [];

  // 1. Sessions where community has no GPS coordinates
  const noCoords = await db.session.count({
    where: { ...where, community: { lat: null } },
  });
  if (noCoords > 0) {
    alerts.push({
      id: "no-coords",
      severity: "warning",
      message: "Sessions in communities with no GPS coordinates",
      count: noCoords,
      filterHref: "/sessions?missingCoords=1",
    });
  }

  // 2. Sessions where session total != sum of counts
  // We detect this by finding sessions where totalParticipants = 0 but date is set
  // (no counts were ever saved — edge case in data entry)
  const zeroCounts = await db.session.count({
    where: { ...where, totalParticipants: 0 },
  });
  if (zeroCounts > 0) {
    alerts.push({
      id: "zero-count",
      severity: "error",
      message: "Sessions with zero total participants recorded",
      count: zeroCounts,
    });
  }

  // 3. Sessions with no project assigned
  const noProject = await db.session.count({
    where: { ...where, projectId: null },
  });
  if (noProject > 0) {
    alerts.push({
      id: "no-project",
      severity: "info",
      message: "Sessions with no project assigned",
      count: noProject,
    });
  }

  // 4. Sessions with no thematic area
  const noThematic = await db.session.count({
    where: { ...where, thematicAreaId: null },
  });
  if (noThematic > 0) {
    alerts.push({
      id: "no-thematic",
      severity: "info",
      message: "Sessions missing a thematic area",
      count: noThematic,
    });
  }

  return alerts;
}
