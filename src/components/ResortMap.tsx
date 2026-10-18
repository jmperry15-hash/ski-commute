"use client";
// Interactive Google Map showing home + every resort.
// Uses the BROWSER key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), which is safe to expose
// because in Google Cloud you lock it to your website's URL and to the Maps APIs only.
// The <APIProvider> that loads Google's script lives in Dashboard.tsx (the address box uses it too).
import { useEffect } from "react";
import { AdvancedMarker, ColorScheme, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { BROWSER_KEY } from "@/lib/config";
import { formatDuration } from "@/lib/format";

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
};

export default function ResortMap({ origin, resorts, selectedId, onSelect }: Props) {
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

  return (
    <GoogleMap
      className="map"
      mapId="DEMO_MAP_ID" // required for AdvancedMarker; free to use
      colorScheme={ColorScheme.LIGHT}
      defaultCenter={{ lat: 39.7, lng: -106.1 }}
      defaultZoom={8}
      gestureHandling="cooperative" // on phones: two fingers to pan, so the page still scrolls
      disableDefaultUI
      zoomControl
    >
      {origin && (
        <AdvancedMarker position={origin} title="Home" zIndex={1000}>
          <div className="pin-home">⌂</div>
        </AdvancedMarker>
      )}
      {resorts.map((r) => (
        <AdvancedMarker
          key={r.id}
          position={{ lat: r.lat, lng: r.lng }}
          title={r.name}
          zIndex={r.id === selectedId ? 999 : 100 - (r.rank ?? 50)}
          onClick={() => onSelect(r.id)}
        >
          <div className={`pin ${r.id === selectedId ? "pin-selected" : ""}`}>
            {r.rank && <span className="pin-rank">{r.rank}</span>}
            {/* Names only on the selected pin; the I-70 resorts are too close together to label them all. */}
            {(r.id === selectedId || !r.rank) && <span>{r.name}</span>}
            {r.durationSec ? <span className="pin-time">{formatDuration(r.durationSec)}</span> : null}
          </div>
        </AdvancedMarker>
      ))}
      <FitAndFocus origin={origin} resorts={resorts} selectedId={selectedId} />
    </GoogleMap>
  );
}

// Helper that moves the camera: zooms to fit everything when home changes,
// and glides to a resort when you tap its card.
function FitAndFocus({ origin, resorts, selectedId }: Omit<Props, "onSelect">) {
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
    if (!map || !selectedId) return;
    const r = resorts.find((x) => x.id === selectedId);
    if (r) map.panTo({ lat: r.lat, lng: r.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedId]);

  return null;
}
