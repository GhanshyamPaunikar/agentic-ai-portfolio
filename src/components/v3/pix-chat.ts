/**
 * Elio answering a typed question with the model behind /api/chat.
 *
 * The model is grounded in the same portfolio facts as everything else and is
 * told to answer small talk briefly and steer back to Ghanshyam's work. If it
 * cannot be reached (no key on the deployment, a rate limit, a network
 * failure), the answer comes from the file instead, so the box always replies.
 *
 * What the screen shows is decided here too: the project the reply names, by
 * either of its names, or failing that whatever the file's own search found.
 */

import { articles, projects } from "@/data/portfolio";
import { answerFor, type Answer, type PixAction } from "@/components/v3/answer";
import { ITEMS, type Item } from "@/components/v3/dossier";
import type { Mood } from "@/components/v3/face";
import { loadMemory, visitorId } from "@/components/v3/memory";

/** The model's words for its feelings, as the moods the screen can draw. */
const MOODS: Record<string, Mood> = {
  happy: "happy",
  excited: "excited",
  thinking: "thinking",
  shy: "shy",
  surprised: "surprised",
  sad: "sad",
  neutral: "neutral",
  laugh: "laugh",
  love: "love",
  cool: "cool",
  confused: "confused",
};

export type Turn = { role: "user" | "assistant"; content: string };

/** Long enough for a slow free-tier model, short enough not to feel broken. */
const TIMEOUT_MS = 20000;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Each project under every name a reply might use for it. */
const ALIASES: { names: string[]; item: Item }[] = projects.flatMap((p) => {
  const item = ITEMS.find((i) => i.section === "The work" && i.title === p.displayTitle);
  return item ? [{ names: [p.title, p.displayTitle].map(squash), item }] : [];
});

function mentioned(reply: string): Item | undefined {
  const flat = squash(reply);
  return ALIASES.find((a) => a.names.some((n) => n.length > 3 && flat.includes(n)))?.item;
}

const ACTIONS: PixAction[] = ["contact", "resume", "index", "github", "linkedin", "medium"];

/** Splits the model's closing "ACTIONS: ..." line into screen items and buttons. */
function actionsOf(raw: string): { text: string; show: Item[]; actions: PixAction[] } {
  const m = raw.match(/\n?\s*ACTIONS:\s*([^\n]*)\s*$/i);
  if (!m) return { text: raw, show: [], actions: [] };
  const show: Item[] = [];
  const actions: PixAction[] = [];
  for (const part of m[1].split(",").map((p) => p.trim().toLowerCase())) {
    if (part.startsWith("show:")) {
      const it = ITEMS.find((i) => i.section === "The work" && i.id === part.slice(5).trim());
      if (it && !show.includes(it)) show.push(it);
    } else if (part.startsWith("read:") && articles.some((a) => a.id === part.slice(5).trim())) {
      actions.push(`read:${part.slice(5).trim()}`);
    } else if ((ACTIONS as string[]).includes(part)) {
      actions.push(part as PixAction);
    }
  }
  return { text: raw.slice(0, m.index).trim(), show, actions: actions.slice(0, 2) };
}

/**
 * Where one sentence ends and the next begins: after . ! ? or …, before a
 * capital, a digit, a currency sign or an opening quote or bracket. "3.41",
 * "e.g. a" and "U.S. visa" stay whole.
 */
