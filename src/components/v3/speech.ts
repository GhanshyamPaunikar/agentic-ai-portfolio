"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * The assistant's voice: Azure AI Speech, made by /api/tts and streamed in as
 * raw audio, so the first word plays while the rest is still being made. Elio
 * always speaks as Azure's Olivia, in the mood of the line; the visitor can
 * change her speed. The text goes up at
 * reading speed and the voice follows. A line the voice cannot make in time
 * is shown without sound; there is no robotic fallback.
 */

export type VoiceSettings = {
  /** Kept for settings saved by older versions; Elio always speaks as Olivia. */
  voice: string | null;
  /** 0.5 to 2, 1 is the voice's own speed. */
  rate: number;
  /** Kept for settings saved by older versions; no longer used. */
  pitch: number;
};

export const DEFAULT_VOICE: VoiceSettings = { voice: null, rate: 1.05, pitch: 1 };

const STORE = "pix-voice";

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return DEFAULT_VOICE;
    const v = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      voice: typeof v.voice === "string" ? v.voice : null,
      rate: typeof v.rate === "number" ? v.rate : DEFAULT_VOICE.rate,
      pitch: typeof v.pitch === "number" ? v.pitch : DEFAULT_VOICE.pitch,
    };
  } catch {
    return DEFAULT_VOICE;
  }
}

export function saveVoiceSettings(v: VoiceSettings) {
  try {
    localStorage.setItem(STORE, JSON.stringify(v));
  } catch {
    /* a private window; the choice lasts for this visit */
  }
}

/** What the typewriter hears while a line is spoken. */
export type LineHooks = {
  /** The first sound. */
  onStart?: () => void;
  /** A word is being said: its start and length in the line. */
  onWord?: (index: number, length: number) => void;
  /** How long the whole line takes to say, in seconds, once it is known. */
  onLength?: (seconds: number) => void;
};

/**
 * A line being spoken: resolves when it ends, fails, or overruns its budget.
 * `wait` is how long the text may hold for the first sound; the natural voice
 * takes a second or two to begin, the browser's is near instant.
 */
export type Spoken = {
  done: Promise<void>;
  wait?: number;
  /**
   * False when the text should not keep pace with this voice. The natural
   * voice pauses, laughs and slows down for effect, so text tied to it
   * crawled; the words go up at reading speed and the voice follows.
   */
  follow?: boolean;
};

/** One line of natural speech, filling as the audio streams in. */
type Stream = { chunks: Float32Array[]; done: boolean; failed: boolean; wake: (() => void) | null };

const RATE = 24000;

function fetchStream(text: string, mood: string, rate: number): Stream {
  const line: Stream = { chunks: [], done: false, failed: false, wake: null };
  const ping = () => line.wake?.();
  void (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, mood, rate }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      let carry: number | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        // 16-bit little-endian samples; a chunk can split one in half.
        let bytes = value;
        if (carry !== null) {
          const joined = new Uint8Array(bytes.length + 1);
          joined[0] = carry;
          joined.set(bytes, 1);
          bytes = joined;
          carry = null;
        }
        if (bytes.length % 2) {
          carry = bytes[bytes.length - 1];
          bytes = bytes.subarray(0, bytes.length - 1);
        }
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const f = new Float32Array(bytes.length / 2);
        for (let i = 0; i < f.length; i++) f[i] = view.getInt16(i * 2, true) / 32768;
        if (f.length) line.chunks.push(f);
        ping();
      }
    } catch {
      line.failed = true;
    }
    line.done = true;
    ping();
  })();
  return line;
}

/** How long a line may take to start before it goes without sound. */
const FIRST_SOUND_MS = 5000;

/** Roughly how many characters a second a voice says at rate 1. */
export const CHARS_PER_SECOND = 14;

