// Sample data shown when no GOOGLE_MAPS_API_KEY is set, so you can try the UI
// before setting up Google Cloud. Numbers are rough drive times from downtown Denver.
import { RESORTS } from "./resorts";
import type { ResortCommute } from "./types";

const DEMO_MINUTES: Record<string, [normal: number, traffic: number, miles: number]> = {
  loveland: [58, 71, 56],
  "arapahoe-basin": [68, 84, 66],
  keystone: [75, 92, 72],
  copper: [83, 101, 79],
  breckenridge: [92, 113, 84],
  "winter-park": [88, 96, 67],
  vail: [104, 126, 99],
  "beaver-creek": [117, 139, 112],
  steamboat: [175, 181, 157],
  snowmass: [214, 236, 199],
};

export const DEMO_ORIGIN = { address: "Union Station, Denver, CO (demo)", lat: 39.7527, lng: -105.0001 };

export function demoCommutes(): ResortCommute[] {
  return RESORTS.map((r) => {
    const [normal, traffic, miles] = DEMO_MINUTES[r.id] ?? [120, 130, 100];
    return {
      ...r,
      ok: true,
      durationSec: traffic * 60,
      staticDurationSec: normal * 60,
      delaySec: (traffic - normal) * 60,
      distanceMeters: Math.round(miles * 1609.34),
    };
  });
}