const SENTENCE = /(?<=[.!?…])\s+(?=["'“(\[A-Z0-9₹£$])/;

type Parsed = {
  /** The reply as said, one sentence per line. */
  lines: string[];
  /** Each line's mood. */
  moods: Mood[];
  /** True where a line continues the bubble above it. */
  joins: boolean[];
  mood?: Mood;
  next: string[];
  keep?: string;
  show: Item[];
  actions: PixAction[];
  /** The reply's text without the closing lines, for the conversation history. */
  raw: string;
};

/**
 * Reads Elio's reply, whole or as far as it has arrived. Unfinished, the last
 * sentence is held back (it may still be growing), so every line handed out
 * mid-stream is exactly the line the finished reply will have.
 */
function parse(text: string, finished: boolean): Parsed {
  let full = text.replace(/\n*SOURCES:[\s\S]*$/, "");
  // The closing lines: something to remember about the visitor, how Elio
  // feels about its reply, and what they might ask next.
  let keep: string | undefined;
  let mood: Mood | undefined;
  let next: string[] = [];
  full = full.replace(/^\s*REMEMBER:\s*(.+)$/im, (_, n: string) => {
    keep = n.trim().slice(0, 120);
    return "";
  });
  full = full.replace(/^\s*MOOD:\s*(\w+).*$/im, (_, m: string) => {
    mood = MOODS[m.toLowerCase()];
    return "";
  });
  full = full.replace(/^\s*NEXT:\s*(.+)$/im, (_, n: string) => {
    next = n
      .split("|")
      .map((q) => q.trim().replace(/^["']|["']$/g, ""))
      .filter((q) => q.length > 2 && q.length < 60)
      .slice(0, 2);
    return "";
  });
  // "[show:innerbloom]" anywhere in the reply puts that project on the screen
  // as soon as it arrives, while Elio is still talking about it.
  const inline: Item[] = [];
  full = full.replace(/\[show:\s*([\w-]+)\]\s*/gi, (_, id: string) => {
    const it = ITEMS.find((i) => i.section === "The work" && i.id === id.toLowerCase());
    if (it && !inline.includes(it)) inline.push(it);
    return "";
  });
  // A reply cut off by the length limit can end partway into a closing line
  // ("ACTIONS", "NEXT: What did"): never say those, whatever is left of them.
  full = full.replace(/\n\s*(?:ACTIONS|NEXT|REMEMBER|MOOD|SOURCES)\b[^\n]*$/i, (line) => (/:\s*\S/.test(line) && finished ? line : ""));
  // A speaker label copied from the prompt's examples would be read aloud.
  full = full.replace(/^\s*(?:Elio|PIX|Your reply):\s*/gim, "");
  // The model is told not to use markdown; this catches the odd slip.
  full = full.replace(/\*\*?([^*]+)\*\*?/g, "$1").trim();
  const { text: raw, show: listed, actions } = actionsOf(full);
  const show = [...inline, ...listed.filter((it) => !inline.includes(it))];

  // A switch of feeling ("[excited] But he has...") starts a new bubble, so
  // the voice and the face change exactly where the tone does. Tags that name
  // no mood are dropped; untagged lines keep the mood before them.
  const lines: string[] = [];
  const moods: Mood[] = [];
  const joins: boolean[] = [];
  let current: Mood = mood ?? "neutral";
  for (const para of raw.split(/\n+/)) {
    for (const part of para.split(/(?=\[[a-z]+\])/i)) {
      const tag = part.match(/^\[([a-z]+)\]\s*/i);
      if (tag && MOODS[tag[1].toLowerCase()]) current = MOODS[tag[1].toLowerCase()];
      // A list item is its own bubble already; the dash or number would be noise.
      const text = part
        .replace(/^\[[a-z]+\]\s*/i, "")
        .replace(/\[[a-z]+\]\s*/gi, "")
        .trim()
        .replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "");
      if (!text) continue;
      text.split(SENTENCE).forEach((sentence, i) => {
        lines.push(sentence.trim());
        moods.push(current);
        joins.push(i > 0);
      });
    }
  }
  if (!finished) {
    // The last sentence may be half written, and so may a closing line.
    lines.pop();
    moods.pop();
    joins.pop();
  }
  return { lines, moods, joins, mood, next, keep, show, actions, raw };
}

export async function askPix(
  question: string,
  history: Turn[],
  name?: string,
  note?: string,
  mode?: "jd",
  /**
   * Called as sentences arrive, with the reply so far (pending: true), so Elio
   * can start saying the first sentence while the rest is still being written.
   */
  onPartial?: (answer: Answer) => void,
): Promise<{ answer: Answer; reply?: string; note?: string }> {
  const fromFile = answerFor(question, name);
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let text = "";
  let sent = 0;
  const finish = (): { answer: Answer; reply?: string; note?: string } => {
    const p = parse(text, true);
    if (!p.lines.length) return { answer: fromFile };
    // Only what the answer is actually about goes on the screen; otherwise
    // the screen keeps Elio's face, which is showing how it feels.
    const item = p.show[0] ?? (p.mood === "shy" ? undefined : mentioned(p.raw));
    const also = [...p.show.slice(1), ...fromFile.also].filter((a, i, all) => a !== item && all.indexOf(a) === i);
    return {
      answer: {
        lines: p.lines,
        moods: p.moods,
        joins: p.joins,
        item,
        also: also.slice(0, 3),
        actions: p.actions,
        mood: p.mood,
        next: p.next,
      },
      // With its mood line, so the model keeps writing one in later turns: a
      // history without them taught it to stop, and the face and voice went flat.
      reply: p.mood ? `MOOD: ${p.mood}\n${p.raw}` : p.raw,
      note: p.keep,
    };
  };
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        persona: "pix",
        name,
        // What Elio has learned about them this visit rides along every turn,
        // so older turns can be dropped without it forgetting who they are.
        note: [note, ...loadMemory().notes.map((n) => `remembered: ${n}`)].filter(Boolean).join("; "),
        mode,
        vid: visitorId() || undefined,
        // The last three exchanges: enough for a follow-up to make sense, and
        // each one dropped is input not paid for again on every question.
        messages: [...history.slice(-6), { role: "user", content: question }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) return { answer: fromFile };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (!onPartial) continue;
      const p = parse(text, false);
      if (p.lines.length > sent) {
        sent = p.lines.length;
        onPartial({ lines: p.lines, moods: p.moods, joins: p.joins, mood: p.mood, item: p.show[0], also: [], pending: true });
      }
    }
    return finish();
  } catch {
    // Cut off partway: keep what was said rather than starting over.
    return sent ? finish() : { answer: fromFile };
  } finally {
    window.clearTimeout(timer);
  }
}
