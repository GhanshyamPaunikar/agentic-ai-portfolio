/**
 * What Elio remembers about a visitor between visits, on their own device.
 *
 * Held for this page load only: a refresh starts Elio fresh, with no name and
 * no history. The site's anonymous visit counter (visitorId) is separate.
 */
export type Memory = {
  name?: string;
  visits: number;
  lastSeen?: number;
  /** Projects and certificates they looked at, newest first. */
  topics: string[];
  /** Their last few questions, newest first. */
  asked: string[];
  /** What Elio chose to remember about them ("hiring for a senior ML role"). */
  notes: string[];
};

const KEY = "pix-memory";

/*
 * Every visit starts fresh: what Elio learns lives only for this page load,
 * and a refresh forgets it. Anything an older version stored is cleared.
 */
let current: Memory = { visits: 0, topics: [], asked: [], notes: [] };
try {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
} catch {
  /* storage blocked: nothing to clear */
}

export function loadMemory(): Memory {
  return { ...current, topics: [...current.topics], asked: [...current.asked], notes: [...current.notes] };
}

export function saveMemory(m: Memory) {
  current = m;
}

/** Counts this visit and returns what was remembered before it. */
export function arrive(): Memory {
  const before = loadMemory();
  saveMemory({ ...before, visits: before.visits + 1, lastSeen: Date.now() });
  return before;
}

const front = (list: string[], item: string, max: number) => [item, ...list.filter((t) => t !== item)].slice(0, max);

export function remember(patch: { name?: string; topic?: string; asked?: string; note?: string }) {
  const m = loadMemory();
  if (patch.name) m.name = patch.name;
  if (patch.topic) m.topics = front(m.topics, patch.topic, 5);
  if (patch.asked) m.asked = front(m.asked, patch.asked.replace(/\s+/g, " ").slice(0, 80), 4);
  if (patch.note) m.notes = front(m.notes, patch.note, 5);
  saveMemory(m);
}

/**
 * A short note for the model about a returning visitor, or "".
 *
 * Only what helps answer them: that they have been before, and what Elio
 * chose to remember (the role they are hiring for, say). What they browsed
 * or asked last time used to go in too, and Elio kept bringing it up
 * unprompted ("still thinking about Innerbloom?"); that stays on the device,
 * for the welcome line only.
 */
export function noteFor(before: Memory): string {
  if (before.visits < 1) return "";
  return [
    "Returning visitor; the page has already welcomed them back, so don't greet them again",
    before.notes.length ? `what you remember about them: ${before.notes.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Whether this browser has been counted before (for the visit counter only). */
export function seenBefore(): boolean {
  try {
    return localStorage.getItem("pix-vid") !== null;
  } catch {
    return false;
  }
}

/** A random id for this browser, so the dashboard can count unique visitors. */
export function visitorId(): string {
  try {
    let id = localStorage.getItem("pix-vid");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("pix-vid", id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Ghanshyam's own browsers. Unlocking /admin marks a browser as the owner's,
 * and from then on its visits are never sent to the counter.
 */
export const OWNER_KEY = "gp-owner";

export function isOwner(): boolean {
  try {
    if (localStorage.getItem(OWNER_KEY) === "1") return true;
  } catch {
    /* fall through to the cookie */
  }
  return typeof document !== "undefined" && /(?:^|;\s*)gp_owner=1(?:;|$)/.test(document.cookie);
}

export function setOwner(on: boolean) {
  try {
    if (on) localStorage.setItem(OWNER_KEY, "1");
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* the cookie below still works */
  }
  document.cookie = on
    ? "gp_owner=1; path=/; max-age=315360000; samesite=lax; secure"
    : "gp_owner=; path=/; max-age=0; samesite=lax; secure";
}

/** Tells the site's own counter about this visit. Fire and forget. */
export function reportVisit(returning: boolean) {
  if (isOwner()) return;
  try {
    void fetch("/api/track", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: location.pathname,
        referrer: document.referrer,
        screen: `${screen.width}x${screen.height}`,
        lang: navigator.language,
        visitor: visitorId(),
        returning,
      }),
    });
  } catch {
    /* counting is optional */
  }
}

/** Files the name a visitor gave Elio with their visits, for the admin page. */
export function reportName(name: string) {
  if (isOwner()) return;
  try {
    void fetch("/api/track", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, visitor: visitorId() }),
    });
  } catch {
    /* counting is optional */
  }
}
