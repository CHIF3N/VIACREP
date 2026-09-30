"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  canAddCommunity,
  canEditSession,
  requireUser,
} from "@/lib/auth";
import {
  createSession,
  sessionInputSchema,
  updateSession,
  type SessionInput,
} from "@/lib/sessions";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/sessions");
  revalidatePath("/reports");
  revalidatePath("/data");
  revalidatePath("/map");
}

/* -------------------------------------------------------------------------- */

export async function saveSessionAction(
  input: SessionInput,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors,
    };
  }

  try {
    if (id) {
      const existing = await db.session.findUnique({
        where: { id },
        select: { createdById: true },
      });
      if (!existing) return { ok: false, error: "That session no longer exists." };
      if (!canEditSession(user, existing.createdById)) {
        return {
          ok: false,
          error: "You can only edit sessions you logged yourself.",
        };
      }
      await updateSession(id, parsed.data);
      revalidateAll();
      revalidatePath(`/sessions/${id}`);
      return { ok: true, data: { id } };
    }

    const created = await createSession(parsed.data, user.id);
    revalidateAll();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    console.error("saveSessionAction", error);
    return { ok: false, error: "Could not save the session. Please try again." };
  }
}

export async function deleteSessionAction(
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await db.session.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!existing) return { ok: false, error: "That session no longer exists." };
  if (!canEditSession(user, existing.createdById)) {
    return { ok: false, error: "You can only delete sessions you logged yourself." };
  }

  await db.session.delete({ where: { id } });
  revalidateAll();
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/* Manual-add for the lookup lists                                             */
/* -------------------------------------------------------------------------- */

const newCommunitySchema = z.object({
  name: z.string().trim().min(2, "Give the community a name").max(120),
  subdivisionId: z.string().min(1, "Choose the division and subdivision"),
});

export async function createCommunityAction(input: {
  name: string;
  subdivisionId: string;
}): Promise<ActionResult<{ id: string; name: string; label: string }>> {
  const user = await requireUser();
  if (!canAddCommunity(user)) {
    return {
      ok: false,
      error:
        "Only a coordinator can add a new community. Ask your coordinator to add it.",
    };
  }

  const parsed = newCommunitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const existing = await db.community.findFirst({
    where: {
      subdivisionId: parsed.data.subdivisionId,
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
    include: { subdivision: { include: { division: true } } },
  });
  if (existing) {
    return {
      ok: true,
      data: {
        id: existing.id,
        name: existing.name,
        label: `${existing.subdivision.division.name} - ${existing.subdivision.name}`,
      },
    };
  }

  const created = await db.community.create({
    data: {
      name: parsed.data.name,
      subdivisionId: parsed.data.subdivisionId,
      isCustom: true,
      createdById: user.id,
    },
    include: { subdivision: { include: { division: true } } },
  });

  revalidatePath("/sessions/new");
  revalidatePath("/settings");
  return {
    ok: true,
    data: {
      id: created.id,
      name: created.name,
      label: `${created.subdivision.division.name} - ${created.subdivision.name}`,
    },
  };
}

const nameSchema = z.string().trim().min(2, "Too short").max(120);

/** Thematic areas are free-entry in the workbook, so anyone may add one. */
export async function createThematicAreaAction(
  name: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  await requireUser();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const existing = await db.thematicArea.findFirst({
    where: { name: { equals: parsed.data, mode: "insensitive" } },
  });
  if (existing) return { ok: true, data: { id: existing.id, name: existing.name } };

  const count = await db.thematicArea.count();
  const created = await db.thematicArea.create({
    data: { name: parsed.data, sortOrder: count },
  });
  revalidatePath("/sessions/new");
  revalidatePath("/settings");
  return { ok: true, data: { id: created.id, name: created.name } };
}

export async function createActivityTypeAction(
  name: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  await requireUser();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const existing = await db.activityType.findFirst({
    where: { name: { equals: parsed.data, mode: "insensitive" } },
  });
  if (existing) return { ok: true, data: { id: existing.id, name: existing.name } };

  const count = await db.activityType.count();
  const created = await db.activityType.create({
    data: { name: parsed.data, sortOrder: count },
  });
  revalidatePath("/sessions/new");
  revalidatePath("/settings");
  return { ok: true, data: { id: created.id, name: created.name } };
}

/**
 * Any user may introduce a new project / programme name from the session form.
 * The record is upserted (case-insensitive) so duplicates are merged silently.
 */
export async function createProjectAction(
  name: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  await requireUser();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const existing = await db.project.findFirst({
    where: { name: { equals: parsed.data, mode: "insensitive" } },
  });
  if (existing) return { ok: true, data: { id: existing.id, name: existing.name } };

  const count = await db.project.count();
  const created = await db.project.create({
    data: { name: parsed.data, sortOrder: count },
  });
  revalidatePath("/sessions/new");
  revalidatePath("/settings");
  return { ok: true, data: { id: created.id, name: created.name } };
}
