"use client";

import * as React from "react";
import {
  Users,
  Activity,
  X,
  Layers,
  Maximize2,
  Filter,
} from "lucide-react";
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

type BasemapStyle = "osm" | "esri-gray" | "esri-topo";

const BASEMAP_PROVIDERS: Record<
  BasemapStyle,
  {
    name: string;
    url: string;
    attribution: string;
    maxZoom: number;
    subdomains?: string;
  }
> = {
  osm: {
    name: "Standard Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: "abc",
  },
  "esri-gray": {
    name: "Clean Light",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  },
  "esri-topo": {
    name: "Topographic",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; DeLorme, TomTom, USGS',
    maxZoom: 18,
  },
};

/**
 * Interactive map using Leaflet. Must be loaded with next/dynamic + ssr:false
 * because Leaflet uses browser globals (window, navigator).
 */
export function MapView({
  markers,
  defaultCenter = [5.2, 9.8],
  defaultZoom = 8,
}: MapViewProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletMapRef = React.useRef<any>(null);
  const currentTileLayerRef = React.useRef<any>(null);
  const leafletModuleRef = React.useRef<any>(null);

  const [selected, setSelected] = React.useState<CommunityMarker | null>(null);
  const [ready, setReady] = React.useState(false);
  const [activeBasemap, setActiveBasemap] = React.useState<BasemapStyle>("osm");

  // Switch basemap layer dynamically
  const switchBasemap = (style: BasemapStyle) => {
    setActiveBasemap(style);
    if (!leafletMapRef.current || !leafletModuleRef.current) return;
    const L = leafletModuleRef.current;
    const map = leafletMapRef.current;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const cfg = BASEMAP_PROVIDERS[style];
    const newLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains || "abc",
    }).addTo(map);

    currentTileLayerRef.current = newLayer;
  };

  // Fit bounds to all markers
  const fitAllMarkers = () => {
    if (!leafletMapRef.current || markers.length === 0) return;
    const bounds = markers.map((m) => [m.lat, m.lng]);
    leafletMapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  };

  React.useEffect(() => {
    let destroyed = false;
    import("leaflet").then((L) => {
      if (destroyed || !mapRef.current) return;
      leafletModuleRef.current = L;

      // Fix marker icon paths
      // @ts-expect-error Leaflet internal
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: false, // will add custom position
      });

      // Add zoom control at bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Add default tile layer (OpenStreetMap - reliable, free, unwatermarked)
      const cfg = BASEMAP_PROVIDERS["osm"];
      const tile = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        subdomains: cfg.subdomains || "abc",
      }).addTo(map);
      currentTileLayerRef.current = tile;

      // Render circles sized by participant count
      const maxParticipants = Math.max(
        ...markers.map((m) => m.participants),
        1,
      );

      for (const marker of markers) {
        const radius = Math.max(
          7,
          8 + (marker.participants / maxParticipants) * 26,
        );
        const circle = L.circleMarker([marker.lat, marker.lng], {
          radius,
          fillColor: "#1CA3EC",
          fillOpacity: 0.75,
          color: "#0f769e",
          weight: 2,
        }).addTo(map);

        circle.on("click", () => {
          setSelected(marker);
        });

        circle.bindTooltip(
          `<div class="p-1">
            <strong style="color: #0c4a6e; font-size: 13px;">${marker.name}</strong>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              ${marker.participants.toLocaleString()} participants · ${marker.sessions} sessions
            </div>
            <div style="font-size: 10px; color: #64748b;">${marker.division} — ${marker.subdivision}</div>
          </div>`,
          { permanent: false, direction: "top", opacity: 0.95 },
        );
      }

      leafletMapRef.current = map;
      setReady(true);
    });

    return () => {
      destroyed = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex h-full min-h-[540px] overflow-hidden rounded-card border border-hairline shadow-sm">
      {/* Map canvas */}
      <div ref={mapRef} className="z-0 h-full w-full flex-1" />

      {/* Floating Controls Overlay (Top Right) */}
      <div className="absolute top-3 right-3 z-[400] flex flex-wrap items-center gap-1.5 rounded-control bg-white/95 p-1.5 shadow-lifted ring-1 ring-ink-200 backdrop-blur-sm">
        <div className="flex items-center gap-1 text-2xs font-semibold text-ink-500 uppercase px-1">
          <Layers className="size-3 text-blue-600" />
          <span className="hidden sm:inline">Map style:</span>
        </div>

        {(Object.keys(BASEMAP_PROVIDERS) as BasemapStyle[]).map((style) => {
          const active = activeBasemap === style;
          return (
            <button
              key={style}
              type="button"
              onClick={() => switchBasemap(style)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white font-semibold shadow-xs"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              {BASEMAP_PROVIDERS[style].name}
            </button>
          );
        })}

        <div className="h-4 w-px bg-ink-200 mx-0.5" />

        <button
          type="button"
          onClick={fitAllMarkers}
          title="Fit all communities in view"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-ink-700 hover:bg-ink-100 transition-colors"
        >
          <Maximize2 className="size-3 text-ink-500" />
          <span className="hidden sm:inline">Fit all</span>
        </button>
      </div>

      {/* Floating Community Scale Legend (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-[400] rounded-control bg-white/95 p-3 shadow-lifted ring-1 ring-ink-200 backdrop-blur-sm">
        <span className="block text-2xs font-bold tracking-wider text-ink-500 uppercase">
          Outreach Scale
        </span>
        <div className="mt-1.5 flex items-center gap-3 text-2xs text-ink-600">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500/80 ring-1 ring-blue-700" />
            <span>&lt;100 reach</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-blue-500/80 ring-1 ring-blue-700" />
            <span>100–500</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-4.5 rounded-full bg-blue-500/80 ring-1 ring-blue-700" />
            <span>500+</span>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-ink-400">
          {markers.length} communities with GPS records
        </p>
      </div>

      {!ready && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-3 text-ink-400">
            <div className="size-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm font-medium">Loading geospatial data…</p>
          </div>
        </div>
      )}

      {/* Flyout drawer */}
      {selected && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 z-[1000] w-80 sm:w-96 bg-white shadow-pop",
            "flex flex-col border-l border-hairline",
            "animate-in slide-in-from-right duration-200",
          )}
        >
          <div className="flex items-start justify-between border-b border-hairline p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {selected.division} — {selected.subdivision}
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink-900">
                {selected.name}
              </h3>
              <p className="text-xs text-ink-500">{selected.region} Region</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="rounded-control p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-tile border border-hairline bg-blue-50 p-3 text-center">
                <Users
                  className="mx-auto mb-1 size-4 text-blue-600"
                  aria-hidden
                />
                <p className="text-xl font-bold tabular text-blue-900">
                  {selected.participants.toLocaleString()}
                </p>
                <p className="text-2xs font-semibold text-blue-700 uppercase tracking-wider">
                  Participants
                </p>
              </div>
              <div className="rounded-tile border border-hairline bg-amber-50/70 p-3 text-center">
                <Activity
                  className="mx-auto mb-1 size-4 text-amber-600"
                  aria-hidden
                />
                <p className="text-xl font-bold tabular text-amber-900">
                  {selected.sessions.toLocaleString()}
                </p>
                <p className="text-2xs font-semibold text-amber-700 uppercase tracking-wider">
                  Sessions
                </p>
              </div>
            </div>

            {/* Gender split */}
            <div className="rounded-control bg-ink-50/50 p-3.5 ring-1 ring-ink-100">
              <p className="text-2xs font-bold text-ink-500 uppercase tracking-wider">
                Gender Breakdown
              </p>
              <div className="mt-2 flex gap-2 text-sm">
                <span className="flex-1 text-center">
                  <span className="font-bold text-blue-700">
                    {selected.male.toLocaleString()}
                  </span>
                  <span className="ml-1 text-xs text-ink-400">male</span>
                </span>
                <span className="flex-1 text-center">
                  <span className="font-bold text-amber-700">
                    {selected.female.toLocaleString()}
                  </span>
                  <span className="ml-1 text-xs text-ink-400">female</span>
                </span>
              </div>
              {/* Progress bar */}
              {selected.participants > 0 && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-200">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${Math.round((selected.male / selected.participants) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Active projects */}
            {selected.projects.length > 0 && (
              <div>
                <p className="text-2xs font-bold text-ink-500 uppercase tracking-wider mb-2">
                  Active Projects Deployed
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.projects.map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-2xs font-medium text-blue-800"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick filter action */}
          <div className="border-t border-hairline p-4 bg-ink-50/40">
            <a
              href={`/sessions?communityId=${selected.id}`}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-control",
                "bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-tile",
                "transition-colors hover:bg-blue-700",
              )}
            >
              <Filter className="size-3.5" aria-hidden />
              Filter sessions in {selected.name}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
