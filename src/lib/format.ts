// Small helpers for turning raw numbers into readable text.

export function formatDuration(totalSec: number) {
  const mins = Math.round(totalSec / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function formatMiles(meters: number) {
  return `${Math.round(meters / 1609.34)} mi`;
}

// Traffic delay → a ski-trail rating: green circle (light), blue square (moderate), black diamond (heavy).
export function delayLevel(delaySec: number) {
  const mins = delaySec / 60;
  if (mins < 5) return { label: "Light", tone: "green" } as const;
  if (mins < 15) return { label: "Moderate", tone: "blue" } as const;
  return { label: "Heavy", tone: "black" } as const;
}

export function timeAgo(iso: string, now: number) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// How many miles of a route are slow or jammed, from Google's road-speed data.
// (This is what the colored route line shows — actual congestion on the road.)
export function congestedMiles(route: { segments: { speed: string; path: { lat: number; lng: number }[] }[] }) {
  let slow = 0;
  let jammed = 0;
  for (const seg of route.segments) {
    if (seg.speed === "NORMAL") continue;
    let meters = 0;
    for (let i = 1; i < seg.path.length; i++) meters += distanceMeters(seg.path[i - 1], seg.path[i]);
    if (seg.speed === "TRAFFIC_JAM") jammed += meters;
    else slow += meters;
  }
  return { slowMi: slow / 1609.34, jammedMi: jammed / 1609.34 };
}

// Straight-line distance between two points on Earth (haversine formula).
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "4.2 mi slow · 0.6 mi jammed" (or null when the route is moving normally).
export function congestionText(c: { slowMi: number; jammedMi: number }) {
  const parts: string[] = [];
  if (c.slowMi >= 0.1) parts.push(`${c.slowMi.toFixed(1)} mi slow`);
  if (c.jammedMi >= 0.1) parts.push(`${c.jammedMi.toFixed(1)} mi jammed`);
  return parts.length ? parts.join(" · ") : null;
}
