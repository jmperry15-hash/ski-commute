import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Condensed, ski-signage style typeface for headings and big numbers.
const display = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Ski Commute",
  description: "Live drive times from home to 10 Colorado ski resorts.",
};

export const viewport: Viewport = {
  themeColor: "#060b14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
