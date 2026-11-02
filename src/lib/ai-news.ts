import "server-only";

/**
 * Today's top three AI stories, so Elio can answer "what's new in AI?".
 *
 * From Hacker News through Algolia's free search API (no key): stories from
 * the last 24 hours with an AI word in the title, ranked by votes. Only
 * fetched when a question is about AI news, and cached for an hour, so the
 * list rolls forward through the day without a cron job or a database.
 */
const NEWSY = /\b(news|new|latest|today|this week|released?|launch(ed|es)?|announced?|happening|going on|trending|headlines?)\b/i;
const AI_WORDS = /\b(ai|a\.i\.|llms?|models?|gpt|claude|gemini|openai|anthropic|machine learning|tech)\b/i;
// "His latest model" is about Ghanshyam's work, not the news.
const ABOUT_HIM = /\b(he|his|him|ghanshyam)\b/i;
const asksAboutAiNews = (q: string) => NEWSY.test(q) && AI_WORDS.test(q) && !ABOUT_HIM.test(q);
const ABOUT_AI =
  /\b(ai|llms?|gpt[-\w.]*|claude|gemini|llama|openai|anthropic|deepmind|mistral|qwen|deepseek|models?|agents?|agentic|neural|machine learning|transformers?|diffusion|copilot|chatbots?|inference|agi|grok|hugging ?face|nvidia)\b/i;
const HOUR = 60 * 60 * 1000;
const DAY_SECONDS = 24 * 60 * 60;

let cache: { at: number; note: string } | null = null;

type Hit = { title: string; url: string | null; points: number; objectID: string };

const site = (url: string | null) => {
  if (!url) return "Hacker News";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Hacker News";
  }
};

export async function aiNewsNote(question: string): Promise<string> {
  if (!asksAboutAiNews(question)) return "";
  if (cache && Date.now() - cache.at < HOUR) return cache.note;
  try {
    const since = Math.floor(Date.now() / 1000) - DAY_SECONDS;
    const filters = encodeURIComponent(`created_at_i>${since},points>20`);
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=300&numericFilters=${filters}`,
      // Algolia takes about a second for this; only news questions wait on it.
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return "";
    const { hits } = (await res.json()) as { hits: Hit[] };
    const top = hits
      .filter((h) => h.title && ABOUT_AI.test(h.title))
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
    const lines = top.map((h, i) => `${i + 1}. ${h.title} (${site(h.url)})`);
    const note = lines.length
      ? `(Today's top AI news, the most upvoted on Hacker News in the last 24 hours: ${lines.join("; ")}.)`
      : "";
    cache = { at: Date.now(), note };
    return note;
  } catch {
    return "";
  }
}
