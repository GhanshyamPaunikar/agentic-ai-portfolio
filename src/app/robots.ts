import type { MetadataRoute } from "next";

/** Everything public may be crawled; the dashboard and the API may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: "https://ghanshyampaunikar.com/sitemap.xml",
    host: "https://ghanshyampaunikar.com",
  };
}
