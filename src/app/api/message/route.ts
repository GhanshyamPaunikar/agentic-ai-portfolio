import { saveMessage } from "@/lib/elio-tools";
import { isBot, whereFrom } from "@/lib/kv";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * The "Message him" form: the visitor's note, saved for Ghanshyam's
 * dashboard. A few an hour per address is plenty for a real person and
 * stops the box being used to flood the list.
 */
const HOUR = 60 * 60 * 1000;
const sent = new Map<string, { n: number; reset: number }>();

export async function POST(req: Request) {
  const ip = clientIp(req);
  const now = Date.now();
  const s = sent.get(ip);
  if (s && s.reset > now && s.n >= 5) return Response.json({ ok: false }, { status: 429 });
  sent.set(ip, s && s.reset > now ? { n: s.n + 1, reset: s.reset } : { n: 1, reset: now + HOUR });

  let body: { name?: unknown; contact?: unknown; message?: unknown; vid?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const message = str(body.message, 2000);
  const contact = str(body.contact, 200);
  if (!message || !contact) return Response.json({ ok: false }, { status: 400 });

  const w = whereFrom(req);
  if (isBot(w.ua)) return Response.json({ ok: true });
  const vid = str(body.vid, 40);
  const ok = await saveMessage({
    name: str(body.name, 80),
    contact,
    message,
    vid: /^[a-z0-9]{6,40}$/.test(vid) ? vid : undefined,
    country: w.country,
    via: "form",
  });
  return Response.json({ ok }, { status: ok ? 200 : 503 });
}
