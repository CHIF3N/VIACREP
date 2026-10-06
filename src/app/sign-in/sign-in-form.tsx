"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import type { Role } from "@prisma/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/badge";
import { ROLE_LABEL_BY_ROLE } from "@/lib/role-labels";
import { signIn, type SignInState } from "./actions";

const DEMO_PASSWORD = "viac2026";

type Account = {
  name: string;
  email: string;
  role: Role;
  designation: string | null;
};

export function SignInForm({ accounts }: { accounts: Account[] }) {
  const [state] = useActionState<SignInState, FormData>(signIn, {});
  const [email, setEmail] = React.useState(accounts[0]?.email ?? "");
  const [password, setPassword] = React.useState(DEMO_PASSWORD);
  const [reveal, setReveal] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          data.error || "That email and password don't match an account.",
        );
        setLoading(false);
        return;
      }
      window.location.href = data.redirect || "/dashboard";
    } catch {
      setErrorMsg("Network error — please try again.");
      setLoading(false);
    }
  }

  const displayedError = errorMsg || state.error;

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Email address" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@viacame.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(displayedError)}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={Boolean(displayedError)}
              className="pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600"
            >
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {displayedError && (
          <p className="flex items-start gap-2 rounded-control bg-danger-50 px-3.5 py-2.5 text-[13px] leading-5 text-danger-700 ring-1 ring-inset ring-danger-500/15">
            <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
            {displayedError}
          </p>
        )}

        <SubmitButton loading={loading} />
      </form>

      {accounts.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-200" />
            <span className="text-2xs font-medium tracking-[0.12em] text-ink-400 uppercase">
              Demo accounts
            </span>
            <span className="h-px flex-1 bg-ink-200" />
          </div>

          <div className="mt-4 space-y-2">
            {accounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="group flex w-full items-center gap-3 rounded-tile bg-white px-3 py-2.5 text-left ring-1 ring-ink-200/70 transition-all duration-150 hover:shadow-tile hover:ring-blue-300"
              >
                <Avatar name={a.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">
                    {a.name}
                  </span>
                  <span className="block truncate text-2xs text-ink-500">
                    {a.email}
                  </span>
                </span>
                <Badge tone={a.role === "OFFICER" ? "blue" : "gold"}>
                  {ROLE_LABEL_BY_ROLE[a.role]}
                </Badge>
              </button>
            ))}
          </div>
          <p className="mt-3 text-2xs text-ink-400">
            Every demo account uses the password{" "}
            <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-ink-700">
              {DEMO_PASSWORD}
            </code>
            .
          </p>
        </div>
      )}
    </>
  );
}

function SubmitButton({ loading }: { loading?: boolean }) {
  const { pending } = useFormStatus();
  const isSubmitting = loading || pending;
  return (
    <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
      {isSubmitting ? "Signing in…" : "Sign in"}
      {!isSubmitting && <ArrowRight className="size-4" aria-hidden />}
    </Button>
  );
}
