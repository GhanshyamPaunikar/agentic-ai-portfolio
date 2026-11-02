import * as THREE from "three";

/**
 * The screen face, drawn to a canvas every frame.
 *
 * The reference streams short videos for each expression. Drawing instead
 * means there is nothing to load, nothing to buffer, and the eyes can follow
 * the cursor continuously rather than cutting between recorded takes — a
 * video can only play a blink, it cannot look somewhere specific, and it
 * certainly cannot show a project.
 */

/**
 * What the face is doing.
 *
 * Expressions are shapes rather than frames: each one is a path the eye light
 * is drawn along, so the character can be pleased *and* looking at the cursor
 * *and* mid-blink at the same time. Recorded takes cannot overlap like that.
 */
export type Mood =
  /** Two round blobs. The resting face. */
  | "neutral"
  /** Arcs turned up. Used when it greets someone or likes an answer. */
  | "happy"
  /** Narrowed and turned aside, for the beat before an answer. */
  | "thinking"
  /** Wide and round, for a number worth reacting to. */
  | "surprised"
  /** One eye shut. Used once, sparingly, or it becomes a tic. */
  | "wink"
  /** Half-lidded and low, while nothing is happening. */
  | "sleepy"
  /** Flat lines. The screen is on but nobody is home. */
  | "blank"
  /** Spirals. Someone has tapped the glass. */
  | "dizzy"
  /** Angled down toward the nose. Tap it enough times and it minds. */
  | "angry"
  /** Eyes down, cheeks pink. Paid a compliment, or asked if it likes you. */
  | "shy"
  /** Two beating hearts. Thanked, or told something kind. */
  | "love"
  /** "> <" and a wide open mouth. Something was funny, or it was tickled. */
  | "laugh"
  /** Twinkling stars. A big number, a great fit. */
  | "excited"
  /** Sunglasses and a smirk. Showing off his work a little. */
  | "cool"
  /** One brow up and a question mark. The question made no sense to it. */
  | "confused"
  /** Brows up in the middle, a frown, a tear. The honest answer is a no. */
  | "sad"
  /** Watching the box while the visitor types. */
  | "listening";

/**
 * What the screen is showing instead of a face.
 *
 * One shape covers every kind of card — a project, a certificate, a stack, a
 * greeting — because a CRT showing six different layouts reads as six
 * different websites. The fields that are set decide what gets drawn.
 */
export type Panel = {
  /** The small line along the top: a category, an issuer, a year. */
  kicker: string;
  title: string;
  /** One number worth remembering, drawn large. */
  metric?: string;
  metricLabel?: string;
  /** Short items along the foot. */
  chips?: string[];
  /** Used in place of a metric, for cards that are a list rather than a figure. */
  lines?: string[];
  /** A picture to fill the screen with, the title laid over its foot. */
  image?: string;
  /** Show the whole picture inside the glass, title beneath, rather than
      filling it: for a page whose edges matter, like a profile. */
  whole?: boolean;
  /**
   * When set, the screen can be tapped: this is the label on the button
   * drawn on the card, and onTap is what a tap does.
   */
  tap?: string;
  onTap?: () => void;
};

export type FaceState = {
  /** Where the eyes are looking, -1 to 1 on each axis. */
  lookX: number;
  lookY: number;
  /** 0 open, 1 shut. */
  blink: number;
  /** 0 round, 1 narrowed. */
  squint: number;
  /** Raised while the assistant is typing: flicker and a brighter screen. */
  talking: number;
  /** Seconds, for scanlines and the occasional glitch band. */
  time: number;
  /** The expression. */
  mood?: Mood;
  /** When set, the screen shows this instead of the face. */
  panel?: Panel | null;
  /** 0 to 1 while the screen changes over, so it wipes rather than cuts. */
  panelIn?: number;
  /** 0 off, 1 fully on. The set warms up rather than appearing lit. */
  power?: number;
};

const W = 512;
const H = 384;

/** The phosphor. Everything on this screen is a tint of it. */
const GLOW = "120,230,190";

export class Face {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private glitchUntil = 0;
  private glitchSeed = 0;

  /** Pictures for cards, drawn once to screen size so each frame is a single copy. */
  private readonly pictures = new Map<string, HTMLCanvasElement | null>();

