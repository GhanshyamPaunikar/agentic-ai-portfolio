import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Elio's natural voice: Azure AI Speech, streamed.
 *
 * The browser's own voices are robotic, and switching to one mid-conversation
 * when a quota ran out is what made Elio sound like two different robots. Azure
 * runs the voice on its servers, so it is quick on any device, and it is the
 * same voice every time. The audio is raw 16-bit PCM at 24 kHz, passed through
 * to the page as Azure makes it, so the first word plays before the last is
 * ready. Lines that repeat for every visitor, the greeting above all, are kept
 * in memory and come back at once.
 *
 * The free tier (F0) gives half a million characters a month and then stops
 * rather than charging; any failure returns an error status, and the page
 * shows that line without sound.
 *
 * Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. "eastus").
 */

/**
 * Elio's voice: Tony, one of Microsoft's HD Omni voices, gravelly and
 * friendly, which acts out moods from the styles below. Picked by ear from
 * all 44 HD voices.
 */
const VOICE = "en-US-Tony:DragonHDOmniLatestNeural";

/**
 * How each mood should sound, as one of the voice's emotions. Plain facts get
 * none, so the emotions stand out when they come.
 */
const STYLE: Record<string, string | null> = {
  neutral: null,
  happy: "happy",
  excited: "excited",
  thinking: "softvoice",
  shy: "embarrassed",
  surprised: "surprised",
  sleepy: "whispering",
  sad: "sad",
  angry: "angry",
  dizzy: "confused",
  laugh: "joyful",
  love: "softvoice",
  cool: "determined",
  confused: "confused",
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/**
 * Words Olivia gets wrong, said the way they should sound. Checked by
 * having her say each one and Azure's speech-to-text write down what it
 * heard: "QLoRA" came back as "Culo RA", "Kharadi" as "karate", and
 * "20–22" lost the "to".
 * Terms she already says well (PyTorch, UNet, MSc, LLM) are left alone.
 */
const SAY: [RegExp, string][] = [
  [/\bQLoRA\b/g, '<sub alias="Q Lora">QLoRA</sub>'],
  // Heard as "karate" without it.
  [/\bKharadi\b/g, '<sub alias="Kha-ra-dee">Kharadi</sub>'],
  // A range, "20–22 lakh", "3-4 weeks", "Feb–Oct", read as "20 to 22".
  // Dates (2023-10-01) and dashes between words are left alone.
  [/(?<![\d-])(\d{1,4})\s*[–-]\s*(\d{1,4})(?![\d-])/g, "$1 to $2"],
  [/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*–\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/g, "$1 to $2"],
];

/** The line as SSML text: escaped, then the pronunciation fixes. */
const speakable = (text: string) => SAY.reduce((t, [re, to]) => t.replace(re, to), escape(text));

function ssml(text: string, mood: string, rate: number) {
  const line = `<prosody rate="${Math.round((rate - 1) * 100)}%">${speakable(text)}</prosody>`;
  const style = STYLE[mood];
  const body = style ? `<mstts:express-as style="${style}">${line}</mstts:express-as>` : line;
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">` +
    `<voice name="${VOICE}">${body}</voice></speak>`
  );
}

const CACHE_MAX = 200;
const cache = new Map<string, Uint8Array>();

const HOUR = 60 * 60 * 1000;
const hits = new Map<string, { n: number; reset: number }>();
function allowed(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + HOUR });
    return true;
  }
  h.n += 1;
  return h.n <= 150;
}

const pcm = (body: BodyInit) =>
  new Response(body, {
    headers: {
      "content-type": "audio/pcm",
      "x-sample-rate": "24000",
      "cache-control": "no-store",
    },
  });

export async function POST(req: Request) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return new Response("not configured", { status: 503 });

  let body: { text?: unknown; mood?: unknown; rate?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
  if (!text) return new Response("no text", { status: 400 });
  const mood = typeof body.mood === "string" && body.mood in STYLE ? body.mood : "neutral";
  const rate = typeof body.rate === "number" ? Math.min(1.8, Math.max(0.6, body.rate)) : 1;

  const id = `${mood}|${rate}|${text}`;
  const hit = cache.get(id);
  if (hit) {
    cache.delete(id);
    cache.set(id, hit);
    return pcm(hit as unknown as BodyInit);
  }
  if (!allowed(clientIp(req))) return new Response("slow down", { status: 429 });

  let upstream: Response;
  try {
    upstream = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "raw-24khz-16bit-mono-pcm",
        "User-Agent": "pix-portfolio",
      },
      body: ssml(text, mood, rate),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error("[tts:azure]", err);
    return new Response("voice unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    // 429 here is the free tier's monthly allowance or per-second limit.
    console.error(`[tts:azure] ${upstream.status} ${(await upstream.text().catch(() => "")).slice(0, 200)}`);
    return new Response("voice unavailable", { status: upstream.status === 429 ? 429 : 502 });
  }

  // Pass the audio through as it arrives, and keep a copy for the cache.
  const reader = upstream.body.getReader();
  const parts: Uint8Array[] = [];
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        const total = parts.reduce((n, p) => n + p.length, 0);
        if (total > 0) {
          const all = new Uint8Array(total);
          let at = 0;
          for (const p of parts) {
            all.set(p, at);
            at += p.length;
          }
          cache.set(id, all);
          if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
        }
        controller.close();
        return;
      }
      parts.push(value);
      controller.enqueue(value);
    },
    cancel() {
      void reader.cancel();
    },
  });
  return pcm(stream);
}
