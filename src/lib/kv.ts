import "server-only";

/**
 * A minimal Upstash Redis client over its REST API: no SDK, one fetch per
 * pipeline. Reads the connection that Vercel's Upstash integration adds
 * (either naming scheme). Without one, every call is a quiet no-op, so the
 * site works the same before the database is connected.
 */
/*
 * Vercel's integration may add a custom prefix (e.g. STORAGE_KV_REST_API_URL),
 * so accept any variable that ends with the standard name.
 */
const envEnding = (...names: string[]) => {
  for (const n of names) if (process.env[n]) return process.env[n] as string;
  for (const n of names) {
    const k = Object.keys(process.env).find((key) => key.endsWith(`_${n}`) && process.env[key]);
    if (k) return process.env[k] as string;
  }
  return "";
};
const URL = envEnding("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL");
const TOKEN = envEnding("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");

export const kvConfigured = () => Boolean(URL && TOKEN);

export type Cmd = (string | number)[];

/** Runs commands in one round trip; returns each result, or null if unavailable. */
export async function pipeline(cmds: Cmd[]): Promise<unknown[] | null> {
  if (!kvConfigured() || cmds.length === 0) return null;
  try {
    const res = await fetch(`${URL}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.map((r) => (r.error ? null : r.result ?? null));
  } catch {
    return null;
  }
}

/** Where a request came from, as Vercel reports it. */
export function whereFrom(req: Request) {
  const h = req.headers;
  const dec = (v: string | null) => {
    if (!v) return "";
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "",
    country: h.get("x-vercel-ip-country") ?? "",
    region: dec(h.get("x-vercel-ip-country-region")),
    city: dec(h.get("x-vercel-ip-city")),
    lat: h.get("x-vercel-ip-latitude") ?? "",
    lon: h.get("x-vercel-ip-longitude") ?? "",
    ua: h.get("user-agent") ?? "",
  };
}

/** Rough device, browser and OS from a user agent; enough for a dashboard. */
export function device(ua: string) {
  const u = ua.toLowerCase();
  const kind = /ipad|tablet/.test(u) ? "Tablet" : /mobi|iphone|android/.test(u) ? "Mobile" : "Desktop";
  const browser = /edg\//.test(u)
    ? "Edge"
    : /opr\/|opera/.test(u)
      ? "Opera"
      : /samsungbrowser/.test(u)
        ? "Samsung"
        : /chrome|crios/.test(u)
          ? "Chrome"
          : /firefox|fxios/.test(u)
            ? "Firefox"
            : /safari/.test(u)
              ? "Safari"
              : "Other";
  const os = /windows/.test(u)
    ? "Windows"
    : /iphone|ipad|ios/.test(u)
      ? "iOS"
      : /android/.test(u)
        ? "Android"
        : /mac os|macintosh/.test(u)
          ? "macOS"
          : /linux/.test(u)
            ? "Linux"
            : "Other";
  return { kind, browser, os };
}

export const isBot = (ua: string) => !ua || /bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python|node-fetch/i.test(ua);

/** IPs are kept for 90 days, then expire on their own. */
export const IP_TTL_SECONDS = 90 * 24 * 60 * 60;
/** How many recent visits and questions are kept in full. */
export const KEEP = 5000;
