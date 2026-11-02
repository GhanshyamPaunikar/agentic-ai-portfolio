/**
 * Games on Elio's screen: Snake, Dino and Tetris.
 *
 * Each game keeps its own state, moves on `update(dt)`, answers keys through
 * `key(code)`, and paints itself onto the face canvas in `render`, in the
 * screen's own phosphor green so it reads as the television playing, not a
 * web page pasted on. The page owns the keyboard while one is running and
 * hands the keys over; the robot's frame loop calls update and render.
 */

import { sfx } from "@/components/v3/sfx";

export type GameName = "snake" | "dino" | "tetris";

export interface Game {
  readonly name: GameName;
  readonly title: string;
  /** One line of controls, shown under the screen. */
  readonly help: string;
  score: number;
  over: boolean;
  update(dt: number): void;
  /** Returns true when the key was used, so the page can swallow it. */
  key(code: string): boolean;
  render(g: CanvasRenderingContext2D, w: number, h: number, time: number): void;
}

const INK = "rgb(150,255,215)";
const DIM = "rgba(150,255,215,0.35)";
const FAINT = "rgba(150,255,215,0.12)";
const HOT = "rgb(255,196,92)";

const BEST = "pix-arcade-best";
function best(name: GameName, score?: number): number {
  try {
    const all = JSON.parse(localStorage.getItem(BEST) ?? "{}") as Record<string, number>;
    if (score !== undefined && score > (all[name] ?? 0)) {
      all[name] = score;
      localStorage.setItem(BEST, JSON.stringify(all));
    }
    return all[name] ?? 0;
  } catch {
    return score ?? 0;
  }
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, align: CanvasTextAlign = "left", color = INK) {
  g.font = `600 ${size}px ui-monospace, "SF Mono", Menlo, monospace`;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.shadowColor = "rgba(120,230,190,0.6)";
  g.shadowBlur = 8;
  g.fillText(s, x, y);
  g.shadowBlur = 0;
}

function gameOver(g: CanvasRenderingContext2D, w: number, h: number, score: number, top: number) {
  g.fillStyle = "rgba(4,12,9,0.78)";
  g.fillRect(0, 0, w, h);
  text(g, "GAME OVER", w / 2, h * 0.38, 44, "center");
  text(g, `score ${score}   best ${top}`, w / 2, h * 0.53, 20, "center", DIM);
  text(g, "space to play again · esc to quit", w / 2, h * 0.68, 17, "center", DIM);
}

/* ── Snake ─────────────────────────────────────────────────────────────── */

class Snake implements Game {
  readonly name = "snake";
  readonly title = "Snake";
  readonly help = "Arrow keys or WASD to steer · Space to restart · Esc to quit";
  score = 0;
  over = false;
  private readonly cols = 24;
  private readonly rows = 16;
  private body: { x: number; y: number }[] = [];
  private dir = { x: 1, y: 0 };
  private queue: { x: number; y: number }[] = [];
  private food = { x: 0, y: 0 };
  private acc = 0;
  private top = best("snake");

  constructor() {
    this.reset();
  }

  private reset() {
    this.body = [
      { x: 6, y: 8 },
      { x: 5, y: 8 },
      { x: 4, y: 8 },
    ];
    this.dir = { x: 1, y: 0 };
    this.queue = [];
    this.score = 0;
    this.over = false;
    this.place();
  }

  private place() {
    do {
      this.food = { x: Math.floor(Math.random() * this.cols), y: Math.floor(Math.random() * this.rows) };
    } while (this.body.some((b) => b.x === this.food.x && b.y === this.food.y));
  }

  key(code: string) {
    if (this.over) {
      if (code === "Space" || code === "Enter") {
        this.reset();
        return true;
      }
      return false;
    }
    const want =
      code === "ArrowUp" || code === "KeyW"
        ? { x: 0, y: -1 }
        : code === "ArrowDown" || code === "KeyS"
          ? { x: 0, y: 1 }
          : code === "ArrowLeft" || code === "KeyA"
            ? { x: -1, y: 0 }
            : code === "ArrowRight" || code === "KeyD"
              ? { x: 1, y: 0 }
              : null;
    if (!want) return false;
    // Turns queue up so two quick presses between ticks both count, and a
    // turn straight back into the body is ignored.
    const last = this.queue[this.queue.length - 1] ?? this.dir;
    if (want.x !== -last.x || want.y !== -last.y) {
      if (this.queue.length < 3) this.queue.push(want);
    }
    return true;
  }

