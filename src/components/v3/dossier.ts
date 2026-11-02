/**
 * Everything the site knows about Ghanshyam, arranged for one screen.
 *
 * A conversation is a good way to meet someone and a poor way to audit them.
 * This is the other half: every project, certificate, tool, qualification and
 * link, in one list that can be read top to bottom, searched, or jumped into
 * from a URL — and every row has a card the character can put on its screen.
 *
 * It is built from `src/data/portfolio.ts` rather than restating it, so the
 * three designs cannot drift apart. The only thing written here is the
 * headline figure for each project, because a number on a screen is a claim
 * and each one has to be a claim its project actually supports.
 */

import {
  certifications,
  education,
  profile,
  projects,
  skills,
  social,
  volunteering, certSkills } from "@/data/portfolio";
import type { Panel } from "@/components/v3/face";

export type Item = {
  id: string;
  /** Which list it belongs to. */
  section: SectionName;
  title: string;
  /** The grey line under the title in the list. */
  meta: string;
  /** Shown when the row is opened. */
  body?: string;
  href?: string;
  linkLabel?: string;
  chips?: string[];
  /** What the character's screen shows while this row is under the cursor. */
  panel: Panel;
};

export type SectionName =
  | "The work"
  | "Certifications"
  | "Toolkit"
  | "Background"
  | "Elsewhere";

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ── The work ─────────────────────────────────────────────────────────── */

type Headline = { metric: string; label: string };

const HEADLINES: Record<string, Headline> = {
  Innerbloom: { metric: "100%", label: "local · zero telemetry" },
  "Living NPCs": { metric: "45%", label: "engagement lift" },
  "Super Resolution": { metric: "4×", label: "upscale, prompt-guided" },
  "F1 Predictor": { metric: "20", label: "driver grid, ranked" },
  "Sign Translator": { metric: "100", label: "BSL words, own dataset" },
  "Carbon Watcher": { metric: "CO₂", label: "per training run and LLM call" },
  "Falcon 9 Predictor": { metric: "1st", label: "stage landing, predicted" },
  Zeul: { metric: "2 wks", label: "two devs, each with an AI agent" },
  "Piano Tutor": { metric: "88", label: "keys, any MIDI keyboard" },
};

const work: Item[] = projects.map((p) => {
  const h = HEADLINES[p.displayTitle] ?? { metric: p.year, label: p.category };
  return {
    id: slugify(p.displayTitle),
    section: "The work" as const,
    title: p.displayTitle,
    meta: `${p.category} · ${p.year} · ${h.metric}`,
    body: p.description,
    href: p.href,
    linkLabel: p.href?.includes("github.com") ? "Open the repo" : "Try it live",
    chips: p.tags,
    panel: {
      kicker: `${p.category} · ${p.year}`,
      title: p.displayTitle,
      metric: h.metric,
      metricLabel: h.label,
      chips: p.tags,
      image: p.image,
    },
  };
});

/* ── Certifications ───────────────────────────────────────────────────── */

const certs: Item[] = certifications.map((c) => ({
  id: slugify(c.note ?? c.name),
  section: "Certifications" as const,
  title: c.note ?? c.name,
  meta: [c.issuer, c.year].filter(Boolean).join(" · ") || "Certificate",
  body: c.note && c.note !== c.name ? c.name : undefined,
  href: c.href,
  linkLabel: c.href ? "Verify it" : undefined,
  panel: {
    kicker: `Certification · ${c.issuer ?? "Verified"}`,
    title: c.note ?? c.name,
    // What it taught, on the screen, two to a line.
    lines: chunk(certSkills[c.note ?? c.name] ?? [c.name], 2).map((row) => row.join("  ·  ")),
    chips: [c.issuer, c.year].filter(Boolean) as string[],
  },
}));

/* ── Toolkit ──────────────────────────────────────────────────────────── */

const toolkit: Item[] = Object.entries(skills).map(([group, items]) => ({
  id: slugify(group),
  section: "Toolkit" as const,
  title: group,
  meta: `${items.length} tools · ${items.slice(0, 3).join(", ")}`,
  body: items.join(" · "),
  chips: items,
  panel: {
    kicker: `Toolkit · ${items.length} tools`,
    title: group,
    // Four to a line keeps it readable at the size the screen is drawn.
    lines: chunk(items, 4).map((row) => row.join("  ·  ")),
    chips: items.slice(0, 4),
  },
}));

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/* ── Background ───────────────────────────────────────────────────────── */

