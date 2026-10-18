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