  update(dt: number) {
    if (this.over) return;
    const step = Math.max(0.055, 0.13 - this.score * 0.002);
    this.acc += dt;
    while (this.acc >= step && !this.over) {
      this.acc -= step;
      this.dir = this.queue.shift() ?? this.dir;
      const head = this.body[0];
      const next = {
        x: (head.x + this.dir.x + this.cols) % this.cols,
        y: (head.y + this.dir.y + this.rows) % this.rows,
      };
      const eats = next.x === this.food.x && next.y === this.food.y;
      const hitsSelf = this.body.slice(0, eats ? undefined : -1).some((b) => b.x === next.x && b.y === next.y);
      if (hitsSelf) {
        this.over = true;
        this.top = best("snake", this.score);
        sfx.over();
        return;
      }
      this.body.unshift(next);
      if (eats) {
        this.score += 1;
        sfx.eat();
        this.place();
      } else this.body.pop();
    }
  }

  render(g: CanvasRenderingContext2D, w: number, h: number, time: number) {
    const top = 44;
    const cell = Math.min(w / this.cols, (h - top - 10) / this.rows);
    const ox = (w - cell * this.cols) / 2;
    const oy = top;
    text(g, "SNAKE", 18, 22, 20);
    text(g, `${this.score}`, w - 18, 22, 20, "right");
    g.strokeStyle = FAINT;
    g.lineWidth = 2;
    g.strokeRect(ox, oy, cell * this.cols, cell * this.rows);
    const pulse = 0.75 + 0.25 * Math.sin(time * 8);
    g.fillStyle = HOT;
    g.globalAlpha = pulse;
    g.fillRect(ox + this.food.x * cell + 3, oy + this.food.y * cell + 3, cell - 6, cell - 6);
    g.globalAlpha = 1;
    this.body.forEach((b, i) => {
      g.fillStyle = i === 0 ? INK : `rgba(150,255,215,${Math.max(0.45, 0.95 - i * 0.03)})`;
      g.fillRect(ox + b.x * cell + 1.5, oy + b.y * cell + 1.5, cell - 3, cell - 3);
    });
    if (this.over) gameOver(g, w, h, this.score, this.top);
  }
}

/* ── Dino ──────────────────────────────────────────────────────────────── */

class Dino implements Game {
  readonly name = "dino";
  readonly title = "Dino";
  readonly help = "Space or ↑ to jump · ↓ to duck · Esc to quit";
  score = 0;
  over = false;
  private y = 0;
  private vy = 0;
  private ducking = false;
  private duckUntil = 0;
  private t = 0;
  private speed = 260;
  private spawn = 1;
  private obstacles: { x: number; w: number; h: number; fly: boolean }[] = [];
  private top = best("dino");
  private started = false;

  key(code: string) {
    const jump = code === "Space" || code === "ArrowUp" || code === "KeyW";
    if (this.over) {
      if (jump || code === "Enter") {
        this.restart();
        return true;
      }
      return false;
    }
    if (jump) {
      this.started = true;
      if (this.y === 0) {
        this.vy = 640;
        sfx.jump();
      }
      return true;
    }
    if (code === "ArrowDown" || code === "KeyS") {
      this.ducking = true;
      this.duckUntil = this.t + 0.35;
      if (this.y > 0) this.vy -= 400;
      return true;
    }
    return false;
  }

  private restart() {
    this.score = 0;
    this.over = false;
    this.y = 0;
    this.vy = 0;
    this.t = 0;
    this.speed = 260;
    this.spawn = 1;
    this.obstacles = [];
    this.started = true;
  }

