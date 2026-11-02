#!/usr/bin/env node
/**
 * Snapshots Ghanshyam's public GitHub repositories into
 * src/data/github-snapshot.json, which goes into Elio's knowledge.
 *
 * For each repository that is not a fork: its languages, its description,
 * and the opening of its README, cleaned of markdown. Elio uses this to back
 * up a skill with a repository ("yes, his face-mask detector is in Python
 * with OpenCV") and to know about repos the portfolio does not feature.
 *
 *   node scripts/sync-github.mjs
 *
 * Unauthenticated GitHub allows sixty requests an hour; this makes about
 * forty, so run it by hand when the repos change, then commit the file.
 * Set GITHUB_TOKEN to lift the limit.
 */
import { writeFileSync } from "node:fs";

const USER = "GhanshyamPaunikar";
const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "pix-portfolio-sync",
  ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

class Missing extends Error {}

async function get(url, raw = false) {
  const res = await fetch(url, { headers: raw ? { ...headers, accept: "application/vnd.github.raw" } : headers });
  // A repo with no README is normal; running out of requests is not, and
  // must stop the run rather than quietly write a snapshot with holes in it.
  if (res.status === 404) throw new Missing(url);
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    const mins = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : "a few";
    console.error(`\nGitHub's hourly limit is used up; nothing was written. Try again in ${mins} minutes, or set GITHUB_TOKEN.`);
    process.exit(1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return raw ? res.text() : res.json();
}

const orEmpty = (fallback) => (err) => {
  if (err instanceof Missing) return fallback;
  throw err;
};

/** The first prose of a README, without markdown, badges, code or HTML. */
function gist(md) {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s|]+/, "").replace(/[*_`|]/g, "").trim())
    .filter((l) => l.length > 25 && !/^(table of contents|installation|license|usage)/i.test(l))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 320 ? `${text.slice(0, 317).replace(/\s+\S*$/, "")}…` : text;
}

const repos = (await get(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`)).filter(
  (r) => !r.fork && r.name !== USER,
);

const out = [];
for (const r of repos) {
  const langs = Object.keys(await get(r.languages_url).catch(orEmpty({}))).slice(0, 5);
  const readme = await get(`https://api.github.com/repos/${USER}/${r.name}/readme`, true).catch(orEmpty(""));
  out.push({
    name: r.name,
    url: r.html_url,
    description: r.description ?? "",
    languages: langs,
    topics: r.topics ?? [],
    readme: gist(readme),
    updated: r.pushed_at.slice(0, 10),
  });
  process.stdout.write(`✓ ${r.name} [${langs.join(", ")}]\n`);
}

writeFileSync(
  new URL("../src/data/github-snapshot.json", import.meta.url),
  JSON.stringify({ takenAt: new Date().toISOString().slice(0, 10), user: USER, repos: out }, null, 2) + "\n",
);
console.log(`\n${out.length} repositories written.`);
