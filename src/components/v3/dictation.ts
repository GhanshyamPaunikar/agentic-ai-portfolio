"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Talking to Elio: tap the mic and speak (it stops by itself when you pause),
 * or hold it and let go to send.
 *
 * The microphone is recorded in the page and sent as one short WAV to
 * /api/stt, which asks Azure what was said. The browser's own recogniser used
 * to do this, but outside Google Chrome (Comet, Brave, Arc, Firefox) it is
 * missing or fails without a word, so the mic seemed dead. This works in any
 * browser that lets the page use the microphone; where none can, `supported`
 * is false and the page hides the button.
 */

const RATE = 16000; // what Azure's short-audio recogniser wants
const MAX_SECONDS = 55; // Azure takes up to 60 s in one request

const noop = () => () => {};

/** 16 kHz, 16-bit mono WAV from float samples at any rate. */
function wav(chunks: Float32Array[], from: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const ratio = from / RATE;
  const length = Math.floor(total / ratio);
  const all = new Float32Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const text = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    // Average the samples that fold into this one, which also keeps out the
    // high frequencies that would alias when the rate drops.
    const start = Math.floor(i * ratio);
    const end = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += all[j];
    const s = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Words speech recognition gets wrong in questions about Ghanshyam, put
 * right before they are sent. Whole words only, and only ones that are
 * never anything else; Elio is also told to read near misses charitably.
 */
const FIXES: [RegExp, string][] = [
  [/\b(pi|pie|py)\s?d?torch\b|\bpidorch\b|\bpydorch\b/gi, "PyTorch"],
  [/\binner\s?bloom\b/gi, "Innerbloom"],
  [/\bq\s?laura\b/gi, "QLoRA"],
  [/\bghana?\s?shyam\b/gi, "Ghanshyam"],
  [/\bsigma\s?a\.?\s?i\b/gi, "Sigma AI"],
];
const fix = (text: string) => FIXES.reduce((t, [re, to]) => t.replace(re, to), text);

const language = () => {
  const l = navigator.language || "en-US";
  return ["en-US", "en-IN", "en-GB", "en-AU"].includes(l) ? l : "en-US";
};

type Recording = {
  stream: MediaStream;
  chunks: Float32Array[];
  /** Per chunk: was someone speaking in it. Used to trim the silence off both ends. */
  voiced: boolean[];
  done: () => void;
};

/** What the mic is doing, for the button and the box's placeholder. */
export type MicState = "idle" | "starting" | "listening" | "working";

const HOLD_MS = 350; // pressed longer than this is "hold to talk"; shorter is a tap
const PAUSE_MS = 1300; // after speaking, this much quiet ends a tapped recording
const WAIT_MS = 7000; // a tapped recording that never hears a voice gives up
const PAD_MS = 250; // quiet kept either side of the speech so no syllable is cut

/**
 * `press` when the button or hotkey goes down, `release` when it comes up.
 * A long press records until release; a tap records until the speaker
 * pauses (or until tapped again). The words arrive once as
 * `onText(text, true)`, the cue to send them.
 *
 * `meter` goes on the element that should swell with the voice; it gets a
 * `--level` (0 to 1) every frame without re-rendering the page.
 */
export function useDictation(onText: (text: string, final: boolean) => void) {
  // Read without an effect: whether the browser can record never changes.
  const supported = useSyncExternalStore(
    noop,
    () => !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== "undefined",
    () => false,
  );
  const [state, setState] = useState<MicState>("idle");
  const [hold, setHold] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const pressedAt = useRef(0);
  const rec = useRef<Recording | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const meterEl = useRef<HTMLElement | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onText);
  useEffect(() => {
    cb.current = onText;
  }, [onText]);

  const fail = useCallback((msg: string) => {
    setError(msg);
    if (errTimer.current) clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setError(""), 3500);
  }, []);

  const meter = useCallback((el: HTMLElement | null) => {
    meterEl.current = el;
  }, []);
  const setLevel = (v: number) => meterEl.current?.style.setProperty("--level", v.toFixed(3));

  const release_ = useCallback((r: Recording) => {
    r.done();
    r.stream.getTracks().forEach((t) => t.stop());
    setLevel(0);
  }, []);

  useEffect(
    () => () => {
      if (rec.current) release_(rec.current);
      void ctxRef.current?.close().catch(() => {});
      if (errTimer.current) clearTimeout(errTimer.current);
    },
    [release_],
  );

  const send = useCallback(
    async (r: Recording, rate: number) => {
      // Only the stretch with a voice in it, plus a little either side.
      const first = r.voiced.indexOf(true);
      if (first < 0) {
        setState("idle");
        fail("Didn't hear anything. Try again a little closer.");
        return;
      }
      const last = r.voiced.lastIndexOf(true);
      const pad = Math.ceil((PAD_MS / 1000) * rate / (r.chunks[0]?.length || 4096));
      const kept = r.chunks.slice(Math.max(0, first - pad), last + pad + 1);
      setState("working");
      try {
        const res = await fetch(`/api/stt?lang=${language()}`, { method: "POST", body: wav(kept, rate) });
        if (res.status === 429) throw new Error("busy");
        const { text } = (await res.json()) as { text?: string };
        const said = fix(text?.trim() ?? "");
        if (said) cb.current(said, true);
        else fail("Didn't catch that. Try once more?");
      } catch {
        fail("Couldn't hear that just now. Try again, or type it.");
      } finally {
        setState("idle");
      }
    },
    [fail],
  );

  /** Ends the recording; `keep` false throws it away. */
  const finish = useCallback(
    (keep = true) => {
      if (!active.current) return;
      active.current = false;
      setHold(false);
      const r = rec.current;
      rec.current = null;
      if (!r) {
        // Ended before the microphone was ready.
        setState("idle");
        return;
      }
      release_(r);
      if (keep) void send(r, ctxRef.current?.sampleRate ?? 48000);
      else setState("idle");
    },
    [release_, send],
  );

  const begin = useCallback(async () => {
    active.current = true;
    setError("");
    setState("starting");
    // Made (or woken) inside the tap itself: Safari keeps an audio context
    // made later, after the permission prompt, silent.
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    void ctx.resume().catch(() => {});
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      active.current = false;
      setHold(false);
      setState("idle");
      fail(
        (e as Error)?.name === "NotAllowedError"
          ? "The mic is blocked. Allow it from the icon in the address bar."
          : "No microphone found.",
      );
      return;
    }
    if (!active.current) {
      // Let go while the browser was asking for the microphone.
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const source = ctx.createMediaStreamSource(stream);
    // ScriptProcessor is old but runs everywhere, Safari included, without a
    // separate worklet file; a few seconds of speech is no load for it.
    const node = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    const chunks: Float32Array[] = [];
    const voiced: boolean[] = [];
    const started = performance.now();
    let floor = 0.004; // the room's own hum, learned as it goes
    let lastVoice = 0;
    let smooth = 0;
    node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const voice = rms > Math.max(0.012, floor * 3);
      // The floor drifts down quickly and up slowly, so speech doesn't raise it.
      floor = voice ? floor : rms < floor ? floor * 0.8 + rms * 0.2 : floor * 0.98 + rms * 0.02;
      voiced.push(voice);
      const now = performance.now();
      if (voice) lastVoice = now;
      smooth = Math.max(rms * 9, smooth * 0.82);
      setLevel(Math.min(1, smooth));
      if (chunks.length * data.length > MAX_SECONDS * ctx.sampleRate) return finish();
      // A tap listens until the speaker stops; a hold waits for the release.
      if (pressedAt.current === 0) {
        if (lastVoice && now - lastVoice > PAUSE_MS) finish();
        else if (!lastVoice && now - started > WAIT_MS) finish();
      }
    };
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    rec.current = {
      stream,
      chunks,
      voiced,
      done: () => {
        node.onaudioprocess = null;
        source.disconnect();
        node.disconnect();
        mute.disconnect();
      },
    };
    setState("listening");
  }, [fail, finish]);

  /** Button or hotkey down: a tap while listening sends; otherwise start. */
  const press = useCallback(() => {
    if (active.current) {
      pressedAt.current = -1; // this press only ends the recording
      finish();
      return;
    }
    if (state === "working") return;
    pressedAt.current = Date.now();
    setHold(true);
    void begin();
  }, [state, begin, finish]);

  /** Button or hotkey up: the end of a hold, or nothing after a tap. */
  const release = useCallback(() => {
    const at = pressedAt.current;
    pressedAt.current = 0;
    if (at <= 0) return;
    if (Date.now() - at >= HOLD_MS) finish();
    else setHold(false); // a tap: keep listening until a pause
  }, [finish]);

  /** Stop without sending (the window lost focus, say). */
  const cancel = useCallback(() => {
    pressedAt.current = 0;
    finish(false);
  }, [finish]);

  return { supported, state, hold, error, meter, press, release, cancel };
}
