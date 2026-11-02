import type { Mood } from "@/components/v3/face";

/**
 * Elio's face on the CRT, after L.I.S.A.: no mouth, no brows, just two big
 * soft phosphor eyes. The colour comes from the tube itself: each eye is a
 * warm white core with a blue fringe along the top and an orange one along
 * the bottom, the misregistration of an old set, and the bloom is added by
 * the screen.
 *
 * Expressions are made by cutting the eyes. A lid comes down from above,
 * curved (a sleepy bowl) or flat (a level stare) and slanted (cross or sad);
 * a cheek pushes up from below (a happy crescent); the corners square off
 * into bars. Every mood is a set of those numbers, and the face springs from
 * one to the next, so changes read as the eyes moving.
 *
 * A reaction layer answers the visitor: the eyes follow the pointer with a
 * little perspective, glance about when it rests, squash and glitch when
 * poked, go dizzy when the pointer is shaken, doze when left alone and start
 * awake again. While he talks the eyes pulse with the syllables.
 */

export const EXPRESSION_MOODS = [
  "neutral", "happy", "listening", "thinking", "surprised", "wink", "shy",
  "love", "laugh", "excited", "cool", "confused", "sad", "angry", "sleepy", "blank", "dizzy",
] as const satisfies readonly Mood[];

export type ExpressionState = {
  mood: Mood;
  /** Where to look, -1..1, already eased by the scene. */
  lookX: number;
  lookY: number;
  blink: number;
  talking: number;
  time: number;
  reduced?: boolean;
  /** The raw pointer, -1..1: its speed and stillness drive reactions. */
  px?: number;
  py?: number;
  /** The pointer is over the screen. */
  hover?: boolean;
  /** Pulsed to 1 on a tap, decays on its own. A rise is a poke. */
  squint?: number;
  /** A choice is hovered: the eyes open a touch wider. */
  attention?: number;
};

/** The three passes of each shape: blue fringe, orange fringe, warm core. */
const FRINGE_TOP = "rgba(80,170,255,0.95)";
const FRINGE_BOTTOM = "rgba(255,120,60,0.9)";
const CORE = "#fff4ef";
/** How large the face sits on the glass. */
const FACE = 1.35;
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));

/* ── Poses ────────────────────────────────────────────────────────────── */

type Eye = {
  /** Half width and half height, in screen units. */
  w: number;
  h: number;
  /** 1 a full ellipse, toward 0 a rounded bar. */
  round: number;
  /** Lid from above, 0 open to 1 shut. */
  lid: number;
  /** The lid's curve: low dips in the middle (a bowl), high is flat. */
  lidFlat: number;
  /** Lid slant: positive drops the inner corner (cross), negative the outer (sad). */
  slant: number;
  /** Cheek from below, 0 none to 1 shut: a happy crescent. */
  cheek: number;
  dy: number;
  rot: number;
};
type Glyph = "heart" | "star" | "spiral";
type Extra = "blush" | "tear" | "zzz" | "dots" | "question" | "sweat" | "sparkle";
type Pose = {
  L: Eye;
  R: Eye;
  roll: number;
  dy: number;
  /** Eyes hopping, as when he laughs. */
  bounce: number;
  /** Where the mood looks on its own, added to the pointer. */
  gazeX: number;
  gazeY: number;
  /** How far apart the eyes sit. */
  gap: number;
  glyph?: Glyph;
  extras?: Extra[];
};

const EYE: Eye = { w: 0.1, h: 0.1, round: 1, lid: 0, lidFlat: 1, slant: 0, cheek: 0, dy: 0, rot: 0 };

function pose(p: {
  both?: Partial<Eye>; L?: Partial<Eye>; R?: Partial<Eye>;
  roll?: number; dy?: number; bounce?: number; gazeX?: number; gazeY?: number; gap?: number; glyph?: Glyph; extras?: Extra[];
}): Pose {
  return {
    L: { ...EYE, ...p.both, ...p.L },
    R: { ...EYE, ...p.both, ...p.R },
    roll: p.roll ?? 0,
    dy: p.dy ?? 0,
    bounce: p.bounce ?? 0,
    gazeX: p.gazeX ?? 0,
    gazeY: p.gazeY ?? 0,
    gap: p.gap ?? 0.185,
    glyph: p.glyph,
    extras: p.extras,
  };
}

