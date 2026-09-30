"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { FunderLens } from "@/lib/lens";
import { LENSES } from "@/lib/lens";

export function LensSwitcher({ activeLens }: { activeLens: FunderLens }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setLens(slug: FunderLens) {
    const next = new URLSearchParams(params.toString());
    if (slug === "viac") {
      next.delete("lens");
    } else {
      next.set("lens", slug);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div
      role="group"
      aria-label="Reporting lens"
      className="inline-flex items-center rounded-control border border-hairline bg-white p-0.5 shadow-tile"
    >
      {LENSES.map((lens, i) => {
        const isActive = activeLens === lens.slug;
        return (
          <button
            key={lens.slug}
            onClick={() => setLens(lens.slug)}
            title={lens.description}
            aria-pressed={isActive}
            className={cn(
              "relative px-3 py-1.5 text-xs font-semibold transition-all duration-200",
              i === 0 ? "rounded-l-[7px]" : i === LENSES.length - 1 ? "rounded-r-[7px]" : "",
              isActive
                ? "bg-blue-500 text-white shadow-sm"
                : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
            )}
          >
            {lens.label}
          </button>
        );
      })}
    </div>
  );
}
