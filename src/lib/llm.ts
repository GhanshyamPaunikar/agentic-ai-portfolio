import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { decodeStream, sseEvents } from "@/lib/sse";

/**
 * Streaming text completion over a free-tier LLM provider.
 *
 * Both supported providers have a genuinely free tier that needs no card:
 *
 *   gemini  Google AI Studio. Better answers, which matters most for the
 *           job-description analysis. Lower daily request allowance.
 *           Key: https://aistudio.google.com/apikey
 *
 *   groq    Llama on Groq. Much higher daily allowance and very fast, but
 *           weaker at nuanced comparison.
 *           Key: https://console.groq.com/keys
 *
 * Free-tier quotas change — check the provider's current limits and keep
 * LIMITS.globalPerDay in rate-limit.ts comfortably underneath them.
 *
 * Plain fetch on purpose: no SDK dependency, and one SSE parser covers both.
 */

export type Provider = "gemini" | "groq" | "anthropic";

export type Turn = { role: "user" | "assistant"; content: string };

export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "quota" | "blocked" | "model" | "transient",
  ) {
    super(message);
  }
}

export function activeProvider(): Provider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "gemini" || explicit === "groq" || explicit === "anthropic") {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GROQ_API_KEY) return "groq";
  return "gemini";
}

export function isConfigured(): boolean {
  switch (activeProvider()) {
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "groq":
      return Boolean(process.env.GROQ_API_KEY);
    default:
      return Boolean(process.env.GEMINI_API_KEY);
  }
}

async function failFor(res: Response, provider: Provider): Promise<LlmError> {
  const detail = await res.text().catch(() => "");
  console.error(`[llm:${provider}] ${res.status} ${detail.slice(0, 500)}`);

  if (res.status === 401 || res.status === 403) {
    return new LlmError("auth", "auth");
  }
  if (res.status === 429) {
    return new LlmError("quota", "quota");
  }
  if (res.status === 404) {
    // Providers retire models on their own schedule — this is a config problem,
    // not a blip, so make it loud rather than letting it read as a hiccup.
    console.error(
      `[llm:${provider}] model unavailable. Set LLM_MODEL to a current model.`,
    );
    return new LlmError("model", "model");
  }
  return new LlmError("transient", "transient");
}

/**
 * Free tiers return 503 "high demand" fairly often, and a visitor shouldn't see
 * an error for something that clears in under a second. Retries only the
 * statuses that can succeed on a second attempt: not 429 (retrying a quota
 * breach makes it worse), not auth, not a retired model.
 *
 * Safe to retry because nothing has been read from the body yet — the caller
 * only starts streaming once a response comes back ok.
 */
async function fetchWithRetry(
  send: () => Promise<Response>,
  attempts = 3,
): Promise<Response> {
  const backoffMs = [400, 1200];
  let last: Response | undefined;

  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await send();
    } catch (err) {
      // Network-level failure: retry unless this was the last attempt.
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, backoffMs[i] ?? 1200));
      continue;
    }

    if (res.ok || ![500, 502, 503, 504].includes(res.status)) return res;

    last = res;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, backoffMs[i] ?? 1200));
    }
  }

  return last!;
}

/**
 * Waits for the first piece of the answer itself, then hands back a response
 * that replays it followed by the rest. Some models send their headers at
 * once and then sit on the body, so "has it answered yet" has to mean words,
 * not headers.
 */
async function primed(res: Response): Promise<Response> {
  if (!res.ok || !res.body) return res;
  const reader = res.body.getReader();
  const first = await reader.read();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      if (first.done) c.close();
      else c.enqueue(first.value);
    },
    async pull(c) {
      const { done, value } = await reader.read();
      if (done) c.close();
      else c.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(body, { status: res.status, headers: res.headers });
}

/**
 * Models that just failed, and until when to leave them alone: out of quota
 * for an hour, retired or refusing the request for a day, overloaded for
 * a minute. Per server instance, which is enough to stop every visitor paying
 * for the same refusal.
 */
const restUntil = new Map<string, number>();
function rest(model: string, status: number) {
  // A 429 on the free tier is almost always the daily quota, which resets
  // overnight; an hour keeps every visitor from paying for it again.
  const ms = status === 429 ? 60 * 60_000 : status === 404 || status === 400 ? 24 * 60 * 60_000 : 60_000;
  restUntil.set(model, Date.now() + ms);
}
function resting(model: string) {
  const until = restUntil.get(model);
  return until !== undefined && until > Date.now();
}

