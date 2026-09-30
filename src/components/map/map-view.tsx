"use client";

import * as React from "react";
import { MapPin, Users, Activity, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CommunityMarker = {
  id: string;
  name: string;
  subdivision: string;
  division: string;
  region: string;
  lat: number;
  lng: number;
  participants: number;
  sessions: number;
  male: number;
  female: number;
  projects: string[];
};

export type MapViewProps = {
  markers: CommunityMarker[];
  defaultCenter?: [number, number];
  defaultZoom?: number;
};

/**
 * Interactive map using Leaflet. Must be loaded with next/dynamic + ssr:false
 * because Leaflet uses browser globals (window, navigator).
 */
export function MapView({
  markers,
  defaultCenter = [4.8, 9.8],
  defaultZoom = 8,
}: MapViewProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletRef = React.useRef<unknown>(null);
  const [selected, setSelected] = React.useState<CommunityMarker | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // Dynamic import to avoid SSR
    let destroyed = false;
    import("leaflet").then((L) => {
      if (destroyed || !mapRef.current) return;

      // Fix marker icon paths (Leaflet webpack issue)
      // @ts-expect-error Leaflet internal
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
      });

      // CartoDB light tiles (no API key required)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
          subdomains: "abcd",
          maxZoom: 19,
        },
      ).addTo(map);

      // Render circles sized by participant count
      const maxParticipants = Math.max(...markers.map((m) => m.participants), 1);

      for (const marker of markers) {
        const radius = 8 + (marker.participants / maxParticipants) * 28;
        const circle = L.circleMarker([marker.lat, marker.lng], {
          radius,
          fillColor: "#1CA3EC",
          fillOpacity: 0.75,
          color: "#118ab9",
          weight: 1.5,
        }).addTo(map);

        circle.on("click", () => {
          setSelected(marker);
        });

        circle.bindTooltip(
          `<strong>${marker.name}</strong><br/>${marker.participants.toLocaleString()} participants`,
          { permanent: false, direction: "top" },
        );
      }

      leafletRef.current = map;
      setReady(true);
    });

    return () => {
      destroyed = true;
      if (leafletRef.current) {
        // @ts-expect-error Leaflet internal
        leafletRef.current.remove();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex h-full min-h-[540px] overflow-hidden rounded-card border border-hairline">
      {/* Map canvas */}
      <div ref={mapRef} className="flex-1" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-3 text-ink-400">
            <div className="size-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm">Loading map…</p>
          </div>
        </div>
      )}

      {/* Flyout drawer */}
      {selected && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 z-[1000] w-80 bg-white shadow-pop",
            "flex flex-col border-l border-hairline",
            "animate-rise",
          )}
        >
          <div className="flex items-start justify-between border-b border-hairline p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                {selected.division} — {selected.subdivision}
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink-900">
                {selected.name}
              </h3>
              <p className="text-xs text-ink-400">{selected.region} Region</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="rounded-control p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-tile border border-hairline bg-blue-50 p-3 text-center">
                <Users className="mx-auto mb-1 size-4 text-blue-600" aria-hidden />
                <p className="text-xl font-bold tabular text-blue-900">
                  {selected.participants.toLocaleString()}
                </p>
                <p className="text-2xs text-blue-600">Participants</p>
              </div>
              <div className="rounded-tile border border-hairline bg-gold-50 p-3 text-center">
                <Activity className="mx-auto mb-1 size-4 text-gold-600" aria-hidden />
                <p className="text-xl font-bold tabular text-gold-900">
                  {selected.sessions.toLocaleString()}
                </p>
                <p className="text-2xs text-gold-600">Sessions</p>
              </div>
            </div>

            {/* Gender split */}
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold text-ink-500 uppercase tracking-wide">
                Gender split
              </p>
              <div className="flex gap-2 text-sm">
                <span className="flex-1 text-center">
                  <span className="font-bold text-blue-700">{selected.male.toLocaleString()}</span>
                  <span className="ml-1 text-ink-400">male</span>
                </span>
                <span className="flex-1 text-center">
                  <span className="font-bold text-gold-700">{selected.female.toLocaleString()}</span>
                  <span className="ml-1 text-ink-400">female</span>
                </span>
              </div>
              {/* Progress bar */}
              {selected.participants > 0 && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{
                      width: `${Math.round((selected.male / selected.participants) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Active projects */}
            {selected.projects.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-ink-500 uppercase tracking-wide">
                  Active projects
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.projects.map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-2xs font-medium text-blue-700"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick filter action */}
          <div className="border-t border-hairline p-4">
            <a
              href={`/sessions?communityId=${selected.id}`}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-control",
                "bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white",
                "transition-colors hover:bg-blue-600",
              )}
            >
              <MapPin className="size-4" aria-hidden />
              Filter platform by {selected.name}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
