import { Instrument_Sans } from "next/font/google";

import type { Metadata } from "next";
import { preload } from "react-dom";

import { V4Site } from "@/components/v4/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Current homepage with the CRT-headed character. */
const text = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-text",
  display: "swap",
});

export default function Home() {
  // Start the character and its lighting downloading with the HTML, rather
  // than after the scripts have loaded and asked for them. The same URLs as
  // GHANSHYAM_URL and the Environment in components/v4/ghanshyam.tsx; three's
  // loaders fetch them with CORS, so the preloads must too or they go unused.
  preload("/v4/ghanshyam-3.glb", { as: "fetch", crossOrigin: "anonymous" });
  preload("/v4/envmap.exr", { as: "fetch", crossOrigin: "anonymous" });
  // The loading screen's logo (a CSS mask, which the browser finds late).
  preload("/gp-logo-900.webp", { as: "image" });
  return (
    <div className={`v4 ${text.variable}`}>
      <V4Site />
    </div>
  );
}
