// Tells phones how to install the site as an app: its name, icon, colors, and
// "standalone" = open full-screen without the browser's address bar.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ski Commute",
    short_name: "Ski Commute",
    description: "Live drive times from home to 10 Colorado ski resorts.",
    start_url: "/",
    display: "standalone",
    background_color: "#060b14",
    theme_color: "#060b14",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
