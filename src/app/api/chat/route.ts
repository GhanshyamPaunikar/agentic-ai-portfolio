import { PIX_JD_PROMPT, PIX_PROMPT, SYSTEM_PROMPT } from "@/lib/assistant-prompt";
import { aiNewsNote } from "@/lib/ai-news";
import { TOOLS, runTool } from "@/lib/elio-tools";
import { githubNote } from "@/lib/github";
import { KEEP, isBot, pipeline, whereFrom } from "@/lib/kv";
import { checkRateLimit, clientIp, LIMITS } from "@/lib/rate-limit";
import { isConfigured, LlmError, streamCompletion, type Turn } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A pasted job description is far longer than a typed question, and it is the
 * one request worth giving more room to answer.
 */
const LONG_INPUT_CHARS = 400;

function badRequest(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!isConfigured()) {
    return badRequest("The assistant is not configured yet.", 503);
  }

  // The evaluation suite (scripts/eval-pix.mjs) runs dozens of questions in a
  // row; on a local dev server only, it may skip the per-visitor limit.
  const evalRun = process.env.NODE_ENV !== "production" && req.headers.get("x-pix-eval") === "1";
  const limit = evalRun ? { ok: true as const } : checkRateLimit(clientIp(req));
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: limit.reason }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(limit.retryAfterSeconds),
      },
    });
  }

  let body: { messages?: Turn[]; persona?: string; name?: string; note?: string; mode?: string; vid?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Malformed request.");
  }

  const turns = body.messages;
  if (!Array.isArray(turns) || turns.length === 0) {
    return badRequest("No message to answer.");
  }
  if (turns.length > LIMITS.maxTurns) {
    return badRequest("This conversation is too long. Start a new one.");
  }

  const clean: Turn[] = [];
  for (const turn of turns) {
    if (turn?.role !== "user" && turn?.role !== "assistant") {
      return badRequest("Malformed request.");
    }
    if (typeof turn.content !== "string") {
      return badRequest("Malformed request.");
    }
    const content = turn.content.trim();
    if (!content) continue;
    if (content.length > LIMITS.maxMessageChars) {
      return badRequest(
        `That message is too long — please keep it under ${LIMITS.maxMessageChars} characters.`,
      );
    }
    clean.push({ role: turn.role, content });
  }

  if (clean.length === 0 || clean[0].role !== "user") {
    return badRequest("No message to answer.");
  }

  // Elio: the robot on the third design. Its prompt stays byte-stable, so the
  // visitor's name rides along in front of the first message instead.
  const pix = body.persona === "pix";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 600) : "";
  // The browser's anonymous id, so the dashboard can put one visitor's
  // questions, notes and messages together.
  const vid = typeof body.vid === "string" && /^[a-z0-9]{6,40}$/.test(body.vid) ? body.vid : undefined;
  const latest = clean[clean.length - 1].content;
  // A pasted job description gets the fit check: when the page says so (the
  // "Check a job fit" turn), or when it reads like one — long, or shorter but
  // full of the words job ads are made of.
  const looksLikeJob =
    latest.length > 700 ||
    (latest.length > 250 &&
      (latest.match(/\b(requirements?|responsibilit|qualifications?|years of experience|nice to have|we are hiring|you will|the role|must have)\b/gi) ?? []).length >= 2);
  const jd = pix && (body.mode === "jd" || looksLikeJob);
  if (pix) {
    // The date lets Elio work out how long ago things were ("is he at Sigma
    // now?"); it travels in the message so the system prompt stays cacheable.
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    const notes = [`(Today is ${today}.)`, name && `(The visitor's name is ${name}.)`, note && `(${note})`]
      .filter(Boolean)
      .join(" ");
    if (notes) clean[0] = { role: "user", content: `${notes}\n\n${clean[0].content}` };
    // What he is working on now, live, when the question is about that.
    // Or today's top AI news, when that is what they ask about instead.
    const [gh, news] = await Promise.all([githubNote(latest), aiNewsNote(latest)]);
    const live = news || gh;
    if (live) clean[clean.length - 1] = { role: "user", content: `${live}\n\n${latest}` };
  }

  const isLongInput = clean[clean.length - 1].content.length > LONG_INPUT_CHARS;

  const where = whereFrom(req);
  const options = {
    system: jd ? PIX_JD_PROMPT : pix ? PIX_PROMPT : SYSTEM_PROMPT,
    messages: clean,
    // Elio can look things up and pass on a message; a fit check doesn't need to.
    agent: pix && !jd ? { tools: TOOLS, run: (n: string, i: unknown) => runTool(n, i, { vid, country: where.country }) } : undefined,
    // Elio's closing lines (NEXT, ACTIONS) come last, so an answer that runs
    // long loses them first; 450 leaves room for an in-depth reply and them.
    maxTokens: jd ? 500 : pix ? 450 : isLongInput ? 2000 : 1024,
    // Low but not zero: grounded recall, with enough slack to phrase a gap
    // analysis naturally rather than reciting the corpus. Elio gets a little
    // more for variety in small talk, but not so much that facts wander.
    temperature: jd ? 0.3 : pix ? 0.7 : 0.3,
  };

  /*
   * Elio's answer is streamed, so it can start saying its first sentence while
   * the rest is being written. The page only ever uses whole sentences, and
   * it keeps what arrived if the stream breaks. A model that fails before
   * writing anything is tried once more; if it still fails the page gets an
   * error status and answers from the file.
   */
  if (pix) {
    const started = Date.now();
    // What visitors ask, for Ghanshyam's dashboard: the question, the start of
    // the answer, and where it came from. Skipped for the eval suite and bots.
    const log = (answer: string) => {
      const w = where;
      // Nor Ghanshyam testing on his own browsers.
      if (evalRun || isBot(w.ua) || /(?:^|;\s*)gp_owner=1(?:;|$)/.test(req.headers.get("cookie") ?? "")) return;
      // What Elio chose to remember about them ("hiring for a fintech AI team").
      const kept = answer.match(/^\s*REMEMBER:\s*(.+)$/im)?.[1]?.trim().slice(0, 160);
      const q = {
        t: new Date().toISOString(),
        q: latest.slice(0, 500),
        a: answer.slice(0, 280),
        jd,
        ms: Date.now() - started,
        country: w.country,
        city: w.city,
        name: name || undefined,
        vid,
        kept,
      };
      void pipeline([
        ["LPUSH", "questions", JSON.stringify(q)],
        ["LTRIM", "questions", 0, KEEP - 1],
        ["INCR", "count:questions"],
      ]);
    };
    // Wait for the first words before answering, so a model that fails at
    // once can be retried and the page still gets a clean error status.
    for (let attempt = 0; attempt < 2; attempt++) {
      const chunks = streamCompletion(options)[Symbol.asyncIterator]();
      let first: IteratorResult<string>;
      try {
        first = await chunks.next();
        while (!first.done && !first.value) first = await chunks.next();
      } catch (error) {
        if (error instanceof LlmError && (error.kind === "auth" || error.kind === "quota" || error.kind === "blocked")) {
          break;
        }
        continue;
      }
      if (first.done) continue;
      const encoder = new TextEncoder();
      let text = first.value;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(first.value));
        },
        async pull(controller) {
          try {
            const next = await chunks.next();
            if (next.done) {
              log(text);
              controller.close();
              return;
            }
            text += next.value;
            controller.enqueue(encoder.encode(next.value));
          } catch {
            // Broken partway: the page keeps the sentences it already has.
            log(`${text} (cut off)`);
            controller.close();
          }
        },
        cancel() {
          void chunks.return?.(undefined);
        },
      });
      return new Response(body, {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    log("(model unavailable; answered from the file)");
    return badRequest("The model could not answer just now.", 502);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wroteAnything = false;
      try {
        const chunks = streamCompletion(options);

        for await (const text of chunks) {
          wroteAnything = true;
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (error) {
        let message =
          "Something went wrong reaching the model. Try again in a moment.";
        if (error instanceof LlmError) {
          if (error.kind === "auth") {
            message =
              "The assistant is misconfigured. Please email Ghanshyam directly.";
          } else if (error.kind === "quota") {
            // Wording stays provider-neutral: this is a free-tier daily cap on
            // Gemini and an ordinary rate limit on a paid Anthropic account.
            message =
              "The assistant has hit its request limit for now. Email Ghanshyam directly — he reads everything.";
          } else if (error.kind === "blocked") {
            message =
              "I can't help with that one. Ask me about Ghanshyam's work instead.";
          } else if (error.kind === "model") {
            message =
              "The assistant is temporarily unavailable. Please email Ghanshyam directly.";
          }
        } else {
          console.error("[assistant]", error);
        }
        // Mid-stream failures get a separator so the partial answer stays legible.
        controller.enqueue(encoder.encode(wroteAnything ? `\n\n${message}` : message));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
