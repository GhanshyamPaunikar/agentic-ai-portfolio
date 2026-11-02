/**
 * In-memory sliding-window rate limiting for the public chat endpoint.
 *
 * Caveat worth knowing: serverless instances are not shared, so each warm
 * instance keeps its own counters. A visitor spread across several instances
 * can exceed the per-IP limit by roughly the number of live instances. That is
 * acceptable for a portfolio — the global daily cap below is the real
 * protection against a runaway bill. Swap in Upstash Redis or Vercel KV if this
 * ever needs to be exact.
 */

type Hit = { count: number; resetAt: number };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const hourly = new Map<string, Hit>();
const daily = new Map<string, Hit>();
let globalDay: Hit = { count: 0, resetAt: Date.now() + DAY };

export const LIMITS = {
  // A recruiter going through his skills one by one asks a lot; twelve an
  // hour cut them off mid-conversation.
  perIpPerHour: 30,
  perIpPerDay: 80,
  /**
   * Must stay comfortably under the provider's free-tier daily quota, since
   * exhausting that takes the assistant down for everyone until it resets.
   * Gemini's free quotas are per model, and Elio falls through five models
   * (see llm.ts), so the real ceiling is several times any one model's.
   */
  globalPerDay: 600,
  maxMessageChars: 6000,
  maxTurns: 20,
};

/** Drop expired entries so the maps cannot grow without bound. */
function sweep(map: Map<string, Hit>, now: number) {
  if (map.size < 5000) return;
  for (const [key, hit] of map) {
    if (hit.resetAt <= now) map.delete(key);
  }
}

function bump(map: Map<string, Hit>, key: string, window: number, now: number): Hit {
  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + window };
    map.set(key, fresh);
    return fresh;
  }
  existing.count += 1;
  return existing;
}

export type RateResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: string; retryAfterSeconds: number };

export function checkRateLimit(ip: string): RateResult {
  const now = Date.now();

  if (globalDay.resetAt <= now) {
    globalDay = { count: 0, resetAt: now + DAY };
  }
  if (globalDay.count >= LIMITS.globalPerDay) {
    return {
      ok: false,
      reason:
        "This assistant has hit its daily limit across all visitors. Please email Ghanshyam directly — he reads everything.",
      retryAfterSeconds: Math.ceil((globalDay.resetAt - now) / 1000),
    };
  }

  sweep(hourly, now);
  sweep(daily, now);

  const perHour = bump(hourly, ip, HOUR, now);
  if (perHour.count > LIMITS.perIpPerHour) {
    return {
      ok: false,
      reason:
        "You've reached the hourly message limit. Try again shortly, or email Ghanshyam directly.",
      retryAfterSeconds: Math.ceil((perHour.resetAt - now) / 1000),
    };
  }

  const perDay = bump(daily, ip, DAY, now);
  if (perDay.count > LIMITS.perIpPerDay) {
    return {
      ok: false,
      reason:
        "You've reached the daily message limit. Email Ghanshyam directly and he'll pick it up from there.",
      retryAfterSeconds: Math.ceil((perDay.resetAt - now) / 1000),
    };
  }

  globalDay.count += 1;
  return { ok: true, remaining: LIMITS.perIpPerHour - perHour.count };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