  update(dt: number) {
    if (this.over || !this.started) return;
    this.t += dt;
    if (this.ducking && this.t > this.duckUntil) this.ducking = false;
    this.speed = 260 + this.t * 9;
    const was = this.score;
    this.score = Math.floor(this.t * 10);
    if (Math.floor(this.score / 100) > Math.floor(was / 100)) sfx.milestone();
    this.vy -= 1900 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) this.vy = Math.max(0, this.vy);
    for (const o of this.obstacles) o.x -= this.speed * dt;
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -10);
    this.spawn -= dt;
    if (this.spawn <= 0) {
      const fly = this.t > 12 && Math.random() < 0.3;
      this.obstacles.push(
        fly ? { x: 540, w: 34, h: 18, fly: true } : { x: 540, w: 14 + Math.random() * 22, h: 30 + Math.random() * 26, fly: false },
      );
      this.spawn = 0.75 + Math.random() * 0.9 - Math.min(0.35, this.t * 0.006);
    }
    // Collision, a little forgiving at the edges.
    const dx = 70;
    const dw = 34;
    const dh = this.ducking && this.y === 0 ? 24 : 44;
    for (const o of this.obstacles) {
      // Birds fly at head height: duck under them, or jump over.
      const oy = o.fly ? 30 : 0;
      const overlapX = o.x + 4 < dx + dw - 4 && o.x + o.w - 4 > dx + 4;
      const overlapY = this.y + 4 < oy + o.h && this.y + dh - 4 > oy;
      if (overlapX && overlapY && !this.over) {
        this.over = true;
        this.top = best("dino", this.score);
        sfx.over();
      }
    }
  }

  render(g: CanvasRenderingContext2D, w: number, h: number, time: number) {
    const ground = h - 70;
    text(g, "DINO", 18, 22, 20);
    text(g, `${String(this.score).padStart(5, "0")}  HI ${String(Math.max(this.top, this.score)).padStart(5, "0")}`, w - 18, 22, 18, "right");
    g.fillStyle = DIM;
    g.fillRect(0, ground + 1, w, 2);
    // Pebbles running past, so the ground reads as moving.
    g.fillStyle = FAINT;
    for (let i = 0; i < 14; i++) {
      const x = (((i * 83 - this.t * this.speed) % w) + w) % w;
      g.fillRect(x, ground + 10 + (i % 3) * 8, 6, 2);
    }
    // The dino, in blocks.
    const dx = 70;
    const ducking = this.ducking && this.y === 0;
    const top = ground - this.y - (ducking ? 24 : 44);
    g.fillStyle = INK;
    if (ducking) {
      g.fillRect(dx, top + 4, 44, 18);
      g.fillRect(dx + 30, top, 18, 12);
    } else {
      g.fillRect(dx + 14, top, 22, 16); // head
      g.fillRect(dx + 4, top + 14, 22, 22); // body
      g.fillRect(dx, top + 18, 6, 10); // tail
      g.fillRect(dx + 26, top + 22, 6, 4); // arm
      const run = this.y === 0 && this.started && !this.over ? Math.floor(time * 12) % 2 : 0;
      g.fillRect(dx + 8, top + 36, 6, run ? 8 : 6);
      g.fillRect(dx + 18, top + 36, 6, run ? 6 : 8);
    }
    g.fillStyle = "#06100d";
    if (!ducking) g.fillRect(dx + 28, top + 4, 4, 4); // eye
    // Cacti and birds.
    for (const o of this.obstacles) {
      g.fillStyle = INK;
      if (o.fly) {
        const flap = Math.floor(time * 8) % 2;
        const y = ground - 30 - o.h;
        g.fillRect(o.x, y + 6, o.w, 6);
        g.fillRect(o.x + 10, y + (flap ? 0 : 12), 14, 6);
      } else {
        g.fillRect(o.x, ground - o.h, o.w, o.h);
        g.fillRect(o.x - 6, ground - o.h * 0.65, 6, 10);
        g.fillRect(o.x + o.w, ground - o.h * 0.8, 6, 10);
      }
    }
    if (!this.started) text(g, "press space to run", w / 2, h * 0.42, 22, "center");
    if (this.over) gameOver(g, w, h, this.score, this.top);
  }
}

/* ── Tetris ────────────────────────────────────────────────────────────── */

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
];

const rotate = (m: number[][]) => m[0].map((_, i) => m.map((row) => row[i]).reverse());

class Tetris implements Game {
  readonly name = "tetris";
  readonly title = "Tetris";
  readonly help = "← → to move · ↑ to rotate · ↓ soft drop · Space hard drop · Esc to quit";
  score = 0;
  over = false;
  private readonly cols = 10;
  private readonly rows = 20;
  private grid: number[][] = [];
  private piece: number[][] = SHAPES[0];
  private kind = 0;
  private next = 0;
  private px = 3;
  private py = 0;
  private acc = 0;
  private lines = 0;
  private top = best("tetris");

  constructor() {
    this.reset();
  }

