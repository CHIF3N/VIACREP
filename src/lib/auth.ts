import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { db } from "./db";
import type { SessionUser } from "./roles";

// Re-export client-safe role helpers and SessionUser from lib/roles.ts
// so existing code importing from lib/auth still works.
export type { SessionUser } from "./roles";
export {
  seesEverything,
  canManageSettings,
  canAddCommunity,
  canEditSession,
  canWriteReports,
} from "./roles";

const COOKIE_NAME = "viac_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // one week

function secret() {
  const value =
    process.env.AUTH_SECRET ||
    "viac-secret-auth-key-cameroon-2026-production-token";
  return new TextEncoder().encode(value);
}

/* -------------------------------------------------------------------------- */
/* Sign in / sign out                                                          */
/* -------------------------------------------------------------------------- */

export async function verifyCredentials(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) {
    await bcrypt.compare(password, "$2b$10$invalidinvalidinvalidinvalidinva");
    return null;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function createSession(userId: string): Promise<string> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    partitioned: true as any,
  });

  return token;
}

export async function destroySession() {
  const store = await cookies();
  try {
    store.set(COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      partitioned: true as any,
    });
  } catch {
    // ignore
  }
  store.delete(COOKIE_NAME);
}

/* -------------------------------------------------------------------------- */
/* Reading the current user                                                    */
/* -------------------------------------------------------------------------- */

/** `cache` dedupes this across the many server components that ask per render. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  let token = store.get(COOKIE_NAME)?.value;

  if (!token) {
    try {
      const headerList = await headers();
      token = headerList.get("x-viac-session") || undefined;
      if (!token) {
        const auth = headerList.get("authorization");
        if (auth?.startsWith("Bearer ")) {
          token = auth.slice(7).trim();
        }
      }
    } catch {
      // In contexts where headers() cannot be accessed
    }
  }

  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { division: { select: { id: true, name: true } } },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    designation: user.designation,
    divisionId: user.divisionId,
    divisionName: user.division?.name ?? null,
  };
});

/** For pages that must have a user; the layout redirects, this is the guard. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* -------------------------------------------------------------------------- */
/* Roles                                                                       */
/* -------------------------------------------------------------------------- */

export const ROLE_LABELS: Record<Role, string> = {
  OFFICER: "Field Officer",
  COORDINATOR: "Coordinator",
  APPROVER: "Approver",
};