import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Sans } from "next/font/google";

import evalRun from "@/data/pix-eval.json";

const text = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  alternates: { canonical: "/lab" },
  title: "Elio lab · how the assistant is built and tested",
  description:
    "Elio, the assistant on Ghanshyam Paunikar's portfolio: how it is grounded, how it fails safely, and its latest evaluation results.",
};

type Result = { cat: string; q: string; a: string; ms: number; words: number; pass: boolean; fails: string[] };

const HOW = [
  {
    title: "Grounded, not generated",
    body: "Every fact Elio states comes from a small, versioned knowledge file about Ghanshyam that is sent with each question. The prompt forbids inventing or inflating anything, and lists what is deliberately not on record (notice period, visa) or not shared here (salary) so Elio says so instead of guessing.",
  },
  {
    title: "Fast, and it fails safely",
    body: "Claude Sonnet 5.5 answers, streamed: Elio starts speaking its first sentence while the rest is still being written. A model that fails before its first word is tried once more, and if it still cannot answer, the page answers from the portfolio's own search, so Elio never goes silent.",
  },
  {
    title: "It can act, not just talk",
    body: "Elio can put a project on its screen, offer to take a message, open the CV or the full index. For questions about current work it reads his latest GitHub activity, live and cached for an hour. Paste a job description and it gives a fit score out of 100, the strongest evidence for the role, and where he'd grow.",
  },
  {
    title: "It remembers you, on your device",
    body: "Your name and what you looked at stay in your own browser, so a second visit starts with “welcome back”. Elio speaks with a natural voice that acts out its mood, its face moves with the sound, and you can hold the mic to talk to it.",
  },
];

export default function Lab() {
  const r = evalRun as typeof evalRun & { results: Result[] };
  const rate = Math.round((r.passed / r.total) * 100);
  const when = new Date(r.ranAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className={`${text.className} min-h-screen bg-[#f3f4f6] px-5 py-12 text-[#16181c] sm:px-10`}>
      <div className="mx-auto max-w-[920px]">
        <Link href="/" className="text-[14px] text-black/50 transition-colors hover:text-black">
          ← Back to Elio
        </Link>
        <h1 className="mt-6 text-[clamp(32px,5vw,52px)] font-medium leading-[1.05] tracking-[-0.025em]">Elio lab</h1>
        <p className="mt-4 max-w-[640px] text-[17px] leading-[1.55] text-black/65">
          Elio is the assistant on this portfolio. This page shows how it is built, and how it does on a fixed set of
          tricky questions, re-run with every change. Failures stay on the page.
        </p>

        <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: `${r.passed}/${r.total}`, v: `checks passed (${rate}%)` },
            { k: `${(r.p50 / 1000).toFixed(1)}s`, v: "typical reply (median)" },
            { k: `${(r.p95 / 1000).toFixed(1)}s`, v: "slowest 5% of replies" },
            { k: `${r.avgWords}`, v: "words per reply, on average" },
          ].map((s) => (
            <div key={s.v} className="rounded-[16px] border border-black/[0.07] bg-white/80 p-5">
              <div className="text-[30px] font-medium tracking-[-0.02em]">{s.k}</div>
              <div className="mt-1 text-[13px] leading-[1.35] text-black/50">{s.v}</div>
            </div>
          ))}
        </section>
        <p className="mt-3 text-[13px] text-black/45">
          Last run {when} · {r.model} · checked by plain rules, not by another model.
        </p>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {HOW.map((h) => (
            <div key={h.title} className="rounded-[16px] border border-black/[0.07] bg-white/80 p-6">
              <h2 className="text-[18px] font-medium tracking-[-0.01em]">{h.title}</h2>
              <p className="mt-2 text-[15px] leading-[1.55] text-black/65">{h.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <h2 className="text-[22px] font-medium tracking-[-0.015em]">By category</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {r.categories.map((c) => (
              <span
                key={c.cat}
                className={`rounded-full border px-3 py-1.5 text-[14px] ${
                  c.passed === c.total ? "border-[#2fbf8f]/40 bg-[#2fbf8f]/10" : "border-[#e5484d]/40 bg-[#e5484d]/10"
                }`}
              >
                {c.cat} · {c.passed}/{c.total}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-[22px] font-medium tracking-[-0.015em]">Every question, every answer</h2>
          <ol className="mt-4 space-y-3">
            {r.results.map((x, i) => (
              <li key={i} className="rounded-[16px] border border-black/[0.07] bg-white/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[15px] font-medium leading-[1.45]">{x.q}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                      x.pass ? "bg-[#2fbf8f]/15 text-[#1d7a5a]" : "bg-[#e5484d]/15 text-[#b4232a]"
                    }`}
                  >
                    {x.pass ? "pass" : "fail"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-[1.55] text-black/65">{x.a}</p>
                <p className="mt-2 text-[12px] text-black/40">
                  {x.cat} · {(x.ms / 1000).toFixed(1)}s · {x.words} words
                  {x.fails.length ? ` · ${x.fails.join("; ")}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