const background: Item[] = [
  {
    id: "experience",
    section: "Background",
    title: "LLM Engineer, Sigma AI",
    meta: "London · Apr 2024 – Sep 2026",
    body: "Built LLM-powered applications end to end for 300+ daily users: LangGraph workflows with tool use and retrieval for grounding, evaluation frameworks with golden datasets scoring accuracy and hallucinations before every release, and Python APIs and data pipelines traced with Langfuse and OpenTelemetry; analysis 30% faster, error rates down 12%.",
    panel: {
      kicker: "Experience",
      title: "Sigma AI",
      lines: ["LLM Engineer", `Now: ${profile.title}`],
      chips: ["LLM apps", "Agents", "Evaluation"],
    },
  },
  {
    id: "vec",
    section: "Background",
    title: "Data Scientist Intern, Virtual Engineering Centre",
    meta: "Liverpool · Oct 2023 – Mar 2024",
    body: "Built OpenAI-powered case-study processing into a live business workflow at the University of Liverpool's Virtual Engineering Centre, cutting manual processing by about 60%, reported through Power BI dashboards.",
    panel: {
      kicker: "Experience",
      title: "Virtual Engineering Centre",
      lines: ["Data Scientist Intern", "Generative AI · Power BI"],
      chips: ["GenAI", "Python", "Power BI"],
    },
  },
  {
    id: "zummit",
    section: "Background",
    title: "Data Scientist, Zummit Infolabs",
    meta: "Bangalore · Feb 2021 – Oct 2021",
    body: "Built a UNet model in PyTorch for MRI image segmentation, improving cancer detection accuracy by 15%, with end-to-end preprocessing and deployment pipelines that cut training time by 20%.",
    panel: {
      kicker: "Experience",
      title: "Zummit Infolabs",
      lines: ["Data Scientist", "MRI segmentation · UNet"],
      chips: ["PyTorch", "UNet", "CV"],
    },
  },
  {
    id: "education",
    section: "Background",
    title: education.degree,
    meta: education.university,
    body: `${education.degree}, ${education.university}.`,
    panel: {
      kicker: "Education",
      title: education.university,
      lines: [education.degree],
      chips: ["MSc", "Data Science", "AI"],
    },
  },
  {
    id: "be",
    section: "Background",
    title: "B.E. Mechanical Engineering",
    meta: "Raisoni College, RTMNU",
    body: "B.E. in Mechanical Engineering from Raisoni College, Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur.",
    panel: {
      kicker: "Education",
      title: "Raisoni College",
      lines: ["B.E. Mechanical Engineering", "Raisoni College, RTMNU"],
      chips: ["Engineering"],
    },
  },
  {
    id: "volunteering",
    section: "Background",
    title: volunteering.org,
    meta: volunteering.role,
    body: `${volunteering.role} at ${volunteering.org}, across ${volunteering.focus
      .join(", ")
      .toLowerCase()}.`,
    chips: volunteering.focus,
    panel: {
      kicker: "Volunteering",
      title: volunteering.org,
      lines: [volunteering.role],
      chips: volunteering.focus,
    },
  },
];

/* ── Elsewhere ────────────────────────────────────────────────────────── */

const LINK_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  medium: "Medium",
  blog: "Blog",
  instagram: "Instagram",
  buymeacoffee: "Buy him a coffee",
  spotify: "Spotify",
};

/** A picture of the page itself, shown on the screen while its link is
    under the pointer. LinkedIn and Instagram hide profiles behind a sign-in,
    so those two are his own screenshots. */
const PREVIEWS = new Set(["linkedin", "github", "medium", "blog", "instagram", "spotify", "buymeacoffee"]);

const elsewhere: Item[] = Object.entries(social).map(([key, href]) => ({
  id: key,
  section: "Elsewhere" as const,
  title: LINK_LABELS[key] ?? key,
  meta: href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
  href,
  linkLabel: "Open it",
  panel: {
    kicker: "Elsewhere",
    title: LINK_LABELS[key] ?? key,
    lines: [href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")],
    image: PREVIEWS.has(key) ? `/previews/${key}.jpg` : undefined,
    whole: PREVIEWS.has(key),
  },
}));

/* ── Assembled ────────────────────────────────────────────────────────── */

export const SECTIONS: { name: SectionName; items: Item[] }[] = [
  { name: "The work", items: work },
  { name: "Certifications", items: certs },
  { name: "Toolkit", items: toolkit },
  { name: "Background", items: background },
  { name: "Elsewhere", items: elsewhere },
];

/** Flat, in the order the list shows them: the index the keyboard moves over. */
export const ITEMS: Item[] = SECTIONS.flatMap((s) => s.items);

export const BY_ID: Record<string, Item> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
);

/** Named lookup for the turns that illustrate themselves. */
export const BY_TITLE: Record<string, Item> = Object.fromEntries(
  ITEMS.map((i) => [i.title, i]),
);

export const WORK = work;

/** A greeting card, once the visitor has given a name. */
export const greetingPanel = (name: string): Panel => ({
  kicker: "Now talking to",
  title: name,
  lines: ["Welcome in."],
  chips: [profile.location, profile.status],
});

export const STATS_PANEL = background[2].panel;
