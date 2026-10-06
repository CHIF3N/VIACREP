"use client";

import * as React from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import type { Role } from "@prisma/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/badge";
import { ROLE_LABEL_BY_ROLE } from "@/lib/role-labels";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = "viac2026";

type Account = {
  name: string;
  email: string;
  role: Role;
  designation: string | null;
};

export function SignInForm({ accounts }: { accounts: Account[] }) {
  const [email, setEmail] = React.useState(accounts[0]?.email ?? "");
  const [password, setPassword] = React.useState(DEMO_PASSWORD);
  const [reveal, setReveal] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [activeSigningEmail, setActiveSigningEmail] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Check if token exists in localStorage from earlier session
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("viac_session");
      if (stored && document.cookie.indexOf("viac_session") === -1) {
        document.cookie = `viac_session=${stored}; path=/; SameSite=None; Secure; Partitioned; max-age=604800`;
      }
    } catch {
      // ignore
    }
  }, []);

  async function performLogin(targetEmail: string, targetPass: string) {
    setLoading(true);
    setActiveSigningEmail(targetEmail);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          data.error || "That email and password don't match an account.",
        );
        setLoading(false);
        setActiveSigningEmail(null);
        return;
      }

      // Save token in client-accessible storage for resilient iframe persistence
      if (data.token) {
        try {
          localStorage.setItem("viac_session", data.token);
          document.cookie = `viac_session=${data.token}; path=/; SameSite=None; Secure; Partitioned; max-age=604800`;
        } catch {
          // ignore
        }
      }

      // Navigate to dashboard carrying auth token for iframe compatibility
      const targetUrl = data.token
        ? `/dashboard?auth=${encodeURIComponent(data.token)}`
        : data.redirect || "/dashboard";

      window.location.href = targetUrl;
    } catch (err) {
      console.error("Sign-in request error:", err);
      setErrorMsg("Network error — please try again.");
      setLoading(false);
      setActiveSigningEmail(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    performLogin(email, password);
  }

  return (
    <>
      <form
        action="/api/auth/sign-in"
        method="post"
        onSubmit={handleSubmit}
        className="mt-8 space-y-4"
      >
        <Field label="Email address" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@viacame.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(errorMsg)}
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
              invalid={Boolean(errorMsg)}
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

        {errorMsg && (
          <p className="flex items-start gap-2 rounded-control bg-danger-50 px-3.5 py-2.5 text-[13px] leading-5 text-danger-700 ring-1 ring-inset ring-danger-500/15">
            <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
            {errorMsg}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          loading={loading && !activeSigningEmail}
          className="w-full"
        >
          {loading && !activeSigningEmail ? "Signing in…" : "Sign in"}
          {!loading && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>

      {accounts.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-200" />
            <span className="text-2xs font-medium tracking-[0.12em] text-ink-400 uppercase">
              One-tap demo accounts
            </span>
            <span className="h-px flex-1 bg-ink-200" />
          </div>

          <div className="mt-4 space-y-2">
            {accounts.map((a) => {
              const isSelected = email === a.email;
              const isSigningInThis = activeSigningEmail === a.email;

              return (
                <div
                  key={a.email}
                  className={cn(
                    "group flex w-full items-center justify-between gap-3 rounded-tile bg-white p-3 ring-1 transition-all duration-150",
                    isSelected
                      ? "ring-2 ring-blue-500 shadow-sm"
                      : "ring-ink-200/70 hover:shadow-tile hover:ring-blue-300",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(DEMO_PASSWORD);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    title="Click to select this account"
                  >
                    <Avatar name={a.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-ink-900 group-hover:text-blue-700 transition-colors">
                          {a.name}
                        </span>
                        <Badge tone={a.role === "OFFICER" ? "blue" : "gold"}>
                          {ROLE_LABEL_BY_ROLE[a.role]}
                        </Badge>
                      </div>
                      <span className="block truncate text-2xs text-ink-500">
                        {a.email} {a.designation ? `· ${a.designation}` : ""}
                      </span>
                    </div>
                  </button>

                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "primary" : "secondary"}
                    loading={isSigningInThis}
                    onClick={() => performLogin(a.email, DEMO_PASSWORD)}
                    className="shrink-0 text-xs px-2.5 py-1.5 h-8"
                  >
                    {isSigningInThis ? (
                      "Signing in…"
                    ) : (
                      <>
                        <span>Sign in</span>
                        <ArrowRight className="size-3" />
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-2xs text-ink-400">
            Password for every demo account is{" "}
            <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-ink-700">
              {DEMO_PASSWORD}
            </code>
            . Tap &ldquo;Sign in&rdquo; on any account to enter immediately.
          </p>
        </div>
      )}
    </>
  );
}