/** A level bar, as when he is unimpressed. */
const BAR: Partial<Eye> = { w: 0.105, h: 0.042, round: 0.35 };

const POSES: Record<Mood, Pose> = {
  neutral: pose({}),
  happy: pose({ both: { cheek: 0.42, h: 0.098 }, dy: -0.006 }),
  laugh: pose({ both: { cheek: 0.62, h: 0.095, w: 0.106 }, dy: -0.012, bounce: 1 }),
  listening: pose({ both: { w: 0.102, h: 0.108 }, R: { w: 0.108, h: 0.114 }, roll: 0.07 }),
  thinking: pose({
    L: { lid: 0.42, lidFlat: 1.6, slant: 0.35 }, R: { w: 0.092, h: 0.092 },
    gazeX: 0.7, gazeY: -0.75, extras: ["dots"],
  }),
  surprised: pose({ both: { w: 0.118, h: 0.122 }, gap: 0.2, dy: -0.01 }),
  wink: pose({ R: { cheek: 0.74, h: 0.092 }, L: { cheek: 0.15 } }),
  shy: pose({ both: { w: 0.086, h: 0.074, cheek: 0.32, dy: 0.03 }, roll: -0.08, gazeX: -0.4, gazeY: 0.75, gap: 0.17, extras: ["blush"] }),
  love: pose({ glyph: "heart", extras: ["blush"] }),
  excited: pose({ both: { w: 0.11, h: 0.11 }, glyph: "star", extras: ["sparkle"], dy: -0.012 }),
  cool: pose({ both: { ...BAR, lid: 0.18, slant: 0.15 }, roll: -0.04 }),
  confused: pose({
    L: { w: 0.105, h: 0.112 }, R: { w: 0.085, h: 0.08, lid: 0.38, lidFlat: 2, slant: 0.5 },
    roll: -0.07, extras: ["question"],
  }),
  sad: pose({ both: { lid: 0.36, lidFlat: 3, slant: 0.9, dy: 0.025 }, gazeY: 0.55, extras: ["tear"] }),
  // Narrowed, hard-slanted slits that tremble: glaring, not just droopy.
  angry: pose({ both: { w: 0.11, h: 0.075, round: 0.6, lid: 0.32, lidFlat: 4, slant: -0.9, cheek: 0.1 }, gap: 0.165, dy: 0.01 }),
  sleepy: pose({ both: { lid: 0.42, lidFlat: 0.05, w: 0.104 }, dy: 0.018, gazeY: 0.5, extras: ["zzz"] }),
  blank: pose({ both: BAR }),
  dizzy: pose({ glyph: "spiral", extras: ["sweat"] }),
};

const GLYPHS: Glyph[] = ["heart", "star", "spiral"];
const EXTRAS: Extra[] = ["blush", "tear", "zzz", "dots", "question", "sweat", "sparkle"];
const EYE_KEYS = Object.keys(EYE) as (keyof Eye)[];

/* ── Drawing ──────────────────────────────────────────────────────────── */

/** Lays a shape down three times, offset, for the tube's colour fringes. */
function phosphor(g: CanvasRenderingContext2D, split: number, shape: () => void) {
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = FRINGE_TOP;
  g.save();
  g.translate(-split * 0.4, -split);
  shape();
  g.restore();
  g.fillStyle = FRINGE_BOTTOM;
  g.save();
  g.translate(split * 0.4, split);
  shape();
  g.restore();
  g.restore();
  g.save();
  g.fillStyle = CORE;
  shape();
  g.restore();
}

