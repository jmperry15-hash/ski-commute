// POST /api/route  { "lat": 39.75, "lng": -105.0, "resortId": "vail" }
//
// Called only when you tap a resort. Returns the road path to that resort, split
// into segments colored by live traffic. Runs on the server so the key stays secret.
import { computeTrafficRoute, GoogleApiError } from "@/lib/google";
import { RESORTS } from "@/lib/resorts";
import type { TrafficRoute } from "@/lib/types";

// Reuse a route for 5 minutes, so tapping back and forth between resorts is free.
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: TrafficRoute }>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { lat, lng, resortId } = body as { lat?: unknown; lng?: unknown; resortId?: unknown };
  const valid =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    RESORTS.some((r) => r.id === resortId);
  if (!valid) return Response.json({ error: "Invalid route request." }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Route lines need GOOGLE_MAPS_API_KEY (demo mode)." }, { status: 503 });
  }

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${resortId}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.data);

  try {
    const route = await computeTrafficRoute({ lat, lng }, resortId as string, apiKey);
    const data: TrafficRoute = { ...route, fetchedAt: new Date().toISOString() };
    cache.set(cacheKey, { at: Date.now(), data });
    return Response.json(data);
  } catch (err) {
    if (err instanceof GoogleApiError) {
      return Response.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error(err);
    return Response.json({ error: "Something went wrong loading the route." }, { status: 500 });
  }
}
