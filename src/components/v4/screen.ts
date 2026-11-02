import * as THREE from "three";

import type { Mood, Panel } from "@/components/v3/face";
import { FaceAnimator } from "./expressions";

/** Crisp phosphor expressions for the homepage CRT, with cards and games preserved. */

export type ScreenState = {
  mood: Mood;
  reduced?: boolean;
  lookX: number;
  lookY: number;
  blink: number;
  talking: number;
  time: number;
  power: number;
  panel: Panel | null;
  panelIn: number;
  /** For the face's own reactions: raw pointer, hover, pokes, attention. */
  px?: number;
  py?: number;
  hover?: boolean;
  squint?: number;
  attention?: number;
};

type Game = { render(g: CanvasRenderingContext2D, w: number, h: number, time: number): void };

export class GhanshyamScreen {
  readonly texture: THREE.CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private readonly S: number;
  private readonly face = new FaceAnimator();
  private readonly grain: HTMLCanvasElement;
  private readonly pics = new Map<string, HTMLImageElement>();

  constructor(size = 1536) {
    this.S = size;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    this.g = c.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 8;
    // The screen's UVs run right to left.
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.repeat.x = -1;
    this.texture.offset.x = 1;

    // Film grain, drawn once and slid about each frame.
    this.grain = document.createElement("canvas");
    this.grain.width = this.grain.height = 256;
    const ng = this.grain.getContext("2d")!;
    const img = ng.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ng.putImageData(img, 0, 0);

  }