/** One eye, centred on the origin, in its own mirrored frame. */
function eyeShape(g: CanvasRenderingContext2D, e: Eye, side: -1 | 1, open: number, sx: number, sy: number) {
  const w = e.w * sx;
  const h = e.h * sy;
  g.save();
  g.translate(0, e.dy);
  g.rotate(e.rot * -side);
  g.scale(1, Math.max(0.05, open));

  // The lid: an ellipse lowered from above. A small, round one leaves a
  // bowl-shaped top edge; a wide, flat one a level stare. Tilted for mood.
  if (e.lid > 0.001) {
    const edge = -h + e.lid * 2 * h;
    const rx = w * (1.05 + e.lidFlat * 1.3);
    const ry = h * (0.9 + e.lidFlat * 1.2);
    g.save();
    g.rotate(e.slant * 0.45 * side);
    g.beginPath();
    g.rect(-w * 4, -h * 4, w * 8, h * 8);
    g.ellipse(0, edge - ry, rx, ry, 0, 0, Math.PI * 2);
    g.restore();
    g.clip("evenodd");
  }
  // The cheek: an ellipse pushed up from below, leaving a crescent.
  if (e.cheek > 0.001) {
    const edge = h - e.cheek * 2 * h;
    const rx = w * 1.5;
    const ry = h * 1.1;
    g.beginPath();
    g.rect(-w * 4, -h * 4, w * 8, h * 8);
    g.ellipse(0, edge + ry, rx, ry, 0, 0, Math.PI * 2);
    g.clip("evenodd");
  }
  g.beginPath();
  if (e.round > 0.98) g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  else g.roundRect(-w, -h, w * 2, h * 2, Math.min(w, h) * (0.25 + e.round * 0.75));
  g.fill();
  g.restore();
}

function glyphShape(g: CanvasRenderingContext2D, glyph: Glyph, side: -1 | 1, t: number) {
  g.beginPath();
  if (glyph === "heart") {
    const k = 1.15 + Math.abs(Math.sin(t * 4)) * 0.08;
    g.scale(k, k);
    g.moveTo(0, 0.089);
    g.bezierCurveTo(-0.026, 0.061, -0.103, 0.007, -0.084, -0.043);
    g.bezierCurveTo(-0.069, -0.087, -0.021, -0.084, 0, -0.048);
    g.bezierCurveTo(0.021, -0.084, 0.069, -0.087, 0.084, -0.043);
    g.bezierCurveTo(0.103, 0.007, 0.026, 0.061, 0, 0.089);
    g.fill();
  } else if (glyph === "star") {
    g.rotate(Math.sin(t * 2.4 + side) * 0.2);
    const k = 1.1 + Math.sin(t * 7 + side) * 0.06;
    g.scale(k, k);
    g.moveTo(0, -0.1);
    g.quadraticCurveTo(0.02, -0.02, 0.1, 0);
    g.quadraticCurveTo(0.02, 0.02, 0, 0.1);
    g.quadraticCurveTo(-0.02, 0.02, -0.1, 0);
    g.quadraticCurveTo(-0.02, -0.02, 0, -0.1);
    g.fill();
  } else {
    // A glowing spiral line, turning: the classic seeing-stars eye.
    g.rotate(t * 6 * side);
    g.strokeStyle = g.fillStyle;
    g.lineWidth = 0.016;
    g.lineCap = "round";
    for (let a = 0; a <= Math.PI * 5.2; a += 0.12) {
      const r = 0.004 + a * 0.0058;
      g.lineTo(Math.cos(a * side) * r, Math.sin(a * side) * r);
    }
    g.stroke();
  }
}

/** Diamond-ish drop, for tears and sweat. */
function dropShape(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y - s * 1.7);
  g.quadraticCurveTo(x + s * 1.2, y + s * 0.2, x, y + s);
  g.quadraticCurveTo(x - s * 1.2, y + s * 0.2, x, y - s * 1.7);
  g.fill();
}

