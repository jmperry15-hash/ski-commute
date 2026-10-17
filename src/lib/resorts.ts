// The 10 resorts the dashboard tracks.
// Want a different resort? Add or edit an entry here — everything else updates automatically.
// Coordinates point at each resort's main base area / parking.

export type Resort = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
};

export const RESORTS: Resort[] = [
  { id: "loveland", name: "Loveland", region: "Clear Creek County", lat: 39.68, lng: -105.8979 },
  { id: "arapahoe-basin", name: "Arapahoe Basin", region: "Summit County", lat: 39.6426, lng: -105.8717 },
  { id: "keystone", name: "Keystone", region: "Summit County", lat: 39.6084, lng: -105.9438 },
  { id: "copper", name: "Copper Mountain", region: "Summit County", lat: 39.5014, lng: -106.1516 },
  { id: "breckenridge", name: "Breckenridge", region: "Summit County", lat: 39.4808, lng: -106.0667 },
  { id: "winter-park", name: "Winter Park", region: "Grand County", lat: 39.8868, lng: -105.7625 },
  { id: "vail", name: "Vail", region: "Eagle County", lat: 39.6403, lng: -106.3742 },
  { id: "beaver-creek", name: "Beaver Creek", region: "Eagle County", lat: 39.6042, lng: -106.5165 },
  { id: "steamboat", name: "Steamboat", region: "Routt County", lat: 40.4572, lng: -106.8045 },
  { id: "snowmass", name: "Aspen Snowmass", region: "Pitkin County", lat: 39.213, lng: -106.9378 },
];
