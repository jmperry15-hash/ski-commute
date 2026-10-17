// The shape of the JSON our /api/commute endpoint sends back to the browser.
// Shared by the server (which builds it) and the dashboard (which displays it).

export type ResortCommute = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  ok: boolean; // false if Google couldn't find a driving route
  durationSec: number; // drive time WITH current traffic
  staticDurationSec: number; // "normal" drive time with no traffic
  delaySec: number; // durationSec - staticDurationSec (never negative)
  distanceMeters: number;
};

export type CommuteResponse = {
  origin: { address: string; lat: number; lng: number };
  results: ResortCommute[]; // already sorted, fastest first
  fetchedAt: string; // ISO timestamp of when Google was actually called
  demo: boolean; // true when no API key is configured and sample data is shown
};