  draw(s: ScreenState, game: Game | null) {
    const g = this.g;
    const S = this.S;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.filter = "none";

    // The glass: near black, a breath of warmth in the middle.
    const bg = g.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.75);
    bg.addColorStop(0, "#161716");
    bg.addColorStop(1, "#0b0c0c");
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);

    const power = s.power;
    if (game) {
      // Games draw themselves at 512 units; scale that to the whole glass.
      g.save();
      g.scale(S / 512, S / 512);
      game.render(g, 512, 512, s.time);
      g.restore();
    } else if (s.panel && s.panelIn > 0.01) {
      this.card(s.panel, s.panelIn, s.time);
    }

    const eyesOn = !game && (!s.panel || s.panelIn < 0.6);
    if (eyesOn && power > 0.01) {
      const fade = (1 - Math.min(1, (s.panel ? s.panelIn : 0) * 1.7)) * power;
      const layer = this.layer();
      const lg = layer.getContext("2d")!;
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.clearRect(0, 0, S, S);
      lg.globalAlpha = 1;
      lg.globalCompositeOperation = "source-over";
      this.face.draw(lg, S, s);

      // Bloom, as the tube glows: a tight halo and a wide soft one.
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.4 * fade;
      g.filter = `blur(${Math.max(2, Math.round(S * 0.014))}px)`;
      g.drawImage(layer, 0, 0);
      g.globalAlpha = 0.28 * fade;
      g.filter = `blur(${Math.max(4, Math.round(S * 0.05))}px)`;
      g.drawImage(layer, 0, 0);
      g.filter = "none";
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = fade;
      g.drawImage(layer, 0, 0);
      g.restore();
    }

    // The tube: fine scanlines across, a shadow mask down, a slow rolling
    // band and a few sparks, as the reference site draws them, scaled up.
    const k = S / 512;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgba(0,0,0,0.07)";
    for (let y = 0; y < S; y += 3 * k) g.fillRect(0, y, S, k);
    g.fillStyle = "rgba(24,34,40,0.06)";
    for (let x = 0; x < S; x += 4 * k) g.fillRect(x, 0, k, S);
    const roll = ((s.time * 18 * k) % S);
    g.fillStyle = "rgba(120,154,180,0.025)";
    g.fillRect(0, roll, S, 7 * k);
    g.fillStyle = "rgba(200,230,240,0.08)";
    for (let n = 0; n < 85; n++) g.fillRect(Math.random() * S, Math.random() * S, k, k);
    g.globalCompositeOperation = "screen";
    g.globalAlpha = 0.012;
    const ox = Math.floor(Math.random() * 256);
    const oy = Math.floor(Math.random() * 256);
    for (let y = -oy; y < S; y += 256) for (let x = -ox; x < S; x += 256) g.drawImage(this.grain, x, y);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    const vig = g.createRadialGradient(S / 2, S / 2, S * 0.42, S / 2, S / 2, S * 0.8);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.38)");
    g.fillStyle = vig;
    g.fillRect(0, 0, S, S);
    g.restore();
    this.texture.needsUpdate = true;
  }

  private picture(src: string) {
    let im = this.pics.get(src);
    if (!im) {
      im = new window.Image();
      im.decoding = "async";
      im.src = src;
      this.pics.set(src, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  private fit(text: string, max: number) {
    const g = this.g;
    if (g.measureText(text).width <= max) return text;
    let cut = text;
    while (cut.length > 1 && g.measureText(cut + "…").width > max) cut = cut.slice(0, -1);
    return cut + "…";
  }

  /**
   * A card, drawn for this screen: edge to edge, in colour, at full size.
   * Pictures fill the glass (cropped to fit, never letterboxed); text cards
   * are set large on the dark tube.
   */
  private card(p: Panel, amount: number, time: number) {
    const g = this.g;
    const S = this.S;
    const pad = S * 0.1;
    const right = S - pad * 2;
    const sans = "ui-sans-serif, -apple-system, 'Helvetica Neue', Inter, system-ui, sans-serif";
    const mono = "ui-monospace, 'SF Mono', Menlo, monospace";
    g.save();
    // Arrives like a channel changing: a wipe down the glass.
    g.beginPath();
    g.rect(0, 0, S, S * Math.min(1, amount * 1.25));
    g.clip();
    g.globalAlpha = Math.min(1, amount * 1.3);

    const pic = p.image ? this.picture(p.image) : null;
    if (pic && p.whole) {
      // The whole page, inside the part of the glass that shows (the tube
      // curves off the edges of the canvas), with its name beneath it.
      const bg = g.createRadialGradient(S * 0.4, S * 0.35, 0, S / 2, S / 2, S * 0.8);
      bg.addColorStop(0, "#1c1e22");
      bg.addColorStop(1, "#0b0c0e");
      g.fillStyle = bg;
      g.fillRect(0, 0, S, S);
      const safe = S * 0.1;
      const band = S * 0.17;
      const boxW = S - safe * 2;
      const boxH = S - safe * 2 - band;
      const k = Math.min(boxW / pic.naturalWidth, boxH / pic.naturalHeight);
      const w = pic.naturalWidth * k;
      const h = pic.naturalHeight * k;
      const x = (S - w) / 2;
      const y = safe;
      g.save();
      g.beginPath();
      g.roundRect(x, y, w, h, S * 0.02);
      g.clip();
      g.drawImage(pic, x, y, w, h);
      g.restore();
      g.textBaseline = "alphabetic";
      g.fillStyle = "rgba(255,255,255,0.97)";
      g.font = `600 ${Math.round(S * 0.062)}px ${sans}`;
      g.fillText(this.fit(p.title, boxW), x, y + h + S * 0.085);
      g.fillStyle = "rgba(170,200,255,0.75)";
      g.font = `500 ${Math.round(S * 0.03)}px ${mono}`;
      g.fillText(this.fit(p.kicker.toUpperCase(), boxW), x, y + h + S * 0.13);
      if (p.tap) this.pill(p.tap, time, pad * 0.8);
    } else if (pic) {
      const k = Math.max(S / pic.naturalWidth, S / pic.naturalHeight);
      const w = pic.naturalWidth * k;
      const h = pic.naturalHeight * k;
      g.drawImage(pic, (S - w) / 2, (S - h) / 2, w, h);
      const shade = g.createLinearGradient(0, S * 0.5, 0, S);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.82)");
      g.fillStyle = shade;
      g.fillRect(0, S * 0.5, S, S * 0.5);
      g.textBaseline = "alphabetic";
      g.shadowColor = "rgba(0,0,0,0.5)";
      g.shadowBlur = S * 0.01;
      g.fillStyle = "rgba(255,255,255,0.97)";
      g.font = `600 ${Math.round(S * 0.078)}px ${sans}`;
      g.fillText(this.fit(p.title, right), pad, S - pad - S * 0.07);
      g.fillStyle = "rgba(255,255,255,0.74)";
      g.font = `500 ${Math.round(S * 0.032)}px ${mono}`;
      g.fillText(this.fit(p.kicker.toUpperCase(), right), pad, S - pad);
      g.shadowBlur = 0;
      if (p.tap) this.pill(p.tap, time, pad * 0.8);
    } else {
      const bg = g.createRadialGradient(S * 0.4, S * 0.35, 0, S / 2, S / 2, S * 0.8);
      bg.addColorStop(0, "#1c1e22");
      bg.addColorStop(1, "#0b0c0e");
      g.fillStyle = bg;
      g.fillRect(0, 0, S, S);
      g.textBaseline = "top";
      g.fillStyle = "rgba(170,200,255,0.75)";
      g.font = `500 ${Math.round(S * 0.034)}px ${mono}`;
      g.fillText(this.fit(p.kicker.toUpperCase(), right), pad, pad);
      g.fillStyle = "rgba(255,255,255,0.97)";
      const big = p.title.length > 20 ? 0.072 : 0.092;
      g.font = `600 ${Math.round(S * big)}px ${sans}`;
      g.fillText(this.fit(p.title, right), pad, pad + S * 0.07);
      let y = pad + S * 0.07 + S * big * 1.5;
      if (p.metric) {
        g.font = `700 ${Math.round(S * 0.2)}px ${sans}`;
        g.fillText(this.fit(p.metric, right), pad, y);
        y += S * 0.22;
        if (p.metricLabel) {
          g.fillStyle = "rgba(255,255,255,0.62)";
          g.font = `500 ${Math.round(S * 0.034)}px ${mono}`;
          g.fillText(this.fit(p.metricLabel.toUpperCase(), right), pad, y);
          y += S * 0.07;
        }
      } else if (p.lines?.length) {
        g.font = `400 ${Math.round(S * 0.046)}px ${sans}`;
        for (const line of p.lines.slice(0, 4)) {
          g.fillStyle = "rgba(255,255,255,0.86)";
          g.fillText(this.fit(line, right), pad, y);
          y += S * 0.068;
        }
      }
      if (p.chips?.length) {
        let x = pad;
        const cy = S * 0.74;
        const limit = p.tap ? S * 0.5 : S - pad;
        g.font = `500 ${Math.round(S * 0.03)}px ${mono}`;
        g.textBaseline = "middle";
        for (const c of p.chips) {
          const w = g.measureText(c).width + S * 0.04;
          if (x + w > limit) break;
          g.fillStyle = "rgba(255,255,255,0.1)";
          g.beginPath();
          g.roundRect(x, cy, w, S * 0.06, S * 0.03);
          g.fill();
          g.fillStyle = "rgba(255,255,255,0.88)";
          g.fillText(c, x + S * 0.02, cy + S * 0.03);
          x += w + S * 0.016;
        }
      }
      if (p.tap) this.pill(p.tap, time, S - pad * 0.6 - S * 0.09);
    }
    g.restore();
  }

  private pill(label: string, time: number, y: number) {
    const g = this.g;
    const S = this.S;
    g.save();
    g.font = `600 ${Math.round(S * 0.034)}px ui-sans-serif, -apple-system, system-ui, sans-serif`;
    g.textBaseline = "middle";
    const text = `${label}  →`;
    const w = g.measureText(text).width + S * 0.07;
    const h = S * 0.085;
    const x = S - S * 0.08 - w;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    g.shadowColor = `rgba(255,255,255,${0.25 + 0.25 * pulse})`;
    g.shadowBlur = S * (0.01 + 0.012 * pulse);
    g.fillStyle = "rgba(255,255,255,0.94)";
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = "#0d0e10";
    g.fillText(text, x + S * 0.035, y + h / 2 + 1);
    g.restore();
  }

  private _layer: HTMLCanvasElement | null = null;
  private layer() {
    if (!this._layer) {
      this._layer = document.createElement("canvas");
      this._layer.width = this._layer.height = this.S;
    }
    return this._layer;
  }

  dispose() {
    this.texture.dispose();
  }
}
