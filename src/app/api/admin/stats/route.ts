import { timingSafeEqual } from "node:crypto";

import { kvConfigured, pipeline } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The dashboard's data. Totals and breakdowns (countries, cities, devices,
 * referrers, the last 30 days) are public. Individual visits with their IPs,
 * and the questions people typed, need ADMIN_KEY, which only Ghanshyam has.
 */
function allowed(req: Request) {
  const want = process.env.ADMIN_KEY ?? "";
  const got = req.headers.get("x-admin-key") ?? "";
  if (!want || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const pairs = (flat: unknown) => {
  const a = Array.isArray(flat) ? (flat as string[]) : [];
  const out: { k: string; n: number }[] = [];
  // Rows taken down to zero by a removal are left out.
  for (let i = 0; i + 1 < a.length; i += 2) if (Number(a[i + 1]) > 0) out.push({ k: a[i], n: Number(a[i + 1]) });
  return out.sort((x, y) => y.n - x.n);
};

/*
 * Wrong guesses are limited per address: five, then a fifteen-minute lockout.
 * A short key cannot be found by trying thousands of them.
 */
const MISSES = new Map<string, { n: number; until: number }>();
const MAX_MISSES = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function GET(req: Request) {
  // A key only matters if one is offered; without one, the public view.
  let full = false;
  if (req.headers.get("x-admin-key")) {
    if (!process.env.ADMIN_KEY) return Response.json({ error: "ADMIN_KEY is not set in Vercel." }, { status: 503 });
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const now = Date.now();
    const m = MISSES.get(ip);
    if (m && m.n >= MAX_MISSES && m.until > now) {
      return Response.json({ error: "Too many wrong keys. Try again in 15 minutes." }, { status: 429 });
    }
    if (!allowed(req)) {
      const next = m && m.until > now ? m.n + 1 : 1;
      MISSES.set(ip, { n: next, until: now + LOCK_MS });
      return Response.json({ error: "Wrong key." }, { status: 401 });
    }
    MISSES.delete(ip);
    full = true;
  }
  if (!kvConfigured()) return Response.json({ error: "No database connected yet (Upstash Redis)." }, { status: 503 });

  const days = [...Array(30)].map((_, i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)).reverse();
  const r = await pipeline([
    ["GET", "count:total"],
    ["PFCOUNT", "visitors"],
    ["GET", "count:questions"],
    ["MGET", ...days.map((d) => `count:day:${d}`)],
    ["HGETALL", "count:country"],
    ["HGETALL", "count:city"],
    ["HGETALL", "count:device"],
    ["HGETALL", "count:browser"],
    ["HGETALL", "count:os"],
    ["HGETALL", "count:ref"],
    ...(full
      ? [
          ["LRANGE", "visits", 0, 199],
          ["LRANGE", "questions", 0, 199],
          ["LRANGE", "messages", 0, 99],
        ]
      : []),
  ]);
  if (!r) return Response.json({ error: "Database unreachable." }, { status: 502 });

  const visits = full ? ((r[10] as string[]) ?? []).map((v) => JSON.parse(v) as { id: string } & Record<string, unknown>) : [];
  const ids = visits.map((v) => (typeof v.visitor === "string" ? v.visitor : ""));
  const extra = visits.length
    ? await pipeline([
        ["MGET", ...visits.map((v) => `ip:${v.id}`)],
        ["HMGET", "names", ...ids.map((id) => id || "-")],
      ])
    : null;
  const ipList = (extra?.[0] as (string | null)[]) ?? [];
  // The name each browser gave Elio, if it gave one.
  const nameList = ((extra?.[1] as (string | null)[]) ?? []).map((n) => {
    try {
      return n ? (JSON.parse(n) as { name: string }).name : null;
    } catch {
      return null;
    }
  });

  return Response.json({
    full,
    total: Number(r[0] ?? 0),
    unique: Number(r[1] ?? 0),
    questions: Number(r[2] ?? 0),
    perDay: days.map((d, i) => ({ d, n: Number(((r[3] as (string | null)[]) ?? [])[i] ?? 0) })),
    country: pairs(r[4]),
    city: pairs(r[5]).slice(0, 25),
    device: pairs(r[6]),
    browser: pairs(r[7]),
    os: pairs(r[8]),
    ref: pairs(r[9]).slice(0, 15),
    visits: visits.map((v, i) => ({ ...v, ip: ipList[i] ?? null, name: nameList[i] ?? null })),
    recentQuestions: full ? ((r[11] as string[]) ?? []).map((q) => JSON.parse(q)) : [],
    // Notes visitors asked Elio to pass on.
    messages: full ? ((r[12] as string[]) ?? []).map((m) => JSON.parse(m)) : [],
  });
}

type Entry = Record<string, unknown>;
const parse = (raw: string): Entry => {
  try {
    return JSON.parse(raw) as Entry;
  } catch {
    return {};
  }
};

/**
 * Removes entries from the lists: single ones picked on the dashboard, or
 * everything one browser (its anonymous id) left behind. A removed visit also
 * comes off the totals, so the charts stay true.
 */
export async function DELETE(req: Request) {
  if (!allowed(req)) return Response.json({ error: "Wrong key." }, { status: 401 });
  if (!kvConfigured()) return Response.json({ error: "No database connected yet (Upstash Redis)." }, { status: 503 });
  let body: { visits?: unknown; questions?: unknown; messages?: unknown; vid?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const list = (v: unknown) => new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const visitIds = list(body.visits);
  const questionTs = list(body.questions);
  const messageTs = list(body.messages);
  const vid = typeof body.vid === "string" && /^[a-z0-9]{6,40}$/.test(body.vid) ? body.vid : "";

  const r = await pipeline([
    ["LRANGE", "visits", 0, -1],
    ["LRANGE", "questions", 0, -1],
    ["LRANGE", "messages", 0, -1],
  ]);
  if (!r) return Response.json({ error: "Database unreachable." }, { status: 502 });
  const pick = (i: number, hit: (e: Entry) => boolean) => ((r[i] as string[]) ?? []).filter((raw) => hit(parse(raw)));
  const visits = pick(0, (e) => visitIds.has(String(e.id)) || (!!vid && e.visitor === vid));
  const questions = pick(1, (e) => questionTs.has(String(e.t)) || (!!vid && e.vid === vid));
  const messages = pick(2, (e) => messageTs.has(String(e.t)) || (!!vid && e.vid === vid));

  const cmds: (string | number)[][] = [];
  for (const raw of visits) {
    const v = parse(raw);
    const s = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
    cmds.push(
      ["LREM", "visits", 1, raw],
      ["DEL", `ip:${s("id")}`],
      ["DECR", "count:total"],
      ["DECR", `count:day:${s("t").slice(0, 10)}`],
      ["HINCRBY", "count:country", s("country") || "Unknown", -1],
      ["HINCRBY", "count:city", [s("city"), s("country")].filter(Boolean).join(", ") || "Unknown", -1],
      ["HINCRBY", "count:device", s("kind"), -1],
      ["HINCRBY", "count:browser", s("browser"), -1],
      ["HINCRBY", "count:os", s("os"), -1],
      ["HINCRBY", "count:ref", s("ref") || "Direct", -1],
    );
  }
  for (const raw of questions) cmds.push(["LREM", "questions", 1, raw], ["DECR", "count:questions"]);
  for (const raw of messages) cmds.push(["LREM", "messages", 1, raw], ["DECR", "count:messages"]);
  if (vid) cmds.push(["HDEL", "names", vid]);
  if (cmds.length && !(await pipeline(cmds))) return Response.json({ error: "Database unreachable." }, { status: 502 });
  return Response.json({ removed: { visits: visits.length, questions: questions.length, messages: messages.length } });
}