function drawExtra(g: CanvasRenderingContext2D, x: Extra, a: number, cx: number, cy: number, gap: number, t: number, split: number) {
  g.save();
  g.globalAlpha *= a;
  switch (x) {
    case "blush":
      g.save();
      g.globalAlpha *= 0.4;
      g.fillStyle = "rgba(255,140,110,1)";
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse(cx + side * (gap + 0.02), cy + 0.13, 0.055, 0.022, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      break;
    case "tear": {
      const p = (t * 0.45) % 1;
      g.globalAlpha *= 1 - p;
      phosphor(g, split * 0.5, () => dropShape(g, cx + gap - 0.04, cy + 0.11 + p * 0.17, 0.014));
      break;
    }
    case "sweat":
      phosphor(g, split * 0.5, () => dropShape(g, cx + gap + 0.14, cy - 0.12 + Math.sin(t * 3) * 0.006, 0.017));
      break;
    case "zzz":
      g.strokeStyle = CORE;
      g.lineWidth = 0.01;
      g.lineCap = "round";
      g.lineJoin = "round";
      for (let n = 0; n < 3; n++) {
        const p = (t * 0.35 + n / 3) % 1;
        const s = 0.016 + p * 0.018;
        const x0 = cx + gap + 0.1 + p * 0.09;
        const y0 = cy - 0.11 - p * 0.18;
        g.save();
        g.globalAlpha *= Math.sin(p * Math.PI);
        g.beginPath();
        g.moveTo(x0 - s, y0 - s);
        g.lineTo(x0 + s, y0 - s);
        g.lineTo(x0 - s, y0 + s);
        g.lineTo(x0 + s, y0 + s);
        g.stroke();
        g.restore();
      }
      break;
    case "dots":
      for (let n = 0; n < 3; n++) {
        g.save();
        g.globalAlpha *= 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4 - n * 0.9));
        phosphor(g, split * 0.4, () => {
          g.beginPath();
          g.arc(cx + gap + 0.12 + n * 0.04, cy - 0.15 - n * 0.035, 0.01 + n * 0.004, 0, Math.PI * 2);
          g.fill();
        });
        g.restore();
      }
      break;
    case "question": {
      const x0 = cx + gap + 0.14;
      const y0 = cy - 0.17 + Math.sin(t * 3) * 0.008;
      g.strokeStyle = CORE;
      g.fillStyle = CORE;
      g.lineWidth = 0.014;
      g.lineCap = "round";
      g.beginPath();
      g.arc(x0, y0, 0.028, Math.PI * 1.1, Math.PI * 2.35);
      g.quadraticCurveTo(x0, y0 + 0.03, x0, y0 + 0.05);
      g.stroke();
      g.beginPath();
      g.arc(x0, y0 + 0.078, 0.009, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "sparkle":
      for (const [ox, oy, ph] of [[-0.34, -0.16, 0], [0.35, -0.13, 2], [0.31, 0.13, 4]] as const) {
        const k = Math.max(0, Math.sin(t * 3.2 + ph));
        if (k < 0.05) continue;
        const r = 0.022 * k;
        const x0 = cx + ox;
        const y0 = cy + oy;
        phosphor(g, split * 0.4, () => {
          g.beginPath();
          g.moveTo(x0, y0 - r * 2);
          g.quadraticCurveTo(x0, y0, x0 + r * 2, y0);
          g.quadraticCurveTo(x0, y0, x0, y0 + r * 2);
          g.quadraticCurveTo(x0, y0, x0 - r * 2, y0);
          g.quadraticCurveTo(x0, y0, x0, y0 - r * 2);
          g.fill();
        });
      }
      break;
  }
  g.restore();
}

/* ── The living face ──────────────────────────────────────────────────── */

const copy = (p: Pose) => ({ L: { ...p.L }, R: { ...p.R }, roll: p.roll, dy: p.dy, bounce: p.bounce, gazeX: p.gazeX, gazeY: p.gazeY, gap: p.gap });

/** Owns the face between frames: the springing pose and what the visitor has been doing. */
export class FaceAnimator {
  private cur = copy(POSES.neutral);
  private glyphs = Object.fromEntries(GLYPHS.map((k) => [k, 0])) as Record<Glyph, number>;
  private extras = Object.fromEntries(EXTRAS.map((k) => [k, 0])) as Record<Extra, number>;
  private last = -1;
  private started = false;
  // Reactions.
  private prev = { px: 0, py: 0, squint: 0 };
  private shake = { n: 0, dir: 0, x: 0 };
  private dizzyUntil = 0;
  private still = 0;
  private startleUntil = 0;
  private squash = { v: 1, vel: 0 };
  private glance = { x: 0, y: 0, tx: 0, ty: 0, next: 2 };
  private talk = { v: 0, target: 0, next: 0 };
  private glitch = 0;

  /** The mood actually shown, after the visitor's own reactions. */
  private react(s: ExpressionState, dt: number, t: number): Mood {
    const px = s.px ?? s.lookX;
    const py = s.py ?? s.lookY;
    const moved = Math.hypot(px - this.prev.px, py - this.prev.py);
    this.prev.px = px;
    this.prev.py = py;

    // Shaking the pointer back and forth makes him dizzy. Counted in
    // reversals, so one fast sweep across the page is not a shake.
    const step = px - this.shake.x;
    this.shake.x = px;
    if (Math.abs(step) > 0.02) {
      const dir = Math.sign(step);
      if (this.shake.dir && dir !== this.shake.dir) this.shake.n += 1;
      this.shake.dir = dir;
    }
    this.shake.n = Math.max(0, this.shake.n - dt * 2.5);
    if (this.shake.n >= 5) {
      this.dizzyUntil = t + 1.8;
      this.shake.n = 0;
    }

    // Left alone he dozes off, and starts when the pointer moves again.
    if (moved > 0.002) {
      if (this.still > 18) this.startleUntil = t + 0.9;
      this.still = 0;
    } else this.still += dt;

    // A poke squashes the eyes and glitches the tube.
    const sq = s.squint ?? 0;
    if (sq > this.prev.squint + 0.3) {
      this.squash.vel -= 7;
      this.glitch = 1;
    }
    this.prev.squint = sq;

    const calm = s.mood === "neutral" || s.mood === "happy" || s.mood === "listening";
    if (!calm) return s.mood;
    if (t < this.startleUntil) return "surprised";
    if (t < this.dizzyUntil) return "dizzy";
    if (this.still > 18 && s.mood === "neutral") return "sleepy";
    if (s.hover) return "happy";
    return s.mood;
  }

  draw(g: CanvasRenderingContext2D, size: number, s: ExpressionState) {
    const reduced = !!s.reduced;
    const t = reduced ? 0 : s.time;
    const dt = this.last < 0 ? 0 : clamp(s.time - this.last, 0, 0.05);
    this.last = s.time;

    const mood = reduced ? s.mood : this.react(s, dt, t);
    const target = POSES[mood];
    const snap = reduced || !this.started;
    this.started = true;

    // Spring every number of the pose toward the target.
    const k = snap ? 1 : 1 - Math.exp(-dt * 12);
    const c = this.cur;
    for (const side of ["L", "R"] as const) {
      for (const key of EYE_KEYS) c[side][key] += (target[side][key] - c[side][key]) * k;
    }
    c.roll += (target.roll - c.roll) * k;
    c.dy += (target.dy - c.dy) * k;
    c.bounce += (target.bounce - c.bounce) * k;
    c.gap += (target.gap - c.gap) * k;
    c.gazeX += (target.gazeX - c.gazeX) * k;
    c.gazeY += (target.gazeY - c.gazeY) * k;
    const fade = snap ? 1 : 1 - Math.exp(-dt * 9);
    for (const key of GLYPHS) this.glyphs[key] += ((target.glyph === key ? 1 : 0) - this.glyphs[key]) * fade;
    for (const key of EXTRAS) this.extras[key] += ((target.extras?.includes(key) ? 1 : 0) - this.extras[key]) * fade;
    this.glitch = Math.max(0, this.glitch - dt * 2.2);

    // Squash and stretch after a poke: a damped spring around 1.
    const sq = this.squash;
    if (!snap) {
      sq.vel += (-220 * (sq.v - 1) - 15 * sq.vel) * dt;
      sq.v = clamp(sq.v + sq.vel * dt, 0.45, 1.5);
    } else {
      sq.v = 1;
      sq.vel = 0;
    }

    // When the pointer rests, the eyes glance about on their own.
    const gl = this.glance;
    if (!reduced) {
      gl.next -= dt;
      if (gl.next <= 0) {
        const idle = this.still > 1.2;
        gl.tx = idle ? (Math.random() * 2 - 1) * 0.45 : 0;
        gl.ty = idle ? (Math.random() * 2 - 1) * 0.3 : 0;
        gl.next = 0.8 + Math.random() * 2.4;
      }
      // Saccades: quick, not drifting.
      const q = 1 - Math.exp(-dt * 22);
      gl.x += (gl.tx - gl.x) * q;
      gl.y += (gl.ty - gl.y) * q;
    }

    // Speech: with no mouth, the eyes pulse with the voice. s.talking is how
    // loud Elio is this frame, so they squeeze on each syllable and rest in
    // the pauses, rather than on a made-up rhythm.
    const tk = this.talk;
    const speaking = reduced ? 0 : clamp(s.talking, 0, 1);
    tk.v += (speaking * 0.1 - tk.v) * (1 - Math.exp(-dt * 30));

    const lx = clamp(s.lookX + c.gazeX * 0.6 + gl.x, -1.2, 1.2);
    const ly = clamp(s.lookY + c.gazeY * 0.6 + gl.y, -1.2, 1.2);
    // A poke tears the picture sideways for a moment.
    const tear = this.glitch > 0.05 ? (Math.random() * 2 - 1) * this.glitch * 0.03 : 0;
    const tremble = mood === "angry" && !reduced ? Math.sin(t * 55) * 0.0025 : 0;
    const cx = 0.5 + lx * 0.04 + tear + tremble;
    const cy = 0.46 + ly * 0.035 + c.dy - Math.abs(Math.sin(t * 9)) * 0.012 * c.bounce;
    const gap = c.gap - Math.abs(lx) * 0.012;
    const breathe = reduced ? 1 : 1 + Math.sin(t * 1.7) * 0.012;
    const wide = 1 + clamp(s.attention ?? 0, 0, 1) * 0.08;
    const glyphOn = Math.max(...GLYPHS.map((key) => this.glyphs[key]));
    const open = 1 - clamp(s.blink, 0, 1);
    const split = 0.007 + this.glitch * 0.02;

    g.save();
    g.scale(size, size);
    // Phosphor is never quite sharp.
    g.filter = `blur(${Math.max(1, Math.round(size * 0.0035))}px)`;
    g.translate(cx, cy);
    g.rotate(c.roll);
    // Poses are drawn at a working size and set larger on the glass.
    g.scale(FACE, FACE);
    g.translate(-cx, -cy);

    for (const side of [-1, 1] as const) {
      // The eye on the side he looks toward is the nearer one, a touch larger.
      const near = 1 + lx * side * 0.07;
      const eye = side === -1 ? c.L : c.R;
      const talkY = 1 - tk.v * (side === -1 ? 1 : 0.8);
      const talkX = 1 + tk.v * 0.4;
      g.save();
      g.translate(cx + side * gap, cy);
      if (glyphOn < 0.98) {
        g.save();
        g.globalAlpha = 1 - glyphOn;
        const shrink = 1 - glyphOn * 0.6;
        const sx = near * (2 - sq.v) * shrink * talkX;
        const sy = near * sq.v * breathe * wide * shrink * talkY;
        phosphor(g, split, () => eyeShape(g, eye, side, open, sx, sy));
        g.restore();
      }
      for (const key of GLYPHS) {
        const a = this.glyphs[key];
        if (a < 0.02) continue;
        g.save();
        g.globalAlpha = a;
        const pop = (0.5 + a * 0.5) * near;
        g.scale(pop * (2 - sq.v), pop * sq.v * Math.max(0.08, open) * talkY);
        phosphor(g, split / pop, () => glyphShape(g, key, side, t));
        g.restore();
      }
      g.restore();
    }

    for (const key of EXTRAS) {
      const a = this.extras[key];
      if (a > 0.02) drawExtra(g, key, a, cx, cy, gap, t, split);
    }
    g.filter = "none";
    g.restore();
  }
}
