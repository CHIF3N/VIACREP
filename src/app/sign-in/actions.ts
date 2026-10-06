"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, verifyCredentials } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address"),
  password: z.string().min(1, "Enter your password"),
});

export type SignInState = { error?: string };

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return { error: "That email and password don't match an account." };
  }

  const token = await createSession(user.id);
  redirect(`/dashboard?auth=${encodeURIComponent(token)}`);
}
