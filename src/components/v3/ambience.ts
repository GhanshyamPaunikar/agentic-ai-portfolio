"use client";

import { useEffect, useRef } from "react";

/**
 * The room tone.
 *
 * Synthesised rather than streamed: a loop long enough not to hear the seam
 * would be a megabyte or two of audio for something nobody is meant to
 * notice, and a short one announces itself every few seconds. Three detuned
 * sines under a slow filter sweep, plus a breath of filtered noise for air,
 * come to a few hundred bytes of code and never repeat.
 *
 * It sits well under the voice. The bed is quiet to begin with and ducks
 * further whenever the assistant is speaking, because the one thing a
 * cinematic hum must not do is make a sentence harder to follow.
 */

/** Resting level. Low: this is a floor, not a track. */
const BED = 0.05;
/** How far it drops while the assistant speaks. */
const DUCK = 0.38;

/**
 * A context made inside the visitor's first click.
 *
 * Safari only lets an AudioContext run if it was created, or resumed, in the
 * same call stack as a user gesture. The bed itself starts a render later,
 * in an effect, which is too late, so the click that enters the site makes
 * the context here and the hook picks it up.
 */
let primed: AudioContext | null = null;
/** The room tone's context, so the first gesture can wake it. */
let live: AudioContext | null = null;

export function primeAudio() {
  if (typeof window === "undefined") return;
  // The page opens by itself, so the room tone's context is usually made
  // before any gesture and born suspended; the first click is the moment it
  // is allowed to run.
  if (live && live.state === "suspended") void live.resume();
  if (primed || live) {
    void primed?.resume();
    return;
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    primed = new Ctor();
    void primed.resume();
  } catch {
    primed = null;
  }
}

type Rig = {
  ctx: AudioContext;
  master: GainNode;
  stop: () => void;
};

function build(ctx: AudioContext): Rig {
  const master = ctx.createGain();
  master.gain.value = 0;

  // A gentle shelf of air, so the hum is not purely tonal.
  const air = ctx.createGain();
  air.gain.value = 0.055;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 760;
  noiseFilter.Q.value = 0.55;

  const frames = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Brown-ish noise: softer than white, and it does not hiss.
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  noise.connect(noiseFilter).connect(air).connect(master);

  // The drone. A low root with two near-unison partials above it: the beating
  // between them is what keeps it from sounding like a test tone.
  const voices: OscillatorNode[] = [];
  const tone = ctx.createGain();
  tone.gain.value = 0.42;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  lp.Q.value = 0.6;
  tone.connect(lp).connect(master);

  for (const [hz, level] of [
    [55, 0.5],
    [82.5, 0.22],
    [110.3, 0.16],
    [164.8, 0.07],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(tone);
    voices.push(osc);
  }

  // A very slow sweep on the filter, so the room seems to breathe.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.045;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 150;
  lfo.connect(lfoDepth).connect(lp.frequency);

  master.connect(ctx.destination);
  noise.start();
  lfo.start();
  for (const v of voices) v.start();

  return {
    ctx,
    master,
    stop: () => {
      try {
        noise.stop();
        lfo.stop();
        for (const v of voices) v.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

/**
 * Runs the bed while `on`, and pulls it down while `speaking`.
 *
 * Nothing starts until the first call with `on` true, which the page only
 * makes once the visitor has interacted: an AudioContext created before that
 * is born suspended and would sit there doing nothing.
 */
export function useAmbience(on: boolean, speaking: boolean) {
  const rig = useRef<Rig | null>(null);

  useEffect(() => {
    if (!on) {
      if (rig.current) {
        const { ctx, master, stop } = rig.current;
        rig.current = null;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        setTimeout(() => {
          stop();
          void ctx.close();
        }, 1600);
      }
      return;
    }
    if (rig.current) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      // Prefer the context made inside the entering click; see primeAudio.
      const ctx = primed && primed.state !== "closed" ? primed : new Ctor();
      primed = null;
      live = ctx;
      void ctx.resume();
      rig.current = build(ctx);
      // Fade in over a few seconds. A room tone that arrives is a sound
      // effect; one that is simply there is a room.
      rig.current.master.gain.setTargetAtTime(BED, ctx.currentTime, 2.2);
    } catch {
      /* no audio on this machine; the page is fine without it */
    }
  }, [on]);

  useEffect(() => {
    const r = rig.current;
    if (!r) return;
    r.master.gain.cancelScheduledValues(r.ctx.currentTime);
    r.master.gain.setTargetAtTime(speaking ? BED * DUCK : BED, r.ctx.currentTime, speaking ? 0.25 : 0.9);
  }, [speaking, on]);

  useEffect(
    () => () => {
      const r = rig.current;
      rig.current = null;
      if (!r) return;
      r.stop();
      void r.ctx.close();
    },
    [],
  );
}
