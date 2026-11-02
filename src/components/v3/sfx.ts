/**
 * Little chiptune sounds for the games on Elio's screen.
 *
 * Synthesised on the spot with the Web Audio API, so there is nothing to
 * download: a square or triangle wave with a quick envelope, sometimes
 * sliding in pitch. Muted along with Elio's voice.
 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

function audio() {
  if (!enabled || typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(from: number, to: number, ms: number, type: OscillatorType = "square", volume = 0.06, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay / 1000;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + ms / 1000);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

export const sfx = {
  /** A piece moving or turning: a tiny tick. */
  tick: () => tone(660, 620, 35, "square", 0.025),
  /** Snake eats, a point scored. */
  eat: () => {
    tone(520, 880, 70, "square", 0.05);
    tone(880, 1320, 60, "square", 0.04, 60);
  },
  /** Dino leaves the ground. */
  jump: () => tone(300, 760, 140, "triangle", 0.08),
  /** Every hundred points on the Dino run. */
  milestone: () => {
    tone(990, 990, 70, "square", 0.04);
    tone(1320, 1320, 110, "square", 0.04, 80);
  },
  /** Tetris: a piece settles. */
  lock: () => tone(180, 120, 60, "triangle", 0.07),
  /** Tetris: lines cleared, brighter the more there were. */
  clear: (n: number) => {
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < Math.min(4, n + 1); i++) tone(notes[i], notes[i], 90, "square", 0.05, i * 70);
  },
  /** Game over: a falling slide. */
  over: () => {
    tone(440, 220, 220, "square", 0.06);
    tone(220, 90, 380, "square", 0.06, 200);
  },
  /** A new game. */
  start: () => {
    tone(392, 392, 80, "square", 0.04);
    tone(523, 523, 80, "square", 0.04, 90);
    tone(784, 784, 140, "square", 0.04, 180);
  },
};
