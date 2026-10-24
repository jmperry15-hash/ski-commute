// The home-screen icon artwork: snowy peaks under a night sky, with a road
// winding up to them. Drawn once here and rendered to PNG at whatever size
// the phone asks for (see app/icon.tsx and app/apple-icon.tsx).
import { ImageResponse } from "next/og";

export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0c1f3d" />
            <stop offset="1" stopColor="#060b14" />
          </linearGradient>
        </defs>
        {/* Night sky fills the whole square; iPhone rounds the corners itself. */}
        <rect width="512" height="512" fill="url(#sky)" />
        <circle cx="390" cy="120" r="34" fill="#eef4ff" opacity="0.9" />
        {/* Back range */}
        <path d="M0 360 L120 230 L200 300 L300 180 L420 300 L512 250 L512 512 L0 512 Z" fill="#1d4ed8" opacity="0.55" />
        {/* Front peak with a snow cap */}
        <path d="M40 512 L240 170 L440 512 Z" fill="#111d31" />
        <path d="M240 170 L300 272 L270 256 L245 282 L215 252 L180 272 Z" fill="#eef4ff" />
        {/* Road winding up toward the peak, in the dashboard's glacier blue */}
        <path
          d="M150 512 C 230 470, 330 450, 280 400 C 240 360, 200 350, 250 310"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="22"
          strokeLinecap="round"
        />
      </svg>
    ),
    { width: size, height: size },
  );
}