  private picture(src: string): HTMLCanvasElement | null {
    if (this.pictures.has(src)) return this.pictures.get(src) ?? null;
    this.pictures.set(src, null);
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.round(W * this.k);
      c.height = Math.round(H * this.k);
      const g = c.getContext("2d")!;
      g.scale(this.k, this.k);
      // Cover: fill the screen, cropping whichever way the picture overflows.
      const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * k;
      const h = img.naturalHeight * k;
      g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      this.pictures.set(src, c);
    };
    img.src = src;
    return null;
  }

  /** Pixels per drawing unit: everything is drawn at 512 by 384 and scaled. */
  private readonly k: number;

  /** The canvas drawn into, for callers that composite it elsewhere. */
  get canvas() {
    return this.ctx.canvas;
  }

  constructor(scale = 1) {
    this.k = scale;
    const c = document.createElement("canvas");
    c.width = Math.round(W * scale);
    c.height = Math.round(H * scale);
    this.ctx = c.getContext("2d")!;
    this.ctx.scale(scale, scale);
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // The screen mesh is a flat quad; no filtering surprises wanted.
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  /**
   * Flips the texture vertically.
   *
   * The model's screen is a copy of the cabinet's glass, and that glass is
   * wound the other way up, so the canvas lands on it upside down. Nothing
   * showed while the face was two symmetrical blobs of light — the gaze was
   * simply tracking the wrong way vertically, which is not something an eye
   * without a pupil makes obvious. Words on the screen made it plain at once.
   */
  flipV() {
    this.texture.repeat.set(1, -1);
    this.texture.offset.set(0, 1);
  }

  /** One blurred blob of light. Two of these are the resting face. */
  private blob(x: number, y: number, rx: number, ry: number, bright: number) {
    const g = this.ctx;
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    // Blown out in the middle and falling away fast, so it reads as light
    // coming through the tube rather than a white shape drawn on it.
    grad.addColorStop(0, `rgba(255,255,255,${1.0 * bright})`);
    grad.addColorStop(0.3, `rgba(245,255,252,${0.92 * bright})`);
    grad.addColorStop(0.55, `rgba(190,245,225,${0.45 * bright})`);
    grad.addColorStop(0.8, `rgba(${GLOW},${0.12 * bright})`);
    grad.addColorStop(1, `rgba(${GLOW},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  /**
   * A curved eye, stroked rather than filled.
   *
   * A smile cannot be made by squashing a circle — squash it far enough and
   * you get a line, which reads as asleep, not pleased. The shape has to
   * actually bend, so the happy and sleepy eyes are arcs drawn with the glow
   * carried by a wide blurred stroke.
   *
   * A positive `lift` bows the arc upward, in canvas space and on the glass
   * alike: flipV corrects the screen mesh's inverted winding, so by the time
   * anything is drawn the mapping is the right way up. Text proves it, and
   * curves follow the same rule.
   */
  private arc(x: number, y: number, rx: number, lift: number, bright: number) {
    const g = this.ctx;
    g.save();
    g.lineCap = "round";
    g.shadowColor = `rgba(${GLOW},${0.9 * bright})`;
    // Three passes: a wide dim halo, then tighter and brighter, so the stroke
    // falls off the way the blob does instead of reading as a drawn line.
    for (const [width, blur, alpha] of [
      [rx * 0.62, 26, 0.3],
      [rx * 0.42, 14, 0.6],
      [rx * 0.24, 6, 1.0],
    ] as const) {
      g.shadowBlur = blur;
      g.lineWidth = width;
      g.strokeStyle = `rgba(255,255,255,${alpha * bright})`;
      g.beginPath();
      // A quadratic through three points: the bend is `lift`, up or down.
      g.moveTo(x - rx, y);
      g.quadraticCurveTo(x, y - lift * 2, x + rx, y);
      g.stroke();
    }
    g.restore();
  }

  /** A spiral, wound outward from the middle. Two of these mean concussion. */
  private spiral(x: number, y: number, r: number, turns: number, phase: number, bright: number) {
    const g = this.ctx;
    g.save();
    g.lineCap = "round";
    g.shadowColor = `rgba(${GLOW},${0.9 * bright})`;
    for (const [width, blur, alpha] of [
      [r * 0.34, 18, 0.35],
      [r * 0.2, 8, 0.95],
    ] as const) {
      g.shadowBlur = blur;
      g.lineWidth = width;
      g.strokeStyle = `rgba(255,255,255,${alpha * bright})`;
      g.beginPath();
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = phase + t * turns * Math.PI * 2;
        const rad = r * t;
        const px = x + Math.cos(a) * rad;
        const py = y + Math.sin(a) * rad;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    g.restore();
  }

  /** Draws whichever pair of eyes the mood calls for. */
  private eyes(s: FaceState, bright: number) {
    const mood = s.mood ?? "neutral";
    const open = 1 - s.blink;
    const rx = W * 0.135;
    const gap = W * 0.2;

    // Thinking looks away and up; it is the only mood that moves the gaze on
    // its own, which is what makes it read as thought rather than a squint.
    const aside = mood === "thinking" ? 0.42 : 0;
    const droop = mood === "sleepy" ? 0.3 : mood === "thinking" ? -0.3 : 0;
    const cx = W / 2 + (s.lookX + aside) * W * 0.085;
    const cy = H / 2 + (s.lookY + droop) * H * 0.075;

    // A blink always wins: it collapses whatever shape is underneath.
    if (open < 0.22) {
      const dim = bright * 0.9 * (0.4 + open);
      this.arc(cx - gap, cy, rx * 0.8, 0, dim);
      this.arc(cx + gap, cy, rx * 0.8, 0, dim);
      return;
    }

    switch (mood) {
      case "happy":
        this.arc(cx - gap, cy + rx * 0.3, rx * 0.74, rx * 0.78, bright);
        this.arc(cx + gap, cy + rx * 0.3, rx * 0.74, rx * 0.78, bright);
        return;
      case "sleepy":
        this.arc(cx - gap, cy + rx * 0.3, rx * 0.8, -rx * 0.22, bright * 0.8);
        this.arc(cx + gap, cy + rx * 0.3, rx * 0.8, -rx * 0.22, bright * 0.8);
        return;
      case "blank":
        this.arc(cx - gap, cy, rx * 0.7, 0, bright * 0.75);
        this.arc(cx + gap, cy, rx * 0.7, 0, bright * 0.75);
        return;
      case "dizzy": {
        // Turning, and out of step with each other, which is what sells it.
        const spin = s.time * 2.6;
        this.spiral(cx - gap, cy, rx * 1.05, 2.2, spin, bright);
        this.spiral(cx + gap, cy, rx * 1.05, 2.2, -spin + 1.3, bright);
        return;
      }
      case "angry": {
        // Not a frown: a pair of lids dropped at an angle toward the middle,
        // which is what reads as cross rather than as miserable.
        const g = this.ctx;
        const lid = (sx: number, sign: number) => {
          g.save();
          g.translate(sx, cy);
          g.rotate(sign * 0.42);
          g.translate(-sx, -cy);
          this.arc(sx, cy + rx * 0.1, rx * 0.9, -rx * 0.12, bright);
          g.restore();
        };
        lid(cx - gap, 1);
        lid(cx + gap, -1);
        return;
      }
      case "wink":
        this.arc(cx - gap, cy + rx * 0.2, rx * 0.86, rx * 0.45, bright);
        this.blob(cx + gap, cy, rx, rx * 0.95, bright);
        return;
      case "surprised": {
        const r = rx * 1.18;
        this.blob(cx - gap, cy, r, r, bright);
        this.blob(cx + gap, cy, r, r, bright);
        return;
      }
      case "thinking": {
        const ry = rx * 0.52;
        this.blob(cx - gap, cy, rx * 0.92, ry, bright);
        this.blob(cx + gap, cy, rx * 0.92, ry * 0.8, bright);
        return;
      }
      default: {
        const ry = rx * (0.95 - 0.45 * s.squint) * Math.max(0.04, open);
        this.blob(cx - gap, cy, rx, ry, bright);
        this.blob(cx + gap, cy, rx, ry, bright);
      }
    }
  }

  /** Text that will not run off the glass, cut at the last word that fits. */
  private fit(text: string, max: number) {
    const g = this.ctx;
    if (g.measureText(text).width <= max) return text;
    let cut = text;
    while (cut.length > 1 && g.measureText(cut + "…").width > max) {
      cut = cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length - 1);
    }
    return cut + "…";
  }

  /** The button on a tappable card, breathing gently so it reads as live. */
  private tapPill(label: string, time: number, top: boolean) {
    const g = this.ctx;
    const pad = W * 0.075;
    g.font = `700 ${Math.round(W * 0.046)}px ui-monospace, monospace`;
    g.textBaseline = "middle";
    const text = `${label.toUpperCase()}  \u25B8`;
    const w = g.measureText(text).width + W * 0.07;
    const h = H * 0.13;
    const x = W - pad - w;
    const y = top ? pad * 0.8 : H - pad * 0.5 - h;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    g.save();
    g.shadowColor = `rgba(${GLOW},${0.5 + 0.4 * pulse})`;
    g.shadowBlur = 10 + 10 * pulse;
    g.fillStyle = `rgba(150,255,215,${0.85 + 0.15 * pulse})`;
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
    g.fill();
    g.restore();
    g.fillStyle = "#04140f";
    g.fillText(text, x + W * 0.035, y + h / 2 + 1);
    g.textBaseline = "alphabetic";
  }

  /**
   * A card: a kicker, a title, then either one large figure or a short list.
   *
   * Everything the screen has to say uses this, so a certificate and a project
   * and a greeting all look like the same machine talking.
   */
  private card(p: Panel, amount: number, time: number) {
    const g = this.ctx;
    const pad = W * 0.075;
    const right = W - pad * 2;
    g.save();
    g.globalAlpha = Math.min(1, amount);

    // A wipe, so it arrives like a channel changing rather than a fade.
    g.beginPath();
    g.rect(0, 0, W, H * Math.min(1, amount * 1.25));
    g.clip();

    g.fillStyle = "rgba(4,16,13,0.93)";
    g.fillRect(0, 0, W, H);

    // A project with a picture: the picture fills the screen, and its name
    // sits over a shade at the foot. Until it has loaded, the text card shows.
    const pic = p.image ? this.picture(p.image) : null;
    if (pic) {
      g.drawImage(pic, 0, 0, W, H);
      const shade = g.createLinearGradient(0, H * 0.55, 0, H);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.78)");
      g.fillStyle = shade;
      g.fillRect(0, H * 0.55, W, H * 0.45);
      g.textBaseline = "alphabetic";
      g.fillStyle = "rgba(255,255,255,0.96)";
      g.font = `600 ${Math.round(W * 0.062)}px ui-sans-serif, system-ui, sans-serif`;
      g.fillText(this.fit(p.title, right), pad, H - pad - H * 0.075);
      g.fillStyle = "rgba(255,255,255,0.72)";
      g.font = `500 ${Math.round(W * 0.03)}px ui-monospace, monospace`;
      g.fillText(this.fit(p.kicker.toUpperCase(), right), pad, H - pad);
      if (p.tap) this.tapPill(p.tap, time, true);
      g.restore();
      return;
    }

    g.textBaseline = "top";
    g.fillStyle = `rgba(150,255,215,0.6)`;
    g.font = `500 ${Math.round(W * 0.032)}px ui-monospace, monospace`;
    g.fillText(this.fit(p.kicker.toUpperCase(), right), pad, pad);

    g.fillStyle = "rgba(236,255,248,0.96)";
    const titleSize = p.title.length > 22 ? 0.058 : 0.075;
    g.font = `600 ${Math.round(W * titleSize)}px ui-sans-serif, system-ui, sans-serif`;
    g.fillText(this.fit(p.title, right), pad, pad + H * 0.085);

    if (p.metric) {
      // The number, large, because it is the thing worth taking away.
      g.fillStyle = "rgba(255,255,255,0.98)";
      g.font = `700 ${Math.round(W * 0.17)}px ui-sans-serif, system-ui, sans-serif`;
      g.fillText(this.fit(p.metric, right), pad, H * 0.38);
      if (p.metricLabel) {
        g.fillStyle = `rgba(150,255,215,0.62)`;
        g.font = `500 ${Math.round(W * 0.03)}px ui-monospace, monospace`;
        g.fillText(this.fit(p.metricLabel.toUpperCase(), right), pad, H * 0.63);
      }
    } else if (p.lines?.length) {
      g.font = `500 ${Math.round(W * 0.038)}px ui-sans-serif, system-ui, sans-serif`;
      let y = H * 0.4;
      for (const line of p.lines.slice(0, 4)) {
        g.fillStyle = "rgba(226,255,245,0.88)";
        g.fillText(this.fit(line, right), pad, y);
        y += H * 0.082;
      }
    }

    // Chips along the foot.
    if (p.chips?.length) {
      let x = pad;
      const cy = H * 0.76;
      g.font = `500 ${Math.round(W * 0.029)}px ui-monospace, monospace`;
      for (const item of p.chips) {
        const w = g.measureText(item).width + W * 0.034;
        // Leave room for the tap button at the foot's right.
        if (x + w > (p.tap ? W * 0.46 : W - pad)) break;
        g.fillStyle = `rgba(${GLOW},0.16)`;
        g.beginPath();
        g.roundRect(x, cy, w, H * 0.075, H * 0.0375);
        g.fill();
        g.fillStyle = "rgba(214,255,240,0.9)";
        g.fillText(item, x + W * 0.017, cy + H * 0.018);
        x += w + W * 0.018;
      }
    }

    // A cursor at the foot, so the readout looks live rather than printed.
    if (Math.floor(time * 1.6) % 2 === 0) {
      g.fillStyle = `rgba(150,255,215,0.75)`;
      g.fillRect(pad, H * 0.885, W * 0.022, H * 0.028);
    }
    if (p.tap) this.tapPill(p.tap, time, false);
    g.restore();
  }

  draw(s: FaceState) {
    const g = this.ctx;
    const power = s.power ?? 1;

    // Screen body. Never pure black: a powered CRT always has some glow in it.
    g.fillStyle = "#06100d";
    g.fillRect(0, 0, W, H);

    // Switching on. A tube does not fade up — a bright line strikes across the
    // middle and opens out, and that is the whole reason this is a television.
    if (power < 0.999) {
      if (power > 0.001) {
        const openness = Math.pow(power, 2.2);
        const h = Math.max(2, H * openness);
        g.save();
        g.globalAlpha = Math.min(1, power * 2.4);
        const flare = g.createLinearGradient(0, H / 2 - h / 2, 0, H / 2 + h / 2);
        flare.addColorStop(0, `rgba(${GLOW},0)`);
        flare.addColorStop(0.5, `rgba(235,255,248,${0.85 - 0.5 * openness})`);
        flare.addColorStop(1, `rgba(${GLOW},0)`);
        g.fillStyle = flare;
        g.fillRect(0, H / 2 - h / 2, W, h);
        g.restore();
      }
      if (power < 0.55) {
        this.texture.needsUpdate = true;
        return;
      }
    }

    const vig = g.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, `rgba(30,90,70,${(0.5 + 0.25 * s.talking) * power})`);
    vig.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    const bright =
      (0.85 + 0.15 * s.talking) * power * Math.max(0, 1 - 1.35 * (s.panelIn ?? 0));
    if (bright > 0.01) this.eyes(s, bright);

    // A card, drawn over the eyes as they fade down.
    if (s.panel && (s.panelIn ?? 0) > 0.01) this.card(s.panel, s.panelIn ?? 1, s.time);

    // Scanlines.
    g.globalAlpha = 0.16;
    g.fillStyle = "#000";
    const off = (s.time * 26) % 4;
    for (let y = -4 + off; y < H; y += 4) g.fillRect(0, y, W, 2);
    g.globalAlpha = 1;

    // An occasional torn band, as a CRT does when it is thinking about it.
    if (s.time > this.glitchUntil) {
      this.glitchUntil = s.time + 1.6 + Math.random() * 4.5;
      this.glitchSeed = Math.random();
    }
    const since = this.glitchUntil - s.time;
    if (since > 1.45 || s.talking > 0.6) {
      const bandY = this.glitchSeed * H;
      const bandH = 6 + this.glitchSeed * 22;
      const shift = (this.glitchSeed - 0.5) * 42 * (0.4 + s.talking);
      const k = this.k;
      const slice = g.getImageData(0, Math.round(bandY * k), Math.round(W * k), Math.round(bandH * k));
      g.putImageData(slice, Math.round(shift * k), Math.round(bandY * k));
    }

    // Glass: a soft diagonal sheen so it reads as a surface, not a sticker.
    const sheen = g.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, "rgba(255,255,255,0.05)");
    sheen.addColorStop(0.45, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(0, 0, W, H);

    this.texture.needsUpdate = true;
  }

  /**
   * The robot's own face: black pixels on its pale screen, one expression per
   * mood, drawn on a 32 by 24 grid so every feature is a clean block. These
   * follow the character sheet: "| |" with a little smile at rest, "┐ ┐"
   * while thinking, "T T" with a crease when cross, dots when bored, "^ ^"
   * with an open mouth when pleased. Blinks every few seconds, and the mouth
   * moves while it talks.
   */
  drawPixelFace(mood: Mood, time: number, talking: number, lookX = 0, lookY = 0) {
    const g = this.ctx;
    const u = W / 32;
    // The glass: pale, a touch warmer at the top, as on the model.
    const glass = g.createLinearGradient(0, 0, W * 0.6, H);
    glass.addColorStop(0, "#f2f3ee");
    glass.addColorStop(1, "#dfe2dc");
    g.fillStyle = glass;
    g.fillRect(0, 0, W, H);
    const INK = "#151515";
    g.fillStyle = INK;
    const px = (x: number, y: number, w = 1, h = 1) => g.fillRect(Math.round(x * u), Math.round(y * u), Math.ceil(w * u), Math.ceil(h * u));
    const tint = (colour: string, draw: () => void) => {
      g.fillStyle = colour;
      draw();
      g.fillStyle = INK;
    };

    // Where it is looking: the eyes slide toward the pointer (or the chat),
    // in half-cell steps so they stay crisp pixels; the mouth follows by half.
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const ex = Math.round(clamp(lookX) * 1.6 * 2) / 2;
    const ey = Math.round(clamp(lookY) * 1.2 * 2) / 2;
    const eye = (x: number, y: number, w = 1, h = 1) => px(x + ex, y + ey, w, h);
    const mouth = (x: number, y: number, w = 1, h = 1) => px(x + ex / 2, y + ey / 2, w, h);

    // A blink of about 130 ms every three to six seconds, on a fixed rhythm
    // so it never looks like a twitch.
    const cycle = 3.2 + 2.4 * ((Math.sin(Math.floor(time / 4.4) * 12.9898) + 1) / 2);
    const blinking = time % cycle < 0.13 && !["sleepy", "dizzy", "laugh", "cool", "love"].includes(mood);
    // Open while the voice is loud enough to be a syllable, shut in pauses.
    const open = talking > 0.3;

    const bars = (y = 6, h = 5) => {
      eye(9, y, 2, h);
      eye(21, y, 2, h);
    };
    const shut = () => {
      eye(8.5, 9, 3, 1);
      eye(20.5, 9, 3, 1);
    };
    const chevron = (x: number) => {
      eye(x, 10);
      eye(x + 1, 9);
      eye(x + 2, 8);
      eye(x + 3, 9);
      eye(x + 4, 10);
    };
    const ring = (x: number, y: number, w: number, h: number) => {
      mouth(x + 1, y, w - 2, 1);
      mouth(x + 1, y + h - 1, w - 2, 1);
      mouth(x, y + 1, 1, h - 2);
      mouth(x + w - 1, y + 1, 1, h - 2);
    };
    const smile = () => {
      mouth(13, 15);
      mouth(18, 15);
      mouth(14, 16, 4, 1);
    };
    const flat = (w = 4, y = 16) => mouth(16 - w / 2, y, w, 1);
    const talkMouth = () => ring(14, 14.5, 4, 3);
    // A big open laugh or grin: a filled half-moon.
    const grin = (depth = 3) => {
      mouth(12.5, 14, 7, 1);
      mouth(13, 15, 6, 1);
      if (depth > 2) mouth(14, 16, 4, 1);
    };
    const heart = (x: number, y: number, k: number) => {
      const c = (cx: number, cy: number, w = 1) => px(x + (cx - 2.5) * k + 2.5, y + (cy - 2) * k + 2, w * k, k);
      c(0.5, 0, 1.5);
      c(3, 0, 1.5);
      c(0, 1, 5);
      c(0.5, 2, 4);
      c(1.5, 3, 2);
    };
    const star = (cx: number, cy: number, full: boolean) => {
      px(cx - 2, cy, 5, 1);
      px(cx, cy - 2, 1, 5);
      if (full) {
        px(cx - 1, cy - 1);
        px(cx + 1, cy - 1);
        px(cx - 1, cy + 1);
        px(cx + 1, cy + 1);
      }
    };

    switch (mood) {
      case "happy":
      case "surprised":
        if (mood === "happy" && !blinking) {
          chevron(7);
          chevron(20);
        } else if (blinking) shut();
        else bars(5.5, 5.5);
        ring(14, 13.5, 4, open ? 3 : 4);
        break;
      case "wink":
        chevron(7);
        if (blinking) eye(20.5, 9, 3, 1);
        else eye(21, 6, 2, 5);
        if (open) talkMouth();
        else smile();
        break;
      case "thinking":
        // ┐ ┐ : a flat brow that hooks down at the outer end.
        if (blinking) shut();
        else {
          px(7, 8, 5, 1.5);
          px(10.5, 9.5, 1.5, 2);
          px(20, 8, 5, 1.5);
          px(23.5, 9.5, 1.5, 2);
        }
        if (open) talkMouth();
        else px(14, 15.5, 4, 1.5);
        // Three dots ticking along the top: working on it.
        for (let i = 0; i < 3; i++) if (Math.floor(time * 3) % 4 > i) px(25 + i * 1.6, 3, 1, 1);
        break;
      case "angry":
        // T T, with a crease between them.
        px(6.5, 8, 5, 1.5);
        px(8.5, 9.5, 1.5, 2);
        px(20.5, 8, 5, 1.5);
        px(22, 9.5, 1.5, 2);
        px(14, 6.5, 1, 1);
        px(16.5, 5.5, 1, 2);
        if (open) talkMouth();
        else flat(4, 15.5);
        // A little steam, puffing.
        tint("rgba(120,120,120,0.55)", () => {
          const puff = (time * 2) % 1;
          px(27, 5 - puff * 3, 1.4, 1.4);
          px(28.5, 6 - puff * 2.5, 1, 1);
        });
        break;
      case "sleepy":
      case "blank": {
        // Dots, and a level line: nobody in particular is home.
        const drift = Math.sin(time * 0.5) * 0.5;
        px(10.5 + drift, 9, 1.6, 1.6);
        px(20 + drift, 9, 1.6, 1.6);
        flat(5, 14.5);
        if (mood === "sleepy") {
          // Z's drifting up from the corner.
          for (const phase of [0, 0.5]) {
            const t = (time * 0.35 + phase) % 1;
            const k = 0.7 + t * 0.5;
            g.globalAlpha = Math.sin(t * Math.PI);
            const zx = 25 + t * 2;
            const zy = 8 - t * 6;
            px(zx, zy, 3 * k, k);
            px(zx + 1 * k, zy + k, k, k);
            px(zx, zy + 2 * k, 3 * k, k);
            g.globalAlpha = 1;
          }
        }
        break;
      }
      case "shy": {
        // Eyes squeezed into little smiles, glancing down, and pink cheeks.
        for (const x of [8, 20]) {
          px(x, 10);
          px(x + 1, 11, 2, 1);
          px(x + 3, 10);
        }
        g.fillStyle = "rgba(240,120,150,0.55)";
        const flush = 0.75 + 0.25 * Math.sin(time * 3);
        g.globalAlpha = flush;
        px(6.5, 12.5, 3.5, 1.4);
        px(22, 12.5, 3.5, 1.4);
        g.globalAlpha = 1;
        g.fillStyle = INK;
        // A small, wobbly smile.
        px(14, 15.5);
        px(15, 16);
        px(16, 15.5);
        px(17, 16);
        break;
      }
      case "love": {
        // Two hearts, beating.
        const k = 1 + 0.18 * Math.max(0, Math.sin(time * 7));
        tint("#e0456b", () => {
          heart(7.5, 6.5, k);
          heart(19.5, 6.5, k);
        });
        if (open) talkMouth();
        else smile();
        break;
      }
      case "laugh": {
        // > <, shaking with it, and a big open mouth.
        const shake = Math.sin(time * 22) * 0.35;
        for (const [x, dir] of [[8, 1], [23, -1]] as const) {
          px(x, 7 + shake);
          px(x + dir, 8 + shake);
          px(x + dir * 2, 9 + shake);
          px(x + dir, 10 + shake);
          px(x, 11 + shake);
        }
        grin(open ? 2 : 3);
        tint("#e86a7f", () => px(15, 16.4 + shake * 0.5, 2, 0.7));
        break;
      }
      case "excited": {
        // Stars for eyes, twinkling between a plus and a full star.
        const full = Math.floor(time * 5) % 2 === 0;
        tint("#e0a21b", () => {
          star(10 + ex, 8.5 + ey, full);
          star(22 + ex, 8.5 + ey, !full);
        });
        ring(14, 13.5, 4, open ? 3 : 4);
        break;
      }
      case "cool": {
        // Sunglasses with a glint sliding across, and a smirk.
        px(7, 7.5, 18, 1);
        px(7, 8, 6, 3.5);
        px(19, 8, 6, 3.5);
        px(8, 11.5, 4, 0.6);
        px(20, 11.5, 4, 0.6);
        const glint = (time * 0.8) % 3;
        if (glint < 1) tint("rgba(255,255,255,0.85)", () => {
          px(8 + glint * 3.5, 8.6, 0.8, 0.8);
          px(20 + glint * 3.5, 8.6, 0.8, 0.8);
        });
        if (open) talkMouth();
        else {
          mouth(14, 16, 4, 1);
          mouth(18, 15);
        }
        break;
      }
      case "confused": {
        // One normal eye, one squinting, a brow cocked, and a "?".
        if (blinking) shut();
        else {
          eye(9, 6, 2, 5);
          eye(20.5, 8.5, 2.5, 2);
        }
        px(19.5, 4.5, 1, 1);
        px(20.5, 4, 2, 1);
        px(22.5, 4.5, 1, 1);
        if (open) talkMouth();
        else for (let i = 0; i < 6; i++) mouth(13 + i, 15 + (i % 2));
        const bob = Math.sin(time * 3) * 0.4;
        tint("#3d7bd9", () => {
          px(26, 2 + bob, 2, 1);
          px(25.5, 3 + bob, 1, 1);
          px(27.5, 3 + bob, 1, 1);
          px(27, 4 + bob, 1, 1);
          px(26.5, 5 + bob, 1, 1);
          px(26.5, 7 + bob, 1, 1);
        });
        break;
      }
      case "sad": {
        // Brows raised at the middle, low eyes, a frown and a falling tear.
        px(7.5, 5.5, 1.5, 1);
        px(9, 5, 2, 1);
        px(23, 5.5, 1.5, 1);
        px(21, 5, 2, 1);
        if (blinking) shut();
        else bars(7, 4);
        if (open) talkMouth();
        else {
          mouth(14, 15, 4, 1);
          mouth(13, 16);
          mouth(18, 16);
        }
        const fall = (time * 0.7) % 1;
        tint(`rgba(74,163,223,${1 - fall})`, () => px(22.5, 11.5 + fall * 7, 1, 1.4));
        break;
      }
      case "dizzy":
        // Crossed eyes and a wobble.
        for (const x of [8, 20]) {
          px(x, 7);
          px(x + 3, 7);
          px(x + 1, 8, 2, 2);
          px(x, 10);
          px(x + 3, 10);
        }
        px(13, 15);
        px(14, 16);
        px(15, 15);
        px(16, 16);
        px(17, 15);
        px(18, 16);
        // Little stars circling the head.
        tint("#e0a21b", () => {
          for (let i = 0; i < 3; i++) {
            const a = time * 3 + (i * Math.PI * 2) / 3;
            px(15.5 + Math.cos(a) * 11, 3 + Math.sin(a) * 1.4, 1, 1);
          }
        });
        break;
      case "listening":
        // Wide open and watching the box, a small "o" of interest.
        if (blinking) shut();
        else bars(5.5, 5.5);
        mouth(15, 15, 2, 2);
        break;
      default:
        // At rest: | |, and a small smile.
        if (blinking) shut();
        else bars();
        if (open) talkMouth();
        else smile();
    }

    // A faint sheen across the glass.
    const sheen = g.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, "rgba(255,255,255,0.18)");
    sheen.addColorStop(0.4, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(0, 0, W, H);
    this.texture.needsUpdate = true;
  }

  /** A game on the screen instead of the face, with the same glass over it. */
  drawGame(game: { render(g: CanvasRenderingContext2D, w: number, h: number, time: number): void }, time: number) {
    const g = this.ctx;
    g.fillStyle = "#06100d";
    g.fillRect(0, 0, W, H);
    g.save();
    game.render(g, W, H, time);
    g.restore();
    g.globalAlpha = 0.12;
    g.fillStyle = "#000";
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
    g.globalAlpha = 1;
    const sheen = g.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, "rgba(255,255,255,0.05)");
    sheen.addColorStop(0.45, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(0, 0, W, H);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}
