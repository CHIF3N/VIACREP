/**
 * Funder Lens Engine
 *
 * The lens is a thin abstraction over the funder/donor dimension.
 * Selecting a lens changes which KPIs the dashboard shows, which
 * report template is pre-selected, and which indicator definitions
 * are used when computing benchmarks.
 *
 * The lens value travels as a URL search param: ?lens=mama
 * It never affects which sessions are visible — RBAC still controls
 * that. It only changes what we *compute* from the visible set.
 */

export type FunderLens = "viac" | "mama" | "whw";

export const LENSES: { slug: FunderLens; label: string; description: string }[] = [
  {
    slug: "viac",
    label: "Universal VIAC",
    description: "Standard outreach & key-population tracking",
  },
  {
    slug: "mama",
    label: "MAMA Network",
    description: "SMA accompaniment, hotlines & PASE autonomy",
  },
  {
    slug: "whw",
    label: "Women Help Women",
    description: "Telehealth, clinical outcomes & satisfaction",
  },
];

export function parseLens(value: string | string[] | undefined): FunderLens {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "mama" || v === "whw") return v;
  return "viac";
}
