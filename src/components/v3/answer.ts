/**
 * Answering a typed question from the file, without a model.
 *
 * The site has an LLM route, and on a free tier it is rate-limited, needs a
 * key the deployment does not currently have, and will happily invent a
 * certificate Ghanshyam does not hold. For a portfolio that last part is not
 * a quirk, it is the whole risk: the one thing a recruiter must be able to
 * trust is that the claims are real.
 *
 * So the answers are retrieved, not generated. Every sentence returned here
 * is assembled from `src/data/portfolio.ts`. It cannot be eloquent about
 * something that is not in the file, which is exactly the behaviour wanted —
 * when it finds nothing it says so and offers the index instead.
 */

import type { Mood } from "@/components/v3/face";
import { profile } from "@/data/portfolio";
import { ITEMS, type Item } from "@/components/v3/dossier";

export type Answer = {
  /** What the assistant says. One or two short paragraphs. */
  lines: string[];
  /** What the screen shows alongside, if anything matched. */
  item?: Item;
  /** Other rows worth offering, as pills. */
  also: Item[];
  /** Buttons Elio chose to offer: message him, open the CV, and so on. */
  actions?: PixAction[];
  /** How Elio feels about this answer; the face and the voice follow it. */
  mood?: Mood;
  /**
   * The mood of each line, when the feeling turns partway through a reply
   * ("[excited] But he has shipped..."). Same length as lines; unset means
   * every line takes `mood`.
   */
  moods?: Mood[];
  /** True where a line continues the bubble above it (same paragraph). */
  joins?: boolean[];
  /** Still arriving: more lines will follow. */
  pending?: boolean;
  /** Which question this answers; the same while it streams in. */
  turn?: number;
  /** Questions the visitor might ask next, offered as quick replies. */
  next?: string[];
};

/** A button Elio can offer; "read:<id>" opens one of his articles. */
export type PixAction = "contact" | "resume" | "index" | "github" | "linkedin" | "medium" | `read:${string}`;

