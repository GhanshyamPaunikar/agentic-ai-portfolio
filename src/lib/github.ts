import "server-only";

import { IDENTITY } from "@/data/assistant-knowledge";

/**
 * What Ghanshyam has been working on lately, straight from GitHub.
 *
 * Only fetched when a question is about recent or current work, and cached
 * for an hour: unauthenticated GitHub allows sixty requests an hour per
 * server, and a portfolio does not need fresher than that.
 */
const ASKS_ABOUT_NOW = /\b(github|latest|recent(ly)?|new(est)?|currently|these days|right now|working on|building now|repos?|side projects?)\b/i;
const USER = IDENTITY.github.replace(/\/+$/, "").split("/").pop() ?? "";
const HOUR = 60 * 60 * 1000;

let cache: { at: number; note: string } | null = null;

type Repo = { name: string; description: string | null; pushed_at: string; fork: boolean; language: string | null };

export async function githubNote(question: string): Promise<string> {
  if (!ASKS_ABOUT_NOW.test(question) || !USER) return "";
  if (cache && Date.now() - cache.at < HOUR) return cache.note;
  try {
    const res = await fetch(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=8`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "pix-portfolio" },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return "";
    const repos = ((await res.json()) as Repo[]).filter((r) => !r.fork).slice(0, 5);
    const lines = repos.map(
      (r) =>
        `${r.name}${r.language ? ` [${r.language}]` : ""}: ${r.description ?? "no description"} (updated ${r.pushed_at.slice(0, 10)})`,
    );
    const note = lines.length ? `(Live from GitHub, most recently updated: ${lines.join("; ")}.)` : "";
    cache = { at: Date.now(), note };
    return note;
  } catch {
    return "";
  }
}
