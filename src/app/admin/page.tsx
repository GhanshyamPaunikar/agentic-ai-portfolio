"use client";

import { useCallback, useEffect, useState } from "react";

import { isOwner, setOwner, visitorId } from "@/components/v3/memory";

/**
 * The visitor dashboard. Totals and breakdowns are public, and any browser
 * can opt itself out of the count (Ghanshyam uses this on his own devices). The list of
 * individual visits (with IPs) and what people asked Elio unlock with
 * ADMIN_KEY; a browser that has unlocked once remembers it and opens
 * straight in.
 */
type Row = { k: string; n: number };
type Visit = {
  id: string;
  t: string;
  path: string;
  ref: string;
  country: string;
  region: string;
  city: string;
  kind: string;
  browser: string;
  os: string;
  lang: string;
  screen: string;
  returning: boolean;
  visitor?: string;
  ip: string | null;
  /** The name they gave Elio, if any. */
  name: string | null;
};
type Question = { t: string; q: string; a: string; jd: boolean; ms: number; country: string; city: string; name?: string; vid?: string; kept?: string };
type Message = { t: string; name?: string; contact: string; message: string; country?: string; via?: string; vid?: string };
type Stats = {
  full: boolean;
  total: number;
  unique: number;
  questions: number;
  perDay: { d: string; n: number }[];
  country: Row[];
  city: Row[];
  device: Row[];
  browser: Row[];
  os: Row[];
  ref: Row[];
  visits: Visit[];
  recentQuestions: Question[];
  messages?: Message[];
};

/** One row per visitor who talked to Elio: who they are, and what Elio learned. */
function people(qs: Question[]) {
  const by = new Map<string, { vid: string; name?: string; place: string; n: number; last: string; notes: string[] }>();
  for (const q of qs) {
    if (!q.vid) continue;
    const p = by.get(q.vid) ?? { vid: q.vid, place: [q.city, q.country].filter(Boolean).join(", "), n: 0, last: q.t, notes: [] };
    p.n += 1;
    p.name ??= q.name;
    if (q.kept && !p.notes.includes(q.kept)) p.notes.push(q.kept);
    by.set(q.vid, p);
  }
  return [...by.values()];
}

const flag = (cc: string) =>
  cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐";
const when = (t: string) => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Bars({ title, rows }: { title: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="rounded-[14px] border border-black/[0.07] bg-white p-4">
      <h3 className="text-[13px] font-medium uppercase tracking-[0.12em] text-black/45">{title}</h3>
      <ul className="mt-3 space-y-1.5">
        {rows.slice(0, 10).map((r) => (
          <li key={r.k} className="grid grid-cols-[1fr_auto] items-center gap-3 text-[14px]">
            <div className="relative overflow-hidden rounded-[6px] bg-black/[0.04] px-2 py-1">
              <div className="absolute inset-y-0 left-0 bg-[#2f6fed]/15" style={{ width: `${(r.n / max) * 100}%` }} />
              <span className="relative">{title === "Countries" ? `${flag(r.k)} ${r.k}` : r.k}</span>
            </div>
            <span className="tabular-nums text-black/60">{r.n}</span>
          </li>
        ))}
        {!rows.length && <li className="text-[14px] text-black/40">Nothing yet.</li>}
      </ul>
    </div>
  );
}

function X({ onClick, label = "Remove" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="shrink-0 text-[12px] text-black/40 underline hover:text-[#b4232a]">
      {label}
    </button>
  );
}

const STORE = "admin-key";
const readKey = () => {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
};
const saveKey = (k: string | null) => {
  try {
    if (k) localStorage.setItem(STORE, k);
    else localStorage.removeItem(STORE);
  } catch {
    /* private mode: unlock lasts for this visit */
  }
};

async function fetchStats(k: string | null) {
  const res = await fetch("/api/admin/stats", { headers: k ? { "x-admin-key": k } : {}, cache: "no-store" });
  const data = await res.json();
  return { ok: res.ok, data };
}