/** How long a model may take to start answering before the next is asked too. */
const HEDGE_MS = 3500;
/** The most any one attempt may take, start to finish. */
const ATTEMPT_MS = 15000;

/**
 * Runs the attempts in order, overlapping them when one is slow, and resolves
 * with the first successful response. A failed response hands over to the
 * next attempt at once; an auth failure stops everything, since no model will
 * fare better. If all fail, resolves with the last failure for failFor().
 */
function firstAnswer(attempts: ((signal: AbortSignal) => Promise<Response>)[]): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (!attempts.length) return reject(new Error("no models to try"));
    const ctrls: AbortController[] = [];
    let next = 0;
    let running = 0;
    let settled = false;
    let lastRes: Response | undefined;
    let lastErr: unknown = new Error("no model answered");
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const settle = (fn: () => void, keep?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedge);
      ctrls.forEach((c, i) => i !== keep && c.abort());
      fn();
    };
    const exhausted = () => {
      if (running > 0 || next < attempts.length) return;
      settle(() => (lastRes ? resolve(lastRes) : reject(lastErr)));
    };
    const launch = () => {
      if (settled || next >= attempts.length) return;
      const i = next++;
      const ctrl = new AbortController();
      ctrls[i] = ctrl;
      running++;
      clearTimeout(hedge);
      hedge = setTimeout(launch, HEDGE_MS);
      attempts[i](AbortSignal.any([ctrl.signal, AbortSignal.timeout(ATTEMPT_MS)])).then(
        (res) => {
          running--;
          if (settled) {
            void res.body?.cancel().catch(() => {});
            return;
          }
          if (res.ok && res.body) return settle(() => resolve(res), i);
          lastRes = res;
          if (res.status === 401 || res.status === 403) return settle(() => resolve(res));
          launch();
          exhausted();
        },
        (err) => {
          running--;
          lastErr = err;
          if (settled) return;
          launch();
          exhausted();
        },
      );
    };
    launch();
  });
}

