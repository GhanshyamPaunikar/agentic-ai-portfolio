import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Talking to Elio: what the visitor said, as text, from Azure AI Speech.
 *
 * The page records while the mic button is held and sends one short WAV
 * (16 kHz, 16-bit mono). The browser's own recogniser used to do this, but
 * outside Google Chrome (Comet, Brave, Arc, Firefox) it is missing or fails
 * silently; this works wherever the page can use the microphone. The free
 * tier (F0) covers five hours of audio a month.
 *
 * Uses the same AZURE_SPEECH_KEY and AZURE_SPEECH_REGION as /api/tts.
 */

const MAX_BYTES = 2_000_000; // about 60 s at 16 kHz, Azure's limit for one request
const LANGS = new Set(["en-US", "en-IN", "en-GB", "en-AU"]);

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
  return h.n <= 60;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function POST(req: Request) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return json({ error: "not configured" }, 503);
  if (!allowed(clientIp(req))) return json({ error: "slow down" }, 429);

  const audio = await req.arrayBuffer();
  if (audio.byteLength < 1000) return json({ text: "" });
  if (audio.byteLength > MAX_BYTES) return json({ error: "too long" }, 413);

  const asked = new URL(req.url).searchParams.get("lang") ?? "";
  const lang = LANGS.has(asked) ? asked : "en-US";

  let res: Response;
  try {
    res = await fetch(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&format=simple`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
          Accept: "application/json",
        },
        body: audio,
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch (err) {
    console.error("[stt:azure]", err);
    return json({ error: "unavailable" }, 502);
  }
  if (!res.ok) {
    console.error(`[stt:azure] ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return json({ error: "unavailable" }, res.status === 429 ? 429 : 502);
  }
  const out = (await res.json().catch(() => ({}))) as { RecognitionStatus?: string; DisplayText?: string };
  return json({ text: out.RecognitionStatus === "Success" ? (out.DisplayText ?? "") : "" });
}