export default function Admin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [owner, setOwnerState] = useState(() => typeof window !== "undefined" && isOwner());

  // A key that works proves this is Ghanshyam's browser, so stop counting its visits.
  const markOwner = useCallback(() => {
    setOwner(true);
    setOwnerState(true);
  }, []);

  const toggleOwner = useCallback(() => {
    const next = !isOwner();
    setOwner(next);
    setOwnerState(next);
  }, []);

  // First load: with the remembered key if there is one, else the public view.
  useEffect(() => {
    let alive = true;
    const saved = readKey();
    void (async () => {
      try {
        let r = await fetchStats(saved);
        if (!r.ok && saved) {
          saveKey(null);
          r = await fetchStats(null);
        }
        if (!alive) return;
        if (r.ok) {
          setStats(r.data);
          if (r.data.full) markOwner();
        } else setError(r.data.error ?? "Could not load.");
      } catch {
        if (alive) setError("Could not reach the server.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [markOwner]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetchStats(readKey());
      if (r.ok) setStats(r.data);
    } finally {
      setBusy(false);
    }
  }, []);

  const unlock = useCallback(async () => {
    setBusy(true);
    setUnlockError("");
    try {
      const r = await fetchStats(key);
      if (r.ok) {
        saveKey(key);
        setStats(r.data);
        setKey("");
        markOwner();
      } else {
        setUnlockError(r.data.error ?? "Wrong key.");
      }
    } catch {
      setUnlockError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }, [key, markOwner]);

  /** Takes entries off the lists for good; `vid` removes everything one browser left. */
  const remove = useCallback(
    async (what: { visits?: string[]; questions?: string[]; messages?: string[]; vid?: string }, confirmText?: string) => {
      if (confirmText && !window.confirm(confirmText)) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/stats", {
          method: "DELETE",
          headers: { "content-type": "application/json", "x-admin-key": readKey() ?? "" },
          body: JSON.stringify(what),
        });
        if (!res.ok) window.alert((await res.json().catch(() => null))?.error ?? "Couldn't remove it.");
        const r = await fetchStats(readKey());
        if (r.ok) setStats(r.data);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const lock = useCallback(() => {
    saveKey(null);
    setStats((s) => (s ? { ...s, full: false, visits: [], recentQuestions: [] } : s));
  }, []);

  if (!stats) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f4f6] p-6 text-[#16181c]">
        <p className="text-[15px] text-black/55">{error || "Loading…"}</p>
      </main>
    );
  }

  const max = Math.max(1, ...stats.perDay.map((d) => d.n));
  return (
    <main className="min-h-screen bg-[#f3f4f6] px-5 py-8 text-[#16181c] sm:px-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-medium tracking-[-0.02em]">Visitors</h1>
          <div className="flex items-center gap-2">
            {stats.full && (
              <button
                onClick={() => void remove({ vid: visitorId() }, "Remove every visit, question and message this browser left? This can't be undone.")}
                className="rounded-full border border-black/15 px-4 py-1.5 text-[14px]"
              >
                Remove my entries
              </button>
            )}
            {stats.full ? (
              <button onClick={lock} className="rounded-full border border-black/15 px-4 py-1.5 text-[14px]">
                Lock this browser
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void unlock();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Admin key for details"
                  className="w-[190px] rounded-full border border-black/15 bg-white px-3 py-1.5 text-[14px] outline-none focus:border-black/40"
                />
                <button disabled={!key || busy} className="rounded-full bg-[#16181c] px-4 py-1.5 text-[14px] text-white disabled:opacity-40">
                  Unlock
                </button>
              </form>
            )}
            <button onClick={() => void refresh()} className="rounded-full border border-black/15 px-4 py-1.5 text-[14px]">
              {busy ? "…" : "Refresh"}
            </button>
          </div>
        </div>
        {unlockError && <p className="mt-2 text-right text-[13px] text-[#b4232a]">{unlockError}</p>}
        {(
          <p className="mt-2 text-right text-[13px] text-black/50">
            {owner ? "Your visits from this browser are not counted." : "Visits from this browser are being counted."}{" "}
            <button onClick={toggleOwner} className="underline">
              {owner ? "Count them again" : "Don't count this browser"}
            </button>
          </p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { k: stats.total, v: "visits" },
            { k: stats.unique, v: "unique visitors" },
            { k: stats.questions, v: "questions to Elio" },
          ].map((s) => (
            <div key={s.v} className="rounded-[14px] border border-black/[0.07] bg-white p-4">
              <div className="text-[28px] font-medium tabular-nums">{s.k}</div>
              <div className="text-[13px] text-black/50">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[14px] border border-black/[0.07] bg-white p-4">
          <h3 className="text-[13px] font-medium uppercase tracking-[0.12em] text-black/45">Last 30 days</h3>
          <div className="mt-3 flex h-[120px] items-end gap-1">
            {stats.perDay.map((d) => (
              <div key={d.d} title={`${d.d}: ${d.n}`} className="flex-1 rounded-t-[3px] bg-[#2f6fed]/70" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 3 : 1 }} />
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Bars title="Countries" rows={stats.country} />
          <Bars title="Cities" rows={stats.city} />
          <Bars title="Referrers" rows={stats.ref} />
          <Bars title="Devices" rows={stats.device} />
          <Bars title="Browsers" rows={stats.browser} />
          <Bars title="Systems" rows={stats.os} />
        </div>

        {stats.full && (
          <>
            <h2 className="mt-8 text-[20px] font-medium">Recent visits</h2>
            <div className="mt-3 overflow-x-auto rounded-[14px] border border-black/[0.07] bg-white">
              <table className="w-full min-w-[860px] text-left text-[13px]">
                <thead className="text-black/45">
                  <tr>
                    {["When", "Name", "Where", "IP", "Device", "Page", "From", "Lang", "Screen", "", " "].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.visits.map((v) => (
                    <tr key={v.id} className="border-t border-black/[0.06]">
                      <td className="whitespace-nowrap px-3 py-2">{when(v.t)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{v.name ?? <span className="text-black/35">—</span>}</td>
                      <td className="px-3 py-2">{flag(v.country)} {[v.city, v.region, v.country].filter(Boolean).join(", ") || "Unknown"}</td>
                      <td className="px-3 py-2 font-mono text-[12px]">{v.ip ?? <span className="text-black/35">expired</span>}</td>
                      <td className="px-3 py-2">{v.kind} · {v.os} · {v.browser}</td>
                      <td className="px-3 py-2">{v.path}</td>
                      <td className="px-3 py-2">{v.ref || "Direct"}</td>
                      <td className="px-3 py-2">{v.lang}</td>
                      <td className="px-3 py-2">{v.screen}</td>
                      <td className="px-3 py-2 text-black/45">{v.returning ? "returning" : "new"}</td>
                      <td className="px-3 py-2">
                        <X onClick={() => void remove({ visits: [v.id] })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-8 text-[20px] font-medium">Messages left with Elio</h2>
            <ul className="mt-3 space-y-2">
              {(stats.messages ?? []).map((m, i) => (
                <li key={i} className="rounded-[14px] border border-black/[0.07] bg-white p-4">
                  <div className="flex justify-between gap-3 text-[12px] text-black/45">
                    <span>
                    {when(m.t)} · {flag(m.country ?? "")} {m.name || "No name"} · <span className="font-mono">{m.contact}</span>
                    {m.via ? ` · via ${m.via === "form" ? "the Message him form" : "chat with Elio"}` : ""}
                    </span>
                    <X onClick={() => void remove({ messages: [m.t] })} />
                  </div>
                  <p className="mt-1 text-[15px]">{m.message}</p>
                </li>
              ))}
              {!stats.messages?.length && <li className="text-[14px] text-black/40">No messages yet.</li>}
            </ul>

            <h2 className="mt-8 text-[20px] font-medium">Who talked to Elio</h2>
            <ul className="mt-3 space-y-2">
              {people(stats.recentQuestions).map((p, i) => (
                <li key={i} className="rounded-[14px] border border-black/[0.07] bg-white p-4">
                  <div className="flex justify-between gap-3 text-[12px] text-black/45">
                    <span>
                      {when(p.last)} · {p.place || "Unknown"} · {p.n} question{p.n === 1 ? "" : "s"}
                    </span>
                    <X label="Remove all" onClick={() => void remove({ vid: p.vid }, `Remove everything from ${p.name || "this visitor"}?`)} />
                  </div>
                  <p className="mt-1 text-[15px] font-medium">{p.name || "Didn't give a name"}</p>
                  {p.notes.length > 0 && <p className="mt-1 text-[14px] text-black/60">{p.notes.join(" · ")}</p>}
                </li>
              ))}
              {!people(stats.recentQuestions).length && <li className="text-[14px] text-black/40">No conversations yet.</li>}
            </ul>

            <h2 className="mt-8 text-[20px] font-medium">What people asked Elio</h2>
            <ul className="mt-3 space-y-2">
              {stats.recentQuestions.map((q, i) => (
                <li key={i} className="rounded-[14px] border border-black/[0.07] bg-white p-4">
                  <div className="flex justify-between gap-3 text-[12px] text-black/45">
                    <span>
                      {when(q.t)} · {flag(q.country)} {[q.city, q.country].filter(Boolean).join(", ")}
                      {q.name ? ` · ${q.name}` : ""}
                      {q.jd ? " · job fit" : ""}
                    </span>
                    <span className="flex gap-3">
                      {(q.ms / 1000).toFixed(1)}s
                      <X onClick={() => void remove({ questions: [q.t] })} />
                    </span>
                  </div>
                  <p className="mt-1 text-[15px] font-medium">{q.q}</p>
                  <p className="mt-1 text-[14px] text-black/60">{q.a}</p>
                </li>
              ))}
              {!stats.recentQuestions.length && <li className="text-[14px] text-black/40">No questions yet.</li>}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
