import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { IDENTITY } from "@/data/assistant-knowledge";
import { PROJECT_DETAILS } from "@/data/project-details";
import { KEEP, pipeline } from "@/lib/kv";

/**
 * The few things Elio can go and do mid-answer, beyond what it already knows.
 *
 * Each costs a second model call (Elio asks, the tool answers, Elio speaks),
 * so the set is small and every result is short and cached: the in-depth
 * notes on one project, a repo's facts, a look at its code, and a note left
 * for Ghanshyam. Showing a project or
 * offering the résumé needs no tool at all; Elio writes a tag the page acts
 * on, which costs nothing extra.
 */

const USER = IDENTITY.github.replace(/\/+$/, "").split("/").pop() ?? "";
const HOUR = 60 * 60 * 1000;
const cache = new Map<string, { at: number; text: string }>();

async function cached(key: string, make: () => Promise<string>): Promise<string> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < HOUR) return hit.text;
  const text = await make();
  cache.set(key, { at: Date.now(), text });
  return text;
}

/** Unauthenticated GitHub allows sixty calls an hour; a token lifts that. */
const gh = (path: string, raw = false) =>
  fetch(`https://api.github.com${path}`, {
    headers: {
      accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
      "user-agent": "pix-portfolio",
      ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(4000),
  });

/** Repo names are his own; anything else is refused before it reaches GitHub. */
const safeName = (s: unknown) => (typeof s === "string" && /^[\w.-]{1,100}$/.test(s) ? s : "");
const safePath = (s: unknown) =>
  typeof s === "string" && s.length < 200 && !s.includes("..") && /^[\w./ -]*$/.test(s) ? s.replace(/^\/+/, "") : "";

async function githubRepo(input: { repo?: unknown }): Promise<string> {
  const repo = safeName(input.repo);
  if (!repo) {
    return cached("repos", async () => {
      const res = await gh(`/users/${USER}/repos?sort=pushed&per_page=30`);
      if (!res.ok) return "GitHub is not answering right now.";
      const list = (await res.json()) as { name: string; description: string | null; fork: boolean; stargazers_count: number; pushed_at: string }[];
      return list
        .filter((r) => !r.fork)
        .map((r) => `${r.name}: ${r.description ?? "no description"} (★${r.stargazers_count}, updated ${r.pushed_at.slice(0, 10)})`)
        .join("\n");
    });
  }
  return cached(`repo:${repo}`, async () => {
    const [meta, readme] = await Promise.all([gh(`/repos/${USER}/${repo}`), gh(`/repos/${USER}/${repo}/readme`, true)]);
    if (!meta.ok) return `No public repo called ${repo}. Call github_repo with no name to list them.`;
    const r = (await meta.json()) as { description: string | null; language: string | null; stargazers_count: number; forks_count: number; pushed_at: string; created_at: string; topics?: string[]; html_url: string };
    const text = readme.ok ? (await readme.text()).replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").slice(0, 1500) : "(no README)";
    return [
      `${repo} — ${r.description ?? "no description"}`,
      `Language: ${r.language ?? "?"}; ★${r.stargazers_count}, forks ${r.forks_count}; created ${r.created_at.slice(0, 10)}, last push ${r.pushed_at.slice(0, 10)}`,
      r.topics?.length ? `Topics: ${r.topics.join(", ")}` : "",
      `README (start):\n${text}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
}

async function readProjectCode(input: { repo?: unknown; path?: unknown }): Promise<string> {
  const repo = safeName(input.repo);
  if (!repo) return "Give the repo name (github_repo with no name lists them).";
  const path = safePath(input.path ?? "");
  return cached(`code:${repo}:${path}`, async () => {
    const res = await gh(`/repos/${USER}/${repo}/contents/${encodeURI(path)}`);
    if (!res.ok) return `Nothing at ${path || "the top"} of ${repo}.`;
    const body = (await res.json()) as unknown;
    // A folder: its entries, so Elio can pick the file worth opening.
    if (Array.isArray(body)) {
      return `${repo}/${path || ""} contains:\n` + body.map((e: { name: string; type: string }) => `${e.type === "dir" ? "📁" : "📄"} ${e.name}`).join("\n");
    }
    const file = body as { content?: string; encoding?: string; size?: number; name?: string };
    if (!file.content || file.encoding !== "base64") return "That file can't be read as text.";
    const code = Buffer.from(file.content, "base64").toString("utf8");
    // Enough to explain how it works; never the whole of a long file.
    return `${repo}/${path} (${code.length} chars, first part):\n${code.slice(0, 2500)}`;
  });
}

/** Saves a visitor's message for the dashboard; used by Elio's tool and the contact form. */
export async function saveMessage(entry: { name: string; contact: string; message: string; vid?: string; country?: string; via: string }): Promise<boolean> {
  const ok = await pipeline([
    ["LPUSH", "messages", JSON.stringify({ t: new Date().toISOString(), ...entry })],
    ["LTRIM", "messages", 0, KEEP - 1],
    ["INCR", "count:messages"],
  ]);
  return Boolean(ok);
}

async function leaveMessage(input: { name?: unknown; contact?: unknown; message?: unknown }, meta: { vid?: string; country?: string }): Promise<string> {
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const message = str(input.message, 1000);
  const contact = str(input.contact, 200);
  if (!message) return "No message to pass on.";
  if (!contact) return "Ask how Ghanshyam should reply (an email or a phone number) before passing it on.";
  const ok = await saveMessage({ name: str(input.name, 80), contact, message, vid: meta.vid, country: meta.country, via: "Elio" });
  return ok ? "Passed on. Ghanshyam will see it on his dashboard." : "Couldn't save it just now; suggest emailing him instead.";
}

/** The in-depth notes on one project, read from its code. No network, so it answers at once. */
function projectDetails(input: { project?: unknown }): string {
  const key = typeof input.project === "string" ? input.project : "";
  return PROJECT_DETAILS[key] ?? `No notes called ${key}. Known: ${Object.keys(PROJECT_DETAILS).join(", ")}.`;
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "project_details",
    description:
      "In-depth notes on one of his projects, written from reading its code: architecture, models and settings, data, how each part works, results and numbers, tests, trade-offs. Use it before answering any detailed question about how a project was built, what it uses or how well it works. Faster and fuller than the GitHub tools. \"other-repos\" covers his smaller and older repos.",
    input_schema: {
      type: "object",
      properties: { project: { type: "string", enum: Object.keys(PROJECT_DETAILS) } },
      required: ["project"],
    },
  },
  {
    name: "github_repo",
    description:
      "Live facts about one of Ghanshyam's public GitHub repos: description, language, stars, last push and the start of its README. With no repo, lists all his repos. Use when asked about a specific project's code, activity or details you don't already know.",
    input_schema: { type: "object", properties: { repo: { type: "string", description: "Exact repo name; omit to list them all." } } },
  },
  {
    name: "read_project_code",
    description:
      "Reads a folder listing or the start of a source file in one of his repos, to explain how something is actually built. Start from the top (no path) to find the right file; open at most one or two files.",
    input_schema: {
      type: "object",
      properties: { repo: { type: "string" }, path: { type: "string", description: "File or folder path inside the repo; empty for the top." } },
      required: ["repo"],
    },
  },
  {
    name: "leave_message",
    description:
      "Passes a message from the visitor to Ghanshyam (saved to his dashboard). Only when they ask to contact him or leave a note, and only once you have their message and a way to reply (email or phone).",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" }, contact: { type: "string", description: "Email or phone to reply to." }, message: { type: "string" } },
      required: ["contact", "message"],
    },
  },
];

export async function runTool(name: string, input: unknown, meta: { vid?: string; country?: string }): Promise<string> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  try {
    if (name === "project_details") return projectDetails(args);
    if (name === "github_repo") return await githubRepo(args);
    if (name === "read_project_code") return await readProjectCode(args);
    if (name === "leave_message") return await leaveMessage(args, meta);
    return `No tool called ${name}.`;
  } catch (error) {
    console.error(`[tool:${name}]`, error);
    return "That didn't work just now.";
  }
}
