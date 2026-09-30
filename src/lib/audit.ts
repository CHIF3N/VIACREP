import "server-only";

import { db } from "./db";
import type { SessionUser } from "./auth";
import type { Scope } from "./scope";
import { combineWhere } from "./aggregate";

export type AuditEntry = {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: Date;
  userName: string | null;
  sessionDate: Date | null;
  communityName: string | null;
};

/**
 * Returns recent audit log entries for sessions visible to the user.
 * Used by the data quality center.
 */
export async function getAuditLog(
  user: SessionUser,
  scope: Scope,
  limit = 50,
): Promise<AuditEntry[]> {
  const sessionWhere = combineWhere(scope, user);

  const logs = await db.auditLog.findMany({
    where: {
      sessionId: { not: null },
      session: sessionWhere,
    },
    include: {
      user: { select: { name: true } },
      session: {
        select: {
          date: true,
          community: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    entityType: log.entityType,
    entityId: log.entityId,
    field: log.field,
    oldValue: log.oldValue,
    newValue: log.newValue,
    reason: log.reason,
    createdAt: log.createdAt,
    userName: log.user?.name ?? null,
    sessionDate: log.session?.date ?? null,
    communityName: log.session?.community.name ?? null,
  }));
}

/**
 * Writes an audit log entry for a session field change.
 */
export async function writeAuditLog({
  sessionId,
  field,
  oldValue,
  newValue,
  reason,
  userId,
}: {
  sessionId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  userId: string | null;
}) {
  await db.auditLog.create({
    data: {
      entityType: "Session",
      entityId: sessionId,
      field,
      oldValue,
      newValue,
      reason,
      userId,
      sessionId,
    },
  });
}