// POST /api/commute  { "address": "123 Main St, Denver, CO" }
//
// This runs on the SERVER (on Vercel), never in the browser. That's what keeps
// GOOGLE_MAPS_API_KEY secret: the browser only ever talks to this endpoint.
import { computeCommutes, geocodeAddress, GoogleApiError, sortByDriveTime } from "@/lib/google";
import { DEMO_ORIGIN, demoCommutes } from "@/lib/demo";
import type { CommuteResponse } from "@/lib/types";

// Small in-memory cache: if the same address is requested again within 2 minutes,
// reuse the last answer instead of paying for another Google call.
// (Traffic doesn't change meaningfully in 2 minutes.)
const CACHE_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; data: CommuteResponse }>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (address.length < 5 || address.length > 200) {
    return Response.json({ error: "Please enter a full street address." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // No key yet? Return sample data so the dashboard still works.
    const demo: CommuteResponse = {
      origin: DEMO_ORIGIN,
      results: sortByDriveTime(demoCommutes()),
      fetchedAt: new Date().toISOString(),
      demo: true,
    };
    return Response.json(demo);
  }

  const cacheKey = address.toLowerCase().replace(/\s+/g, " ");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return Response.json(hit.data);
  }

  try {
    const origin = await geocodeAddress(address, apiKey);
    const results = await computeCommutes(origin, apiKey);
    const data: CommuteResponse = {
      origin,
      results: sortByDriveTime(results),
      fetchedAt: new Date().toISOString(),
      demo: false,
    };
    cache.set(cacheKey, { at: Date.now(), data });
    return Response.json(data);
  } catch (err) {
    if (err instanceof GoogleApiError) {
      return Response.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error(err);
    return Response.json({ error: "Something went wrong fetching drive times." }, { status: 500 });
  }
}
