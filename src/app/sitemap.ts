import type { MetadataRoute } from "next";

/** The pages worth finding in search; the old designs (/v1 to /v3) are left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://ghanshyampaunikar.com";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/Ghanshyam-Paunikar-Resume.pdf`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/lab`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
