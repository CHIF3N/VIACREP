"use client";
// This wrapper exists because `next/dynamic` with `ssr: false` must be
// called from a Client Component in Next.js 16+.
import dynamic from "next/dynamic";
import type { MapViewProps } from "@/components/map/map-view";

const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-card border border-hairline bg-white">
        <div className="flex flex-col items-center gap-3 text-ink-400">
          <div className="size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm">Loading map...</p>
        </div>
      </div>
    ),
  },
);

export function MapViewClient(props: MapViewProps) {
  return <MapView {...props} />;
}