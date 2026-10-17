// The public browser key for the map and address suggestions ("" if not set yet).
// Next.js copies NEXT_PUBLIC_ variables into the browser code when the app is built.
export const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