/** Words that match everything and therefore distinguish nothing. */
const STOP = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "can", "did", "do", "does",
  "for", "from", "has", "have", "he", "her", "him", "his", "how", "i", "in",
  "is", "it", "its", "me", "much", "of", "on", "or", "s", "she", "show", "so",
  "some", "tell", "that", "the", "their", "them", "there", "they", "this",
  "to", "use", "used", "was", "what", "when", "where", "which", "who", "why",
  "with", "work", "worked", "you", "your", "ghanshyam", "about",
]);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .split(/[\s/]+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Everything about an item that a question might be aimed at. */
const haystack = (i: Item) =>
  [i.title, i.meta, i.body ?? "", (i.chips ?? []).join(" "), i.section].join(" ").toLowerCase();

/**
 * Intents worth catching before retrieval.
 *
 * "Is he any good?" matches nothing by word overlap and is one of the two or
 * three things anyone actually wants to ask, so these are answered directly.
 */
const INTENTS: { test: RegExp; answer: (name?: string) => Answer }[] = [
  {
    test: /\b(hire|hiring|available|availability|open to|looking for work|notice|start|join)\b/,
    answer: () => ({
      lines: [
        `${profile.status}. He is in ${profile.location}, working ${profile.timezone}, and is looking for remote roles, or hybrid and on-site in Pune.`,
        `The fastest route is ${profile.email}. He reads those himself.`,
      ],
      item: ITEMS.find((i) => i.id === "experience"),
      also: ITEMS.filter((i) => i.id === "zummit" || i.id === "experience"),
    }),
  },
  {
    test: /\b(contact|email|reach|get in touch|message|linkedin|github)\b/,
    answer: () => ({
      lines: [
        `${profile.email} reaches him directly.`,
        "LinkedIn and GitHub are both in the index, along with the writing.",
      ],
      item: ITEMS.find((i) => i.id === "linkedin"),
      also: ITEMS.filter((i) => i.section === "Elsewhere").slice(0, 3),
    }),
  },
  {
    test: /\b(study|studied|degree|university|education|masters|master's|msc|college|school)\b/,
    answer: () => ({
      lines: [
        "A master's in Data Science and AI from the University of Liverpool.",
        "Fourteen certificates on top of it: IBM, DeepLearning.AI and others, all verifiable from the index.",
      ],
      item: ITEMS.find((i) => i.id === "education"),
      also: ITEMS.filter((i) => i.section === "Certifications").slice(0, 3),
    }),
  },
  {
    test: /\b(experience|years|worked at|company|job|sigma|previous|background|career)\b/,
    answer: () => ({
      lines: [
        "Three years of production AI, most recently as LLM engineer at Sigma AI.",
        profile.summary,
      ],
      item: ITEMS.find((i) => i.id === "experience"),
      also: ITEMS.filter((i) => i.id === "zummit" || i.section === "The work").slice(0, 3),
    }),
  },
  {
    test: /\b(good|best|strongest|proud|impressive|highlight|favourite|favorite)\b/,
    answer: () => ({
      lines: [
        "Innerbloom, if you want one: an AI journal that runs entirely on your own machine, no telemetry leaving it at all: agent chat, sixteen-emotion tagging, a memory graph.",
        "Living NPCs is the one with a number attached: a forty-five per cent lift in engagement.",
      ],
      item: ITEMS.find((i) => i.id === "innerbloom"),
      also: ITEMS.filter((i) => i.id === "living-npcs" || i.id === "zummit"),
    }),
  },
  {
    test: /\b(who|yourself|what are you|are you real|bot|ai|assistant)\b.*\b(you|pix)\b|^\s*who are you/,
    answer: () => ({
      lines: [
        "A television on a pair of shoulders, reading from a file. There is no model behind me. Every answer I give is written down somewhere in his portfolio, which is why I cannot flatter him.",
        "Ask me about a project, a tool, a certificate, or whether he is free.",
      ],
      also: ITEMS.filter((i) => i.section === "The work").slice(0, 3),
    }),
  },
];

/**
 * Finds the best answer to a typed question.
 *
 * Scoring is deliberately plain: a term in the title counts for more than the
 * same term buried in a description, and a row has to clear a floor before it
 * is offered at all. A confident wrong answer is worse here than an honest
 * shrug, so the floor matters more than the ranking.
 */
export function answerFor(question: string, name?: string): Answer {
  const q = question.trim();
  if (!q) return { lines: ["Ask me anything that is in his file."], also: [] };

  const lower = q.toLowerCase();
  for (const intent of INTENTS) {
    if (intent.test.test(lower)) return intent.answer(name);
  }

  const terms = words(q);
  if (!terms.length) return miss(name);

  /*
   * "Does he know PyTorch" is a question about what he can do, not about the
   * one project that happens to list it. Both match, and without this the
   * project wins on the strength of a tag — a true answer to a question
   * nobody asked.
   */
  const aboutSkill = /\b(know|knows|use|uses|familiar|experience|worked with|any good at|comfortable)\b/.test(
    lower,
  );

  const scored = ITEMS.map((item) => {
    const title = item.title.toLowerCase();
    const hay = haystack(item);
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 6;
      else if ((item.chips ?? []).some((c) => c.toLowerCase().includes(t))) score += 4;
      else if (hay.includes(t)) score += 2;
    }
    if (score > 0 && aboutSkill && item.section === "Toolkit") score += 5;
    return { item, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  // One matching term in a description is a coincidence, not an answer.
  if (!scored.length || scored[0].score < 4) return miss(name);

  const top = scored[0].item;
  return {
    lines: describe(top),
    item: top,
    also: scored.slice(1, 4).map((r) => r.item),
  };
}

/** The answer for one row, written from its own fields. */
function describe(i: Item): string[] {
  const out: string[] = [];
  switch (i.section) {
    case "The work":
      out.push(`${i.title}: ${i.meta}.`);
      if (i.body) out.push(i.body);
      break;
    case "Certifications":
      out.push(`${i.title}, ${i.meta}.`);
      if (i.body) out.push(i.body);
      break;
    case "Toolkit":
      out.push(`Under ${i.title.toLowerCase()}: ${i.body ?? i.meta}.`);
      break;
    case "Elsewhere":
      out.push(`${i.title}: ${i.meta}.`);
      break;
    default:
      out.push(i.body ?? `${i.title}. ${i.meta}.`);
  }
  return out;
}

function miss(name?: string): Answer {
  return {
    lines: [
      `I have nothing on that${name ? `, ${name}` : ""}. I would rather say so than make something up.`,
      "Try a project, a tool, a certificate, where he studied, or whether he is free.",
    ],
    also: ITEMS.filter((i) => i.id === "innerbloom" || i.id === "experience" || i.id === "zummit"),
  };
}
