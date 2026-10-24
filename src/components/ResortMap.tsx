"use client";
// Interactive Google Map showing home + every resort.
// Uses the BROWSER key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), which is safe to expose
// because in Google Cloud you lock it to your website's URL and to the Maps APIs only.
// The <APIProvider> that loads Google's script lives in Dashboard.tsx (the address box uses it too).
import { useEffect } from "react";
import { AdvancedMarker, ColorScheme, Map as GoogleMap, Polyline, useMap } from "@vis.gl/react-google-maps";
import { BROWSER_KEY } from "@/lib/config";
import { formatDuration, formatMiles } from "@/lib/format";
import type { TrafficRoute, TrafficSpeed } from "@/lib/types";

// Route line colors, like Google Maps: blue = moving normally, orange = slow, red = jammed.
const SPEED_COLORS: Record<TrafficSpeed, string> = {
  NORMAL: "#38bdf8",
  SLOW: "#fb923c",
  TRAFFIC_JAM: "#ef4444",
};

export type RouteState =
  | { status: "idle" }
  | { status: "loading"; resortName: string }
  | { status: "error"; message: string }
  | { status: "ready"; resortName: string; route: TrafficRoute };

export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  durationSec?: number;
  rank?: number;
};

type Props = {
  origin?: { lat: number; lng: number };
  resorts: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  routeState: RouteState;
};

export default function ResortMap({ origin, resorts, selectedId, onSelect, routeState }: Props) {
  if (!BROWSER_KEY) {
    return (
      <div className="map-placeholder">
        <div className="empty-icon">🗺️</div>
        <p>Map is off until you add a browser key.</p>
        <p className="muted">
          Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> (see README).
        </p>
      </div>
    );
  }

  const route = routeState.status === "ready" ? routeState.route : null;
  // While a route is showing, shrink the other resorts to small dots so they don't cover the line.
  const routeMode = routeState.status === "ready" || routeState.status === "loading";

  return (
    <>
      <GoogleMap
        className="map"
        mapId="DEMO_MAP_ID" // required for AdvancedMarker; free to use
        colorScheme={ColorScheme.DARK}
        defaultCenter={{ lat: 39.7, lng: -106.1 }}
        defaultZoom={8}
        gestureHandling="cooperative" // on phones: two fingers to pan, so the page still scrolls
        disableDefaultUI
        zoomControl
        isFractionalZoomEnabled // lets "fit the route" zoom in-between levels for a snug fit
      >
        {origin && (
          <AdvancedMarker position={origin} title="Home" zIndex={1000}>
            <div className="pin-home">⌂</div>
          </AdvancedMarker>
        )}
        {resorts.map((r) => {
          const compact = routeMode && r.id !== selectedId;
          return (
            <AdvancedMarker
              key={r.id}
              position={{ lat: r.lat, lng: r.lng }}
              title={r.name}
              zIndex={r.id === selectedId ? 999 : 100 - (r.rank ?? 50)}
              onClick={() => onSelect(r.id)}
            >
              {compact ? (
                <div className="pin-dot">{r.rank}</div>
              ) : (
                <div className={`pin ${r.id === selectedId ? "pin-selected" : ""}`}>
                  {r.rank && <span className="pin-rank">{r.rank}</span>}
                  {/* Names only on the selected pin; the I-70 resorts are too close together to label them all. */}
                  {(r.id === selectedId || !r.rank) && <span>{r.name}</span>}
                  {r.durationSec ? <span className="pin-time">{formatDuration(r.durationSec)}</span> : null}
                </div>
              )}
            </AdvancedMarker>
          );
        })}
        {route && <TrafficLine route={route} />}
        <FitAndFocus
          origin={origin}
          resorts={resorts}
          selectedId={selectedId}
          route={route}
          routeComing={routeState.status === "loading"}
        />
      </GoogleMap>
      {origin && <RoutePanel state={routeState} />}
    </>
  );
}

// The route: a dark outline underneath, then each stretch of road in its traffic color.
function TrafficLine({ route }: { route: TrafficRoute }) {
  const fullPath = route.segments.flatMap((s) => s.path);
  return (
    <>
      <Polyline
        path={fullPath}
        strokeColor="#030712"
        strokeOpacity={0.85}
        strokeWeight={9}
        zIndex={1}
        clickable={false}
      />
      {route.segments.map((seg, i) => (
        <Polyline
          key={i}
          path={seg.path}
          strokeColor={SPEED_COLORS[seg.speed]}
          strokeOpacity={1}
          strokeWeight={5}
          zIndex={2}
          clickable={false}
        />
      ))}
    </>
  );
}

// Small panel in the corner of the map: what's showing, plus a color legend.
function RoutePanel({ state }: { state: RouteState }) {
  let body: React.ReactNode;
  if (state.status === "idle") {
    body = <span className="route-hint">Tap a resort to see its route with live traffic</span>;
  } else if (state.status === "loading") {
    body = <span className="route-hint">Loading route to {state.resortName}…</span>;
  } else if (state.status === "error") {
    body = <span className="route-hint route-error">{state.message}</span>;
  } else {
    const slow = state.route.segments.filter((s) => s.speed !== "NORMAL").length;
    body = (
      <>
        <div className="route-title">
          Route to {state.resortName}
          <span className="route-meta">
            {formatDuration(state.route.durationSec)} · {formatMiles(state.route.distanceMeters)}
          </span>
        </div>
        <div className="route-summary">
          {slow === 0 ? "No slowdowns on this route" : `${slow} slow stretch${slow === 1 ? "" : "es"} on this route`}
        </div>
        <div className="route-legend">
          <span>
            <i style={{ background: SPEED_COLORS.NORMAL }} /> Normal
          </span>
          <span>
            <i style={{ background: SPEED_COLORS.SLOW }} /> Slow
          </span>
          <span>
            <i style={{ background: SPEED_COLORS.TRAFFIC_JAM }} /> Jammed
          </span>
        </div>
      </>
    );
  }
  return (
    <div className="route-panel" role="status">
      {body}
    </div>
  );
}

// Helper that moves the camera: zooms to fit everything when home changes,
// glides to a resort when you tap its card, and frames the route once it loads.
function FitAndFocus({
  origin,
  resorts,
  selectedId,
  route,
  routeComing,
}: Omit<Props, "onSelect" | "routeState"> & { route: TrafficRoute | null; routeComing: boolean }) {
  const map = useMap();

  // Only refit when the home location changes, not on every refresh.
  useEffect(() => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    resorts.forEach((r) => bounds.extend({ lat: r.lat, lng: r.lng }));
    if (origin) bounds.extend(origin);
    const padding = { top: 40, right: 16, bottom: 16, left: 16 }; // extra top room for the pin labels
    map.fitBounds(bounds, padding);
    // A brand-new map can overwrite that with its starting view, so fit again once it's ready.
    const listener = google.maps.event.addListenerOnce(map, "idle", () => map.fitBounds(bounds, padding));
    return () => listener.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, origin?.lat, origin?.lng]);

  useEffect(() => {
    if (!map || !selectedId || routeComing || route) return; // the route will frame the map itself
    const r = resorts.find((x) => x.id === selectedId);
    if (r) map.panTo({ lat: r.lat, lng: r.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedId]);

  useEffect(() => {
    if (!map || !route) return;
    const bounds = new google.maps.LatLngBounds();
    route.segments.forEach((s) => s.path.forEach((p) => bounds.extend(p)));
    // extra bottom padding leaves room for the route panel
    map.fitBounds(bounds, { top: 48, right: 72, bottom: 120, left: 72 }); // room for pin labels + panel
  }, [map, route]);

  return null;
}
