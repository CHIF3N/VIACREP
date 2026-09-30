/**
 * Pure role-check helpers and the SessionUser shape.
 *
 * This file has NO "server-only" guard so it can be safely imported by
 * Client Components (e.g. the Sidebar) that need to gate UI based on role.
 * Server-side authentication (requireUser, createSession, etc.) lives in
 * lib/auth.ts which does have the guard.
 */

import { Role } from "@prisma/client";

export type { Role };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  designation: string | null;
  divisionId: string | null;
  divisionName: string | null;
};

/** Coordinators and approvers see the whole organisation. */
export function seesEverything(user: SessionUser) {
  return user.role === Role.COORDINATOR || user.role === Role.APPROVER;
}

/** Managing lookup lists, geography and the letterhead is coordinator work. */
export function canManageSettings(user: SessionUser) {
  return user.role === Role.COORDINATOR;
}

/**
 * Per the brief: coordinators add new communities. Officers pick from the list.
 */
export function canAddCommunity(user: SessionUser) {
  return user.role === Role.COORDINATOR;
}

/** Officers may only change sessions they logged. */
export function canEditSession(user: SessionUser, createdById: string) {
  return seesEverything(user) || user.id === createdById;
}

/**
 * Report authoring is deliberately open to every role — the brief is explicit
 * that roles scope what you can see, not whether you can write a report.
 */
export function canWriteReports() {
  return true;
}