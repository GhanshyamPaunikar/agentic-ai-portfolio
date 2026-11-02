import { IP_TTL_SECONDS, KEEP, device, isBot, kvConfigured, pipeline, whereFrom } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records one visit: where from (Vercel's geolocation), what device, which
 * page, whether they have been before. The IP is stored under its own key
 * with a 90-day expiry, so it disappears while the rest stays for the stats.
 */
export async function POST(req: Request) {
  if (!kvConfigured()) return new Response(null, { status: 204 });
  // The owner's browsers carry this cookie once /admin has been unlocked there.
  if (/(?:^|;\s*)gp_owner=1(?:;|$)/.test(req.headers.get("cookie") ?? "")) return new Response(null, { status: 204 });
  const w = whereFrom(req);
  if (isBot(w.ua)) return new Response(null, { status: 204 });

  let body: {
    path?: string;
    referrer?: string;
    screen?: string;
    lang?: string;
    visitor?: string;
    returning?: boolean;
    name?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* an empty body still counts as a visit */
  }
  const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

  // The name a visitor gave Elio, filed under their browser's anonymous id so
  // the admin page can put it beside their visits. Not a visit itself.
  if (typeof body.name === "string") {
    const name = clip(body.name.trim(), 40);
    const visitor = clip(body.visitor, 40);
    if (name && visitor) {
      await pipeline([["HSET", "names", visitor, JSON.stringify({ name, t: new Date().toISOString() })]]);
    }
    return new Response(null, { status: 204 });
  }
  const d = device(w.ua);
  const now = new Date();
  const id = `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  let ref = clip(body.referrer, 300);
  try {
    ref = ref ? new URL(ref).hostname.replace(/^www\./, "") : "";
  } catch {
    ref = "";
  }
  const visit = {
    id,
    t: now.toISOString(),
    path: clip(body.path, 120),
    ref,
    country: w.country,
    region: w.region,
    city: w.city,
    lat: w.lat,
    lon: w.lon,
    kind: d.kind,
    browser: d.browser,
    os: d.os,
    lang: clip(body.lang, 20),
    screen: clip(body.screen, 20),
    visitor: clip(body.visitor, 40),
    returning: Boolean(body.returning),
  };
  const day = now.toISOString().slice(0, 10);
  const cmds: (string | number)[][] = [
    ["LPUSH", "visits", JSON.stringify(visit)],
    ["LTRIM", "visits", 0, KEEP - 1],
    ["INCR", `count:day:${day}`],
    ["HINCRBY", "count:country", w.country || "Unknown", 1],
    ["HINCRBY", "count:city", [w.city, w.country].filter(Boolean).join(", ") || "Unknown", 1],
    ["HINCRBY", "count:device", d.kind, 1],
    ["HINCRBY", "count:browser", d.browser, 1],
    ["HINCRBY", "count:os", d.os, 1],
    ["HINCRBY", "count:ref", ref || "Direct", 1],
    ["INCR", "count:total"],
  ];
  if (visit.visitor) cmds.push(["PFADD", "visitors", visit.visitor]);
  if (w.ip) cmds.push(["SET", `ip:${id}`, w.ip, "EX", IP_TTL_SECONDS]);
  await pipeline(cmds);
  return new Response(null, { status: 204 });
}
