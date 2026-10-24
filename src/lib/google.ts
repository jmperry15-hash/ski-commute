// Server-only code that talks to Google. The "server-only" import makes the build
// fail if this file is ever imported into browser code, so the API key can't leak.
import "server-only";
import { RESORTS } from "./resorts";
import type { ResortCommute, RouteSegment, TrafficSpeed } from "./types";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ROUTE_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

export class GoogleApiError extends Error {
  constructor(message: string, public httpStatus = 502) {
    super(message);
  }
}

// Step 1: turn "123 Main St, Denver" into a latitude/longitude (Geocoding API).
export async function geocodeAddress(address: string, apiKey: string) {
  const url = `${GEOCODE_URL}?${new URLSearchParams({ address, components: "country:US", key: apiKey })}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  if (data.status === "ZERO_RESULTS") {
    throw new GoogleApiError("Couldn't find that address. Try adding a city and zip code.", 404);
  }
  if (data.status !== "OK") {
    console.error("Geocoding API error:", data.status, data.error_message);
    throw new GoogleApiError(`Geocoding failed (${data.status}). Check that the Geocoding API is enabled for your key.`);
  }

  const top = data.results[0];
  return {
    address: top.formatted_address as string,
    lat: top.geometry.location.lat as number,
    lng: top.geometry.location.lng as number,
  };
}

// Step 2: ask the Routes API for drive times from 1 origin to all 10 resorts in ONE request.
// 1 origin x 10 destinations = 10 "elements" billed per refresh.
export async function computeCommutes(origin: { lat: number; lng: number }, apiKey: string) {
  const toWaypoint = (lat: number, lng: number) => ({
    waypoint: { location: { latLng: { latitude: lat, longitude: lng } } },
  });

  const res = await fetch(ROUTE_MATRIX_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // The field mask is REQUIRED: it lists exactly which fields we want back.
      "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration,staticDuration",
    },
    body: JSON.stringify({
      origins: [toWaypoint(origin.lat, origin.lng)],
      destinations: RESORTS.map((r) => toWaypoint(r.lat, r.lng)),
      travelMode: "DRIVE",
      // Uses live + historical traffic. Leaving out departureTime means "leave now".
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Routes API error:", JSON.stringify(data));
    throw new GoogleApiError(data?.error?.message ?? "Routes API request failed.");
  }

  // The response is a list of "elements", one per origin/destination pair. They can come
  // back in any order, so we match each one to its resort using destinationIndex.
  // (Google omits fields whose value is 0, which is why we default the index to 0.)
  type Element = {
    destinationIndex?: number;
    status?: { code?: number };
    condition?: string;
    distanceMeters?: number;
    duration?: string; // e.g. "4512s"
    staticDuration?: string;
  };
  const byIndex = new Map<number, Element>();
  for (const el of data as Element[]) byIndex.set(el.destinationIndex ?? 0, el);

  const seconds = (d?: string) => (d ? parseInt(d.replace("s", ""), 10) : 0);

  return RESORTS.map((resort, i): ResortCommute => {
    const el = byIndex.get(i);
    const ok = !!el && !el.status?.code && el.condition === "ROUTE_EXISTS";
    const durationSec = ok ? seconds(el?.duration) : 0;
    const staticDurationSec = ok ? seconds(el?.staticDuration) : 0;
    return {
      ...resort,
      ok,
      durationSec,
      staticDurationSec,
      delaySec: Math.max(0, durationSec - staticDurationSec),
      distanceMeters: ok ? el?.distanceMeters ?? 0 : 0,
    };
  });
}

// Step 3 (only when you tap a resort): get the actual road path to ONE resort,
// with traffic speed for each stretch of road. Billed as 1 "Compute Routes Enterprise"
// request (traffic-on-polyline is an Enterprise feature; 1,000 free per month).
export async function computeTrafficRoute(origin: { lat: number; lng: number }, resortId: string, apiKey: string) {
  const resort = RESORTS.find((r) => r.id === resortId);
  if (!resort) throw new GoogleApiError("Unknown resort.", 400);

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: resort.lat, longitude: resort.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      extraComputations: ["TRAFFIC_ON_POLYLINE"], // ← asks for traffic speed along the line
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Routes API (computeRoutes) error:", JSON.stringify(data));
    throw new GoogleApiError(data?.error?.message ?? "Route request failed.");
  }
  const route = data.routes?.[0];
  if (!route) throw new GoogleApiError("No driving route found.", 404);

  const points = decodePolyline(route.polyline.encodedPolyline);
  type Interval = { startPolylinePointIndex?: number; endPolylinePointIndex?: number; speed?: TrafficSpeed };
  const intervals: Interval[] = route.travelAdvisory?.speedReadingIntervals ?? [];

  // Cut the line into pieces, one per traffic interval. Each piece includes its end point
  // so the colored pieces join up without gaps. No traffic data → one "normal" piece.
  const segments: RouteSegment[] = intervals.length
    ? intervals.map((iv) => ({
        speed: iv.speed ?? "NORMAL",
        path: points.slice(iv.startPolylinePointIndex ?? 0, (iv.endPolylinePointIndex ?? points.length - 1) + 1),
      }))
    : [{ speed: "NORMAL", path: points }];

  return {
    resortId,
    segments: mergeSegments(segments),
    durationSec: parseInt(String(route.duration ?? "0").replace("s", ""), 10),
    distanceMeters: route.distanceMeters ?? 0,
  };
}

// Join neighbouring pieces that have the same speed, so the map draws fewer lines.
function mergeSegments(segments: RouteSegment[]) {
  const out: RouteSegment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && last.speed === seg.speed) last.path.push(...seg.path.slice(1));
    else out.push({ speed: seg.speed, path: [...seg.path] });
  }
  return out;
}

// Google sends the route shape as an "encoded polyline": a compact text format for a
// list of coordinates. This is Google's published decoding algorithm.
function decodePolyline(encoded: string) {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of ["lat", "lng"] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === "lat") lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Fastest first; resorts with no route go to the bottom.
export function sortByDriveTime(results: ResortCommute[]) {
  return [...results].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    return a.durationSec - b.durationSec;
  });
}
