"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartTooltip,
  GRID,
  Legend,
  ORDINAL_BLUE,
  SERIES,
  axisProps,
} from "./chart-kit";
import { formatNumber, formatPercent } from "@/lib/utils";

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);

/* -------------------------------------------------------------------------- */
/* Participants over time                                                      */
/* -------------------------------------------------------------------------- */

export function ParticipantsOverTime({
  data,
  height = 260,
}: {
  data: { label: string; participants: number; sessions: number }[];
  height?: number;
}) {
  if (data.length === 0) return <NoData height={height} />;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="participantsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.primary} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES.primary} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} dy={6} />
          <YAxis {...axisProps} width={48} tickFormatter={compact} />
          <Tooltip
            cursor={{ stroke: SERIES.primary, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={<ChartTooltip />}
          />
          <Area
            type="monotone"
            dataKey="participants"
            name="Participants"
            stroke={SERIES.primary}
            strokeWidth={2.5}
            fill="url(#participantsFill)"
            dot={{ r: 3, fill: "#fff", stroke: SERIES.primary, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: SERIES.primary, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sessions over time                                                          */
/* -------------------------------------------------------------------------- */

export function SessionsOverTime({
  data,
  height = 200,
}: {
  data: { label: string; sessions: number }[];
  height?: number;
}) {
  if (data.length === 0) return <NoData height={height} />;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} dy={6} />
          <YAxis {...axisProps} width={44} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(17,138,185,0.06)" }}
            content={<ChartTooltip valueLabel="sessions" />}
          />
          <Bar
            dataKey="sessions"
            name="Sessions"
            fill={SERIES.accent}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Gender split                                                                */
/* -------------------------------------------------------------------------- */

export function GenderSplit({
  male,
  female,
  height = 220,
}: {
  male: number;
  female: number;
  height?: number;
}) {
  const total = male + female;
  if (total === 0) return <NoData height={height} />;

  const data = [
    { name: "Male", value: male, color: SERIES.primary },
    { name: "Female", value: female, color: SERIES.accent },
  ];

  return (
    <div>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] leading-none font-semibold tracking-[-0.03em] text-ink-900">
            {formatNumber(total)}
          </span>
          <span className="mt-1 text-2xs text-ink-400">participants</span>
        </div>
      </div>

      {/* Direct labels: identity never rests on colour alone. */}
      <ul className="mt-2 space-y-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: d.color }}
              aria-hidden
            />
            <span className="flex-1 text-[13px] text-ink-600">{d.name}</span>
            <span className="text-[13px] font-semibold text-ink-900 tabular">
              {formatNumber(d.value)}
            </span>
            <span className="w-10 text-right text-2xs text-ink-400 tabular">
              {formatPercent(d.value / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Key populations — stacked by sex                                            */
/* -------------------------------------------------------------------------- */

export function KeyPopulationChart({
  data,
  height = 300,
}: {
  data: { shortName: string; male: number; female: number; total: number }[];
  height?: number;
}) {
  if (data.length === 0) return <NoData height={height} />;

  return (
    <div>
      <Legend
        className="mb-3"
        items={[
          { label: "Male", color: SERIES.primary },
          { label: "Female", color: SERIES.accent },
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 8 }}
            barCategoryGap="26%"
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" {...axisProps} tickFormatter={compact} />
            <YAxis
              type="category"
              dataKey="shortName"
              {...axisProps}
              width={112}
              tick={{ fill: "#4F5254", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(17,138,185,0.06)" }}
              content={<ChartTooltip />}
            />
            {/* 2px surface gap between stacked segments keeps them readable. */}
            <Bar
              dataKey="male"
              name="Male"
              stackId="sex"
              fill={SERIES.primary}
              radius={[3, 0, 0, 3]}
              stroke="#fff"
              strokeWidth={2}
            />
            <Bar
              dataKey="female"
              name="Female"
              stackId="sex"
              fill={SERIES.accent}
              radius={[0, 3, 3, 0]}
              stroke="#fff"
              strokeWidth={2}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Age groups — ordered bands, so a single-hue ramp, not categorical colours    */
/* -------------------------------------------------------------------------- */

export function AgeGroupChart({
  data,
  height = 200,
}: {
  data: { name: string; participants: number }[];
  height?: number;
}) {
  if (data.length === 0) return <NoData height={height} />;
  const total = data.reduce((sum, d) => sum + d.participants, 0);

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" {...axisProps} dy={6} />
            <YAxis {...axisProps} width={44} tickFormatter={compact} />
            <Tooltip
              cursor={{ fill: "rgba(17,138,185,0.06)" }}
              content={<ChartTooltip total={total} />}
            />
            <Bar dataKey="participants" name="Participants" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={ORDINAL_BLUE[Math.min(i + 1, ORDINAL_BLUE.length - 1)]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-2xs text-ink-400">
        Shaded light to dark from youngest to oldest.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function NoData({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-tile bg-ink-50/60"
      style={{ height }}
    >
      <p className="text-[13px] text-ink-400">No data in this period</p>
    </div>
  );
}

export { ActivityIntensityHeatmap } from "./activity-intensity-heatmap";