async function* streamGemini(opts: {
  system: string;
  messages: Turn[];
  maxTokens: number;
  temperature: number;
}): AsyncGenerator<string> {
  const base =
    process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com";

  // Best first, in the order Ghanshyam chose. Each has the thinking setting
  // it accepts (tested October 2026); a model that is out of quota, retired
  // or failing is skipped at once and rested for a while (see `resting`), so
  // the next visitor goes straight to one that works. LLM_MODEL overrides.
  const candidates: { model: string; thinking?: Record<string, unknown> }[] = process.env.LLM_MODEL
    ? [{ model: process.env.LLM_MODEL }]
    : [
        { model: "gemini-3.1-pro-preview" },
        { model: "gemini-pro-latest" },
        { model: "gemini-3.8-flash", thinking: { thinkingBudget: 0 } },
        { model: "gemini-3.7-flash", thinking: { thinkingBudget: 0 } },
        { model: "gemini-3.6-flash", thinking: { thinkingLevel: "low" } },
        { model: "gemini-3.5-flash", thinking: { thinkingLevel: "minimal" } },
        { model: "gemini-flash-latest", thinking: { thinkingBudget: 0 } },
        { model: "gemini-3-flash-preview", thinking: { thinkingBudget: 0 } },
        { model: "gemini-2.5-pro" },
        { model: "gemini-3.5-flash-lite" },
        { model: "gemini-flash-lite-latest", thinking: { thinkingLevel: "low" } },
        { model: "gemini-3.1-flash-lite", thinking: { thinkingBudget: 0 } },
        { model: "gemini-2.5-flash", thinking: { thinkingBudget: 0 } },
        { model: "gemma-4-31b-it" },
        { model: "gemini-2.5-flash-lite", thinking: { thinkingBudget: 0 } },
        { model: "gemma-4-26b-a4b-it" },
      ];
  // Everything resting at once means a bad minute for all of them; try them
  // all again rather than give up.
  const awake = candidates.filter((c) => !resting(c.model));
  if (awake.length) candidates.splice(0, candidates.length, ...awake);

  const payloadFor = (thinking?: Record<string, unknown>) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.messages.map((m) => ({
        // Gemini calls the assistant turn "model".
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: opts.maxTokens,
        temperature: opts.temperature,
        ...(thinking ? { thinkingConfig: thinking } : {}),
      },
      // Default thresholds false-positive on ordinary professional questions,
      // so only block what is clearly high-risk.
      safetySettings: [
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
      ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
    });

  // Hedged: the first model is asked at once, and if it has not started
  // answering within HEDGE_MS the next one is asked as well; whichever starts
  // first wins and the rest are cancelled. A model that fails outright hands
  // over immediately. So a slow or busy model costs at most HEDGE_MS, not its
  // whole timeout.
  const res = await firstAnswer(
    candidates.map(({ model, thinking }) => (signal: AbortSignal) =>
      fetch(`${base}/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: payloadFor(thinking),
        signal,
      }).then((r) => {
        if (!r.ok) rest(model, r.status);
        return primed(r);
      }),
    ),
  );

  if (!res.ok || !res.body) throw await failFor(res, "gemini");

  for await (const payload of sseEvents(decodeStream(res.body))) {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(payload);
    } catch {
      continue;
    }

    const feedback = json.promptFeedback as { blockReason?: string } | undefined;
    if (feedback?.blockReason) throw new LlmError("blocked", "blocked");

    const candidates = json.candidates as
      | Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
          finishReason?: string;
        }>
      | undefined;
    const candidate = candidates?.[0];
    if (candidate?.finishReason === "SAFETY") {
      throw new LlmError("blocked", "blocked");
    }
    for (const part of candidate?.content?.parts ?? []) {
      // A model's reasoning arrives as parts marked "thought"; only the
      // answer is for the visitor.
      if (part.text && !part.thought) yield part.text;
    }
  }
}

async function* streamGroq(opts: {
  system: string;
  messages: Turn[];
  maxTokens: number;
  temperature: number;
}): AsyncGenerator<string> {
  const model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";

  const base = process.env.LLM_BASE_URL || "https://api.groq.com";
  const res = await fetchWithRetry(() => fetch(`${base}/openai/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.GROQ_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  }));

  if (!res.ok || !res.body) throw await failFor(res, "groq");

  for await (const payload of sseEvents(decodeStream(res.body))) {
    if (payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.delta?.content;
      if (text) yield text;
    } catch {
      continue;
    }
  }
}

/**
 * Anthropic. Paid — there is no free tier — but it avoids the free tiers'
 * capacity problems entirely, which is what you are buying.
 *
 * On caching: the corpus is sent with cache_control, but the minimum cacheable
 * prefix is model-dependent and NOT monotonic across generations. Haiku 4.5
 * needs 4096 tokens, while Sonnet 5.5 needs only 512. Our system prompt sits
 * around 3.4K, so it caches on Sonnet and silently does not on Haiku — no
 * error, just cache_creation_input_tokens: 0 and full price every message.
 * Grow the corpus past 4096 tokens and Haiku becomes the cheapest option.
 * Watch the logged usage line below to see which is actually happening.
 */
/** Tools Elio may use, and how to run one; Anthropic only. */
export type Agent = {
  tools: Anthropic.Tool[];
  run: (name: string, input: unknown) => Promise<string>;
};

/**
 * At most this many rounds of tools before Elio must answer with what it has:
 * each round is a whole extra model call, so a curious question costs two or
 * three calls at most, never a runaway loop.
 */
const MAX_TOOL_ROUNDS = 2;

async function* streamAnthropic(opts: {
  system: string;
  messages: Turn[];
  maxTokens: number;
  temperature: number;
  agent?: Agent;
}): AsyncGenerator<string> {
  // Sonnet 5.5 passed every case of scripts/eval-pix.mjs and kept to spoken
  // length; Haiku 5.5 (cheaper, $0.10/$0.50 per million) ran long and failed
  // two. About half a cent per answer once the system prompt is cached.
  const model = process.env.LLM_MODEL || "claude-sonnet-5-5";
  // Claude 4.x still takes a temperature; the 5.x models reject anything but
  // the default, and think before answering unless told not to. Elio's replies
  // are short and conversational, so thinking off keeps the first word fast
  // and the whole token allowance for the answer. Sonnet 5.5 turns thinking
  // off with "between_tools" (it rejects "disabled"), and gets Anthropic's
  // server-side fallback, so a reply its safety check declines is finished
  // by another model instead of ending empty.
  const legacy = /^claude-[a-z]+-4/.test(model);
  const sonnet55 = model === "claude-sonnet-5-5";
  const client = new Anthropic(
    // Lets tests and proxies point elsewhere; unset in normal use.
    process.env.LLM_BASE_URL ? { baseURL: process.env.LLM_BASE_URL } : {},
  );

  const messages: Anthropic.Beta.BetaMessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const tools = opts.agent?.tools;
  try {
    for (let round = 0; ; round++) {
      // The last round may not call a tool, so the visitor always gets an answer.
      const toolsNow = tools && round < MAX_TOOL_ROUNDS ? tools : undefined;
      const stream = client.beta.messages.stream({
        model,
        max_tokens: opts.maxTokens,
        ...(tools ? { tools, ...(toolsNow ? {} : { tool_choice: { type: "none" as const } }) } : {}),
        ...(legacy
          ? { temperature: opts.temperature }
          : {
              thinking: sonnet55 ? { type: "between_tools" as const } : { type: "disabled" as const },
              output_config: { effort: "low" as const },
            }),
        ...(sonnet55 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        system: [
          {
            type: "text",
            text: opts.system,
            // Five minutes by default, renewed by every question, which covers a
            // visit. LLM_CACHE_TTL=1h keeps it between visitors too, at a higher
            // price per write (2x input, not 1.25x): worth it only once visits
            // regularly come less than an hour apart.
            cache_control:
              process.env.LLM_CACHE_TTL === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" },
          },
        ],
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }

      const final = await stream.finalMessage();
      const u = final.usage;
      // Cheap observability: if cache_read stays 0 across messages, the prefix is
      // under this model's minimum and you are paying full rate every time.
      console.log(
        `[llm:anthropic] ${model} round=${round} in=${u.input_tokens} ` +
          `cache_write=${u.cache_creation_input_tokens ?? 0} ` +
          `cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`,
      );

      const calls = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (!opts.agent || final.stop_reason !== "tool_use" || !calls.length) return;
      // Whatever it said before reaching for the tool ("Let me look.") was already
      // streamed; a new line keeps it apart, so a MOOD line after it is still
      // read as one and not spoken.
      yield "\n";
      messages.push({ role: "assistant", content: final.content });
      const results = await Promise.all(
        calls.map(async (c): Promise<Anthropic.Beta.BetaToolResultBlockParam> => ({
          type: "tool_result",
          tool_use_id: c.id,
          content: await opts.agent!.run(c.name, c.input),
        })),
      );
      console.log(`[llm:anthropic] tools: ${calls.map((c) => c.name).join(", ")}`);
      // Out of lookups: without a word, the model just stops when it can't
      // call another tool, and the visitor hears nothing.
      const last = round + 1 >= MAX_TOOL_ROUNDS;
      messages.push({
        role: "user",
        content: last ? [...results, { type: "text", text: "(No more lookups. Answer the visitor now from what you found, in your usual reply format.)" }] : results,
      });
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new LlmError("auth", "auth");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new LlmError("quota", "quota");
    }
    if (error instanceof Anthropic.NotFoundError) {
      console.error(
        `[llm:anthropic] model "${model}" not found. Set LLM_MODEL to a current model.`,
      );
      throw new LlmError("model", "model");
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[llm:anthropic] ${error.status} ${error.message}`);
      throw new LlmError("transient", "transient");
    }
    throw error;
  }
}

export function streamCompletion(opts: {
  system: string;
  messages: Turn[];
  maxTokens: number;
  temperature: number;
  /** Tools for Elio; used by the Anthropic provider, ignored by the free ones. */
  agent?: Agent;
}): AsyncGenerator<string> {
  switch (activeProvider()) {
    case "anthropic":
      return streamAnthropic(opts);
    case "groq":
      return streamGroq(opts);
    default:
      // Groq's free tier is a second, independent free provider: if a
      // GROQ_API_KEY is set, it answers whenever every Gemini model fails
      // before saying anything.
      return process.env.GROQ_API_KEY ? withFallback(streamGemini(opts), () => streamGroq(opts)) : streamGemini(opts);
  }
}

async function* withFallback(first: AsyncGenerator<string>, then: () => AsyncGenerator<string>): AsyncGenerator<string> {
  let said = false;
  try {
    for await (const chunk of first) {
      said = true;
      yield chunk;
    }
  } catch (error) {
    if (said) throw error;
    console.error("[llm] gemini failed, falling back to groq", error);
    yield* then();
  }
}