  private reset() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.score = 0;
    this.lines = 0;
    this.over = false;
    this.next = Math.floor(Math.random() * SHAPES.length);
    this.spawn();
  }

  private spawn() {
    this.kind = this.next;
    this.piece = SHAPES[this.kind];
    this.next = Math.floor(Math.random() * SHAPES.length);
    this.px = Math.floor((this.cols - this.piece[0].length) / 2);
    this.py = 0;
    if (this.hits(this.piece, this.px, this.py)) {
      this.over = true;
      this.top = best("tetris", this.score);
      sfx.over();
    }
  }

  private hits(p: number[][], x: number, y: number) {
    return p.some((row, r) =>
      row.some((v, c) => v && (x + c < 0 || x + c >= this.cols || y + r >= this.rows || (y + r >= 0 && this.grid[y + r][x + c]))),
    );
  }

  private lock() {
    this.piece.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v && this.py + r >= 0) this.grid[this.py + r][this.px + c] = this.kind + 1;
      }),
    );
    const kept = this.grid.filter((row) => row.some((v) => !v));
    const cleared = this.rows - kept.length;
    while (kept.length < this.rows) kept.unshift(Array(this.cols).fill(0));
    this.grid = kept;
    this.lines += cleared;
    this.score += [0, 100, 300, 500, 800][cleared] ?? 0;
    if (cleared) sfx.clear(cleared);
    else sfx.lock();
    this.spawn();
  }

  private drop() {
    if (!this.hits(this.piece, this.px, this.py + 1)) this.py += 1;
    else this.lock();
  }

  key(code: string) {
    if (this.over) {
      if (code === "Space" || code === "Enter") {
        this.reset();
        return true;
      }
      return false;
    }
    if (code === "ArrowLeft" || code === "KeyA") {
      if (!this.hits(this.piece, this.px - 1, this.py)) {
        this.px -= 1;
        sfx.tick();
      }
    } else if (code === "ArrowRight" || code === "KeyD") {
      if (!this.hits(this.piece, this.px + 1, this.py)) {
        this.px += 1;
        sfx.tick();
      }
    } else if (code === "ArrowDown" || code === "KeyS") {
      this.drop();
      this.score += 1;
    } else if (code === "ArrowUp" || code === "KeyW" || code === "KeyX") {
      const turned = rotate(this.piece);
      // A small wall kick, so a piece against the edge can still turn.
      for (const kick of [0, -1, 1, -2, 2]) {
        if (!this.hits(turned, this.px + kick, this.py)) {
          this.piece = turned;
          this.px += kick;
          sfx.tick();
          break;
        }
      }
    } else if (code === "Space") {
      while (!this.hits(this.piece, this.px, this.py + 1)) {
        this.py += 1;
        this.score += 2;
      }
      this.lock();
    } else return false;
    return true;
  }

  update(dt: number) {
    if (this.over) return;
    const level = Math.floor(this.lines / 8);
    const step = Math.max(0.09, 0.62 - level * 0.06);
    this.acc += dt;
    while (this.acc >= step && !this.over) {
      this.acc -= step;
      this.drop();
    }
  }

  render(g: CanvasRenderingContext2D, w: number, h: number) {
    const cell = Math.floor((h - 24) / this.rows);
    const bw = cell * this.cols;
    const ox = Math.floor(w / 2 - bw / 2 - 60);
    const oy = Math.floor((h - cell * this.rows) / 2);
    g.strokeStyle = DIM;
    g.lineWidth = 2;
    g.strokeRect(ox - 2, oy - 2, bw + 4, cell * this.rows + 4);
    const block = (x: number, y: number, alpha = 1, color = INK) => {
      g.globalAlpha = alpha;
      g.fillStyle = color;
      g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      g.globalAlpha = 1;
    };
    this.grid.forEach((row, r) => row.forEach((v, c) => v && block(ox + c * cell, oy + r * cell, 0.75)));
    // Where the piece will land.
    let gy = this.py;
    while (!this.hits(this.piece, this.px, gy + 1)) gy += 1;
    this.piece.forEach((row, r) =>
      row.forEach((v, c) => {
        if (!v) return;
        block(ox + (this.px + c) * cell, oy + (gy + r) * cell, 0.18);
        block(ox + (this.px + c) * cell, oy + (this.py + r) * cell, 1, HOT);
      }),
    );
    const sx = ox + bw + 34;
    text(g, "TETRIS", sx, oy + 16, 22);
    text(g, "score", sx, oy + 60, 15, "left", DIM);
    text(g, `${this.score}`, sx, oy + 84, 24);
    text(g, "lines", sx, oy + 122, 15, "left", DIM);
    text(g, `${this.lines}`, sx, oy + 146, 24);
    text(g, "next", sx, oy + 190, 15, "left", DIM);
    SHAPES[this.next].forEach((row, r) => row.forEach((v, c) => v && block(sx + c * cell, oy + 210 + r * cell, 0.9)));
    if (this.over) gameOver(g, w, h, this.score, this.top);
  }
}

export const GAMES: { name: GameName; title: string; help: string }[] = [
  { name: "snake", title: "Snake", help: "Arrow keys or WASD to steer · Space to restart · Esc to quit" },
  { name: "dino", title: "Dino", help: "Space or ↑ to jump · ↓ to duck · Esc to quit" },
  { name: "tetris", title: "Tetris", help: "← → to move · ↑ to rotate · ↓ soft drop · Space hard drop · Esc to quit" },
];

export function makeGame(name: GameName): Game {
  sfx.start();
  return name === "snake" ? new Snake() : name === "dino" ? new Dino() : new Tetris();
}

/** "play snake", "tetris", "dino game", "let's play a game"… or null. */
export function gameAsked(text: string): GameName | "menu" | null {
  const t = text.toLowerCase();
  if (/\bsnake\b/.test(t)) return "snake";
  if (/\b(dino|dinosaur|t-?rex)\b/.test(t)) return "dino";
  if (/\btetris\b/.test(t)) return "tetris";
  if (/\b(play|let'?s play)\b.*\bgames?\b|\bgames?\b.*\bplay\b|^\s*(games?|arcade)\s*[?!.]*$/.test(t)) return "menu";
  return null;
}
