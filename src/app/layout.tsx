import type { Metadata } from "next";
import { Inter, Geist_Mono, Unica_One, Lato, IBM_Plex_Mono, Inter_Tight } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { FloatingNav } from "@/components/site/floating-nav";
import { Footer } from "@/components/site/footer";
import { Chrome } from "@/components/site/chrome";
import { PERSON_SCHEMA } from "@/lib/person-schema";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const joystix = localFont({
  src: "./fonts/joystix-monospace.otf",
  variable: "--font-pixel",
  display: "swap",
});

// Display face for the /v2 design only — the main portfolio keeps Unica One.
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  // 300 matters: section headings are Lato Light, which carries most of the
  // airiness. 700 is the hero weight as it actually renders.
  weight: ["300", "400", "700"],
  display: "swap",
});

// v2's small-caps labels. Kode Mono, which /v1 still uses, is squared-off and
// reads as generic machine-UI lettering; Plex Mono is drawn as a text face
// first, so it sits under the Lato headlines instead of fighting them.
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-v2",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// The third design's only face: a neutral grotesk, tighter than Inter, which
// is what lets 13px intro copy and a 17px prompt sit together without the
// smaller size looking like a different voice.
const interTight = Inter_Tight({
  variable: "--font-tight",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const unicaOne = Unica_One({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const TITLE = "Ghanshyam Paunikar · AI Engineer in Pune";
const DESCRIPTION =
  "Ghanshyam Paunikar is an AI Engineer in Pune with 3+ years building LLM applications end to end: RAG, LangGraph agents and LLM evaluation at Sigma AI, Python APIs and React front ends. Open to roles.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ghanshyampaunikar.com"),
  title: { default: TITLE, template: "%s · Ghanshyam Paunikar" },
  description: DESCRIPTION,
  // Google Search Console's HTML-tag check, when GOOGLE_SITE_VERIFICATION is set.
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  icons: {
    icon: [{ url: "/Favicon.png" }],
    apple: [{ url: "/Favicon.png" }],
  },
  authors: [{ name: "Ghanshyam Paunikar", url: "https://ghanshyampaunikar.com" }],
  creator: "Ghanshyam Paunikar",
  keywords: [
    "Ghanshyam Paunikar",
    "AI Engineer Pune",
    "ML Engineer Pune",
    "LLM Engineer",
    "Generative AI Engineer",
    "Agentic AI",
    "Data Scientist Pune",
    "Computer Vision",
    "NLP",
    "MLOps",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://ghanshyampaunikar.com",
    siteName: "Ghanshyam Paunikar",
    locale: "en_IN",
    type: "profile",
    images: [{ url: "/elio-preview.jpg", width: 1200, height: 630, alt: "Meet Elio: Ghanshyam Paunikar's interactive AI portfolio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/elio-preview.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${joystix.variable} ${unicaOne.variable} ${lato.variable} ${plexMono.variable} ${interTight.variable} h-full antialiased dark`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Kode+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          // Static, from our own data: safe to inline.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }}
        />
<main className="flex-1">{children}</main>
        <Chrome>
          <Footer />
          <FloatingNav />
        </Chrome>
      </body>
    </html>
  );
}
