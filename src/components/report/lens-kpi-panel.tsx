"use client";

import * as React from "react";
import {
  Phone, Users, ShieldAlert, Heart,
  Activity, TrendingUp, TrendingDown, Minus, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MamaAggregate } from "@/lib/aggregate-mama";
import type { WhwAggregate } from "@/lib/aggregate-whw";
import type { FunderLens } from "@/lib/lens";

/* ------------------------------------------------------------------ */
/* MAMA panel                                                           */
/* ------------------------------------------------------------------ */

function MamaKpiCard({
  label, value, icon: Icon, note, tone = "blue",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  note?: string;
  tone?: "blue" | "gold" | "danger" | "success";
}) {
  const tones = {
    blue:    "bg-blue-50 text-blue-700 ring-blue-200/60",
    gold:    "bg-gold-50 text-gold-700 ring-gold-200/60",
    danger:  "bg-danger-50 text-danger-700 ring-danger-200/60",
    success: "bg-success-50 text-success-700 ring-success-200/60",
  };
  return (
    <div className="flex items-start gap-3 rounded-control border border-hairline bg-white p-3 shadow-tile">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", tones[tone])}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</p>
        <p className="mt-0.5 text-lg font-bold tabular text-ink-900">{value}</p>
        {note && <p className="mt-0.5 text-[11px] text-ink-400">{note}</p>}
      </div>
    </div>
  );
}

export function MamaKpiPanel({ data }: { data: MamaAggregate }) {
  const paseDisplay = data.meanPaseScore !== null
    ? `${data.meanPaseScore} / 25`
    : "—";
  const referralRate = data.gbvDisclosures > 0
    ? `${Math.round((data.gbvReferralsCompleted / data.gbvDisclosures) * 100)}%`
    : "—";

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        MAMA Network KPIs
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MamaKpiCard label="Hotline contacts" value={data.hotlineContacts} icon={Phone} tone="blue" />
        <MamaKpiCard label="Peer accompaniment" value={data.peerAccompanimentCases} icon={Users} tone="gold" />
        <MamaKpiCard label="Safe space outreaches" value={data.safeSpaceOutreaches} icon={Heart} tone="success" />
        <MamaKpiCard label="Mean PASE score" value={paseDisplay} icon={Activity} tone="blue"
          note="Autonomy scale (5–25)" />
        <MamaKpiCard label="GBV disclosures" value={data.gbvDisclosures} icon={ShieldAlert} tone="danger" />
        <MamaKpiCard label="GBV referral rate" value={referralRate} icon={TrendingUp} tone="success"
          note={`${data.gbvReferralsCompleted} completed`} />
      </div>
      {data.totalClinicalRecords === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-ink-400">
          <Info className="size-3.5" aria-hidden />
          No clinical telemetry recorded for this period — PASE and GBV metrics will show when data is entered.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WHW panel                                                            */
/* ------------------------------------------------------------------ */

function BenchmarkRow({
  label, actual, benchmark, higherIsBetter = true,
}: {
  label: string;
  actual: number | null;
  benchmark: number;
  higherIsBetter?: boolean;
}) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const delta = actual !== null ? actual - benchmark : null;
  const isGood = delta !== null
    ? (higherIsBetter ? delta >= 0 : delta <= 0)
    : null;

  const Icon = delta === null || Math.abs(delta) < 0.005
    ? Minus
    : isGood ? TrendingUp : TrendingDown;

  const tone = delta === null ? "text-ink-400"
    : isGood ? "text-success-700" : "text-danger-700";

  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-hairline last:border-0">
      <p className="text-sm text-ink-700">{label}</p>
      <div className="flex items-center gap-2 tabular">
        <span className="text-sm font-semibold text-ink-900">
          {actual !== null ? pct(actual) : "—"}
        </span>
        <span className="text-xs text-ink-400">vs {pct(benchmark)} target</span>
        <span className={cn("flex items-center gap-0.5 text-xs font-semibold", tone)}>
          <Icon className="size-3.5" aria-hidden />
          {delta !== null ? pct(Math.abs(delta)) : ""}
        </span>
      </div>
    </div>
  );
}

export function WhwKpiPanel({ data }: { data: WhwAggregate }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        Women Help Women KPIs
      </p>
      <div className="grid grid-cols-2 gap-2">
        <MamaKpiCard label="Telecounseling sessions" value={data.telecounselingReach}
          icon={Phone} tone="blue" />
        <MamaKpiCard label="Outcomes recorded" value={data.outcomesRecorded}
          icon={Activity} tone="gold" />
      </div>
      <div className="rounded-control border border-hairline bg-white p-4 shadow-tile">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          Benchmark tracking
        </p>
        <BenchmarkRow
          label="Client satisfaction (Very Satisfied + Satisfied)"
          actual={data.satisfactionPct}
          benchmark={data.benchmarks.satisfactionPct}
          higherIsBetter
        />
        <BenchmarkRow
          label="Additional medical care sought"
          actual={data.additionalCarePct}
          benchmark={data.benchmarks.additionalCarePct}
          higherIsBetter={false}
        />
      </div>
      {data.outcomesRecorded === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-ink-400">
          <Info className="size-3.5" aria-hidden />
          No WHW clinical records for this period.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lens KPI panel — rendered inside the report builder                 */
/* ------------------------------------------------------------------ */

export function LensKpiPanel({
  lens,
  mama,
  whw,
}: {
  lens: FunderLens;
  mama?: MamaAggregate | null;
  whw?: WhwAggregate | null;
}) {
  if (lens === "mama" && mama) return <MamaKpiPanel data={mama} />;
  if (lens === "whw" && whw) return <WhwKpiPanel data={whw} />;

  return null;
}