export function useSpeech(enabled: boolean, settings: VoiceSettings) {
  const prefs = useRef(settings);
  useEffect(() => {
    prefs.current = settings;
  }, [settings]);

  const audio = useRef<AudioContext | null>(null);
  const streams = useRef(new Map<string, Stream>());
  const playing = useRef(new Set<AudioBufferSourceNode>());
  const generation = useRef(0);
  // When the last queued natural line finishes, so the next starts after it.
  const queueEnd = useRef(0);
  // The line before this one, finished when its last sound has played.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Every line plays through one meter, so the face can move with the voice
  // itself: open on syllables, closed in the pauses, still when it stops.
  const meter = useRef<{ node: AnalyserNode; data: Float32Array<ArrayBuffer>; level: number; at: number } | null>(null);
  const context = useCallback(() => {
    if (!audio.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = new Ctor();
      const node = audio.current.createAnalyser();
      node.fftSize = 512; // about 21 ms of sound per reading
      node.connect(audio.current.destination);
      meter.current = { node, data: new Float32Array(node.fftSize), level: 0, at: 0 };
    }
    if (audio.current.state === "suspended") void audio.current.resume();
    return audio.current;
  }, []);
  const streamFor = useCallback((text: string, mood: string) => {
    const rate = prefs.current.rate;
    const id = `${mood}|${rate}|${text}`;
    let line = streams.current.get(id);
    if (!line || line.failed) {
      line = fetchStream(text, mood, rate);
      streams.current.set(id, line);
      if (streams.current.size > 60) streams.current.delete(streams.current.keys().next().value as string);
    }
    return line;
  }, []);

  /** Starts fetching lines before they are spoken, so each is ready in turn. */
  const prefetch = useCallback(
    (lines: string[], mood: string | string[]) => {
      if (!enabled) return;
      lines.forEach((l, i) => {
        if (l.trim()) streamFor(l, typeof mood === "string" ? mood : (mood[i] ?? "neutral"));
      });
    },
    [enabled, streamFor],
  );

  /** Plays a natural line; resolves false if it never produced a sound. */
  const playNatural = useCallback(
    (text: string, mood: string, hooks: LineHooks): Promise<boolean> => {
      const line = streamFor(text, mood);
      const ctx = context();
      const gen = generation.current;
      return new Promise((resolve) => {
        let i = 0;
        let at = 0;
        let begun = false;
        let over = false;
        const finish = (ok: boolean) => {
          if (over) return;
          over = true;
          line.wake = null;
          resolve(ok);
        };
        // A line that has not started by then is skipped, so a slow network
        // never leaves Elio speaking a sentence after the next has gone up.
        const late = window.setTimeout(() => {
          if (!begun) finish(false);
        }, FIRST_SOUND_MS);
        const pump = () => {
          if (over) return;
          if (gen !== generation.current) return finish(true);
          // Hold the first sound until a fifth of a second is buffered, so a
          // slow start does not stutter.
          const buffered = line.chunks.slice(i).reduce((n, c) => n + c.length, 0) / RATE;
          if (!begun && !line.done && buffered < 0.2) {
            line.wake = pump;
            return;
          }
          while (i < line.chunks.length) {
            const data = line.chunks[i++];
            const buf = ctx.createBuffer(1, data.length, RATE);
            buf.getChannelData(0).set(data);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(meter.current?.node ?? ctx.destination);
            if (!begun) {
              begun = true;
              window.clearTimeout(late);
              // After whatever line is still being said, never over it.
              at = Math.max(ctx.currentTime + 0.04, queueEnd.current);
              window.setTimeout(() => hooks.onStart?.(), Math.max(0, (at - ctx.currentTime) * 1000));
            }
            if (at < ctx.currentTime) at = ctx.currentTime + 0.01;
            src.start(at);
            at += buf.duration;
            queueEnd.current = at;
            playing.current.add(src);
            src.onended = () => playing.current.delete(src);
          }
          if (line.done) {
            if (!begun) return finish(false);
            hooks.onLength?.(line.chunks.reduce((n, c) => n + c.length, 0) / RATE);
            window.setTimeout(() => finish(true), Math.max(0, (at - ctx.currentTime) * 1000) + 40);
            return;
          }
          line.wake = pump;
        };
        pump();
      });
    },
    [context, streamFor],
  );

  const say = useCallback(
    (text: string, hooks: LineHooks = {}, force = false, mood = "neutral"): Spoken | null => {
      if ((!enabled && !force) || !text.trim()) return null;
      // Audio cannot start until the visitor has touched the page; until
      // then, and whenever the natural voice cannot be reached, the line is
      // shown without sound. Never the browser's voice: switching to it
      // mid-conversation is what made Elio sound robotic.
      const ctx = context();
      const running = ctx.state === "running";
      const ready = running
        ? Promise.resolve(true)
        : Promise.race([
            ctx.resume().then(() => (ctx.state as AudioContextState) === "running"),
            new Promise<boolean>((r) => window.setTimeout(() => r(false), 250)),
          ]);
      // One line at a time. The text runs ahead at reading speed and asks for
      // the next line while this one is still being said; each line arrives
      // in pieces, so scheduling it straight away let the rest of the earlier
      // line land on top of it. Its audio is already being fetched (see
      // prefetch), so waiting here costs nothing but the overlap.
      const gen = generation.current;
      const done = Promise.all([ready, queue.current]).then(([ok]) =>
        ok && gen === generation.current ? playNatural(text, mood, hooks) : false,
      );
      queue.current = done.catch(() => false);
      // The text waits for this line's voice to start (it may be queued behind
      // the line before), then types over as long as the voice takes. A
      // line that cannot be voiced ends its promise, which frees the text.
      return { done: done.then(() => undefined), wait: Number.POSITIVE_INFINITY, follow: true };
    },
    [enabled, playNatural, context],
  );

  // Web Audio may only start after the visitor's first tap or key, so the
  // audio is unlocked then, before Elio has anything to say.
  useEffect(() => {
    const warm = () => {
      try {
        context();
      } catch {
        /* no Web Audio */
      }
    };
    window.addEventListener("pointerdown", warm, { once: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, [context]);

  const stop = useCallback(() => {
    generation.current += 1;
    queueEnd.current = 0;
    queue.current = Promise.resolve();
    for (const src of playing.current) {
      try {
        src.stop();
      } catch {
        /* already ended */
      }
    }
    playing.current.clear();
  }, []);

  /**
   * How loud Elio is right now, 0 (silent) to 1 (a stressed syllable), for the
   * face and the head. Read it once a frame. Olivia's speech mostly measures
   * 0.04 to 0.15 RMS and her pauses under 0.01, so that range is spread over
   * 0..1; it rises within a frame and falls over about 80 ms, which keeps the
   * mouth from chattering without lagging the words.
   */
  const level = useCallback(() => {
    const m = meter.current;
    if (!m || audio.current?.state !== "running") return 0;
    const now = performance.now();
    const dt = Math.min(0.1, (now - (m.at || now)) / 1000);
    m.at = now;
    m.node.getFloatTimeDomainData(m.data);
    let sum = 0;
    for (let i = 0; i < m.data.length; i++) sum += m.data[i] * m.data[i];
    const target = Math.min(1, Math.max(0, (Math.sqrt(sum / m.data.length) - 0.008) / 0.12));
    m.level += (target - m.level) * (target > m.level ? 1 : 1 - Math.exp(-dt / 0.08));
    return m.level;
  }, []);

  return { say, stop, prefetch, level };
}
