"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";

import { articles, profile, social } from "@/data/portfolio";
import { ASSISTANT, NODES, ROOT, fill, type Field } from "@/components/v3/conversation";
import { makeSignals, type CharacterSlot, type Signals } from "@/components/v3/character";
import { SHELF_TABS, Shelf, type ShelfName } from "@/components/v3/shelf";
import { setSfxEnabled } from "@/components/v3/sfx";
import {
  BY_ID,
  BY_TITLE,
  ITEMS,
  STATS_PANEL,
  greetingPanel,
} from "@/components/v3/dossier";
import { type Answer } from "@/components/v3/answer";
import { askPix, type Turn } from "@/components/v3/pix-chat";
import { arrive, noteFor, remember, reportName, reportVisit, seenBefore, visitorId, type Memory } from "@/components/v3/memory";
import { useDictation } from "@/components/v3/dictation";
import { GAMES, gameAsked, makeGame, type GameName } from "@/components/v3/arcade";
import type { Panel } from "@/components/v3/face";
import {
  BlogIcon,
  CoffeeIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  MediumIcon,
  SpotifyIcon,
} from "@/components/site/social-icons";
import {
  CHARS_PER_SECOND,
  DEFAULT_VOICE,
  loadVoiceSettings,
  saveVoiceSettings,
  useSpeech,
  type LineHooks,
  type Spoken,
  type VoiceSettings,
} from "@/components/v3/speech";
import { VoicePicker } from "@/components/v3/voice-picker";
import { primeAudio, useAmbience } from "@/components/v3/ambience";
import { Loader } from "@/components/v3/loader";
import { SkyBackdrop } from "@/components/v3/backdrop";

const Scene = dynamic(() => import("@/components/v3/character").then((m) => m.Scene), {
  ssr: false,
});
/**
 * What stands behind Elio. "painting" is the reference image itself, sliding a
 * little with the pointer; "3d" is the Blender rebuild of it, with true
 * parallax and animated clouds and trees, kept behind this one word.
 */
const BACKDROP = "painting" as "painting" | "3d";
const ParallaxBackground = dynamic(
  () => import("@/components/v3/parallax").then((m) => m.ParallaxBackground),
  { ssr: false },
);

const TYPE_MS = 16;

/**
 * The name out of whatever was typed for it: "Priya", "my name is priya",
 * "I'm Priya.", "call me Priya" all give "Priya".
 */
function nameFrom(typed: string): string {
  const t = typed
    .trim()
    .replace(/^(hi|hello|hey|hiya|yo)\b[,!.\s]*/i, "")
    .replace(/^(my name is|my name's|i am|i'm|im|it's|its|this is|call me|name is|name's)\s+/i, "")
    // "Sam, how are you?" is Sam; whatever follows the name is chat.
    .split(/[,!?.;]|\s+(?:how|what|and|here)\b/i)[0]
    .trim();
  // "how are you", "what's up", "nothing": a greeting or a question, not a
  // name. Elio carries on without one rather than calling them "How Are".
  if (!t || /^(how|what|whats|who|where|why|when|are|do|does|is|can|could|tell|show|ok|okay|nothing|no|none|nope|fine|good|great|cool|sup|thanks|thank|not|idk|anonymous|skip)\b/i.test(t)) {
    return "";
  }
  return t
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

const RESUME_PDF = "/Ghanshyam-Paunikar-Resume.pdf";

/* ── Typing ───────────────────────────────────────────────────────────── */

/**
 * Types an array of lines one after another, in step with the voice.
 *
 * Returns the lines as they stand this instant, so the caller renders the
 * same markup whether it is mid-type or finished — no separate "typing" view
 * to keep in step with the final one.
 *
 * When a line is spoken, the text shows only what has been said: up to the
 * word the synthesiser last reported, or, for voices that report no words,
 * as far as the voice should have got by now at its speed. Without a voice it
 * types at its own pace. Either way the two never drift apart, and there is
 * no long silence at a full stop waiting for speech that fell behind.
 */
function useTypewriter(
  lines: string[],
  instant: boolean,
  onChar?: () => void,
  /** Speaks a line as it starts; null when there is no voice to follow. */
  onLine?: (text: string, hooks: LineHooks, index: number) => Spoken | null,
  /** How fast the voice talks, for voices that do not report their words. */
  charsPerSecond = CHARS_PER_SECOND,
  /**
   * Names the turn. While it stays the same, new lines are added to the end
   * of what is being typed (a streamed answer) instead of starting over.
   */
  turn?: string,
  /** More lines are on their way: wait for them rather than finish. */
  more = false,
) {
  const key = turn ?? lines.join("\u0000");
  const [shown, setShown] = useState<string[]>(instant ? lines : []);
  const [done, setDone] = useState(instant);
  // Which turn the reader has asked to see in full. Holding the key rather
  // than a flag means it resets by itself when the next turn arrives.
  const [skipKey, setSkipKey] = useState<string | null>(null);
  const skipped = skipKey === key;
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const moreRef = useRef(more);
  moreRef.current = more;
  const charRef = useRef(onChar);
  charRef.current = onChar;
  const lineRef = useRef(onLine);
  lineRef.current = onLine;
  const paceRef = useRef(charsPerSecond);
  useEffect(() => {
    paceRef.current = charsPerSecond;
  }, [charsPerSecond]);

  useEffect(() => {
    if (instant || skipped) {
      // Everything at once, including lines that are still arriving.
      let wait: ReturnType<typeof setTimeout>;
      const all = () => {
        setShown(linesRef.current);
        if (moreRef.current) wait = setTimeout(all, 100);
        else setDone(true);
      };
      all();
      return () => clearTimeout(wait);
    }
    setShown([]);
    setDone(false);
    let line = 0;
    let char = 0;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    // The voice for the line being typed.
    let voice: Spoken | null = null;
    let begun = false;
    let lineAt = 0;
    let started = 0;
    let heard = -1;
    let ended = false;
    // The voice's length for this line, in seconds, once it is known.
    let length = 0;

    const begin = () => {
      const lines = linesRef.current;
      begun = true;
      lineAt = performance.now();
      started = 0;
      heard = -1;
      ended = false;
      length = 0;
      voice =
        lineRef.current?.(
          lines[line],
          {
            onStart: () => {
              started = performance.now();
            },
            onWord: (i, len) => {
              heard = Math.max(heard, i + len);
            },
            onLength: (seconds) => {
              length = seconds;
            },
          },
          line,
        ) ?? null;
      void voice?.done.then(() => {
        ended = true;
      });
    };

    /** How much of the current line may be on screen right now. */
    const allowed = (now: number) => {
      const len = linesRef.current[line].length;
      // No voice, or it has finished (or failed, as it does before the first
      // click): type freely.
      if (!voice || ended || voice.follow === false) return len;
      // Hold for the first sound, but not for long: a stalled voice must not
      // freeze the text.
      if (!started) return now - lineAt > (voice.wait ?? 900) ? len : 0;
      if (heard >= 0) return heard + 1;
      // Spread the line over the voice's own length, finishing a touch early.
      if (length > 0) return Math.floor(((now - started) / 1000 / (length * 0.92)) * len);
      return Math.floor(((now - started) / 1000) * paceRef.current);
    };

    const step = () => {
      if (cancelled) return;
      const lines = linesRef.current;
      if (line >= lines.length) {
        // A streamed answer: the next sentence has not arrived yet.
        if (moreRef.current) {
          timer = setTimeout(step, 60);
          return;
        }
        setDone(true);
        return;
      }
      if (!begun) begin();
      const cap = Math.min(lines[line].length, allowed(performance.now()));
      if (char < cap) {
        char += 1;
        setShown([...lines.slice(0, line), lines[line].slice(0, char)]);
        charRef.current?.();
      }
      if (char >= lines[line].length) {
        // The text is at the end of the line, so the voice is too, or nearly.
        const tail =
          voice && !ended && voice.follow !== false
            ? Promise.race([voice.done, new Promise<void>((r) => setTimeout(r, 900))])
            : Promise.resolve();
        line += 1;
        char = 0;
        begun = false;
        void tail.then(() => {
          if (!cancelled) timer = setTimeout(step, 50);
        });
        return;
      }
      timer = setTimeout(step, char < cap ? TYPE_MS : 30);
    };
    timer = setTimeout(step, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // lines is rebuilt per node; the key (joined lines, or the turn while an
    // answer streams in) keeps the effect from re-firing on a new reference.
  }, [key, instant, skipped]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = useCallback(() => setSkipKey(key), [key]);
  return { shown, done, skip };
}

/* ── Sound ────────────────────────────────────────────────────────────── */

/** A short blip per character. Off unless asked for. */
function useBlips(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const last = useRef(0);
  return useCallback(() => {
    if (!enabled) return;
    const now = performance.now();
    if (now - last.current < 28) return; // don't stack on fast lines
    last.current = now;
    try {
      ctx.current ??= new AudioContext();
      const a = ctx.current;
      if (a.state === "suspended") void a.resume();
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = "square";
      osc.frequency.value = 820 + Math.random() * 260;
      gain.gain.setValueAtTime(0.0001, a.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.02, a.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.05);
      osc.connect(gain).connect(a.destination);
      osc.start();
      osc.stop(a.currentTime + 0.06);
    } catch {
      /* audio is a nicety; never let it break the page */
    }
  }, [enabled]);
}

/* ── Small parts ──────────────────────────────────────────────────────── */


/* ── Elsewhere ────────────────────────────────────────────────────────── */

/**
 * The links, as a row of marks.
 *
 * Icons rather than words because six labelled links along the foot of a page
 * is a second navigation bar competing with the conversation. Each one still
 * says what it is: to the screen on hover, and to a screen reader always.
 */
const LINKS: { key: keyof typeof social; label: string; Icon: typeof GitHubIcon }[] = [
  { key: "linkedin", label: "LinkedIn", Icon: LinkedInIcon },
  { key: "github", label: "GitHub", Icon: GitHubIcon },
  { key: "medium", label: "Medium", Icon: MediumIcon },
  { key: "blog", label: "Blog", Icon: BlogIcon },
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "spotify", label: "Spotify", Icon: SpotifyIcon },
  { key: "buymeacoffee", label: "Buy him a coffee", Icon: CoffeeIcon },
];


/** The two sections worth reaching straight from the bar. */

/* ── Deep links ───────────────────────────────────────────────────────── */

/** The address bar changes only when this page changes it. */
const watchNothing = () => () => {};

/** Taps and hovers over these belong to the page, not to Elio behind it. */
const NOT_PIX = "a,button,input,textarea,select,label,[data-no-pix]";

/** What Elio says when poked: a giggle, then dizzy, then cross. */
const QUIPS = {
  laugh: ["Hehe, that tickles!", "Boop! Hi there.", "Oi, that's my face!", "Hello to you too!"],
  dizzy: ["Whoa… the sky's spinning.", "Easy! Delicate electronics.", "Now there are two of you."],
  angry: ["Okay, that's enough poking.", "I'm a screen, not a button! Mostly.", "Hmph. Ask me something instead."],
};
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** A remark placed just above Elio's head, kept inside the window. */
function quipOver(s: Signals, text: string) {
  const half = Math.min(150, window.innerWidth / 2 - 12);
  return {
    text,
    x: Math.min(window.innerWidth - half - 12, Math.max(half + 12, s.headX)),
    y: Math.max(84, s.headY - s.headR * 0.8),
    id: performance.now(),
  };
}

/** The row named in `?p=`, if it names one. */
const readLinked = () => {
  const slug = new URLSearchParams(window.location.search).get("p");
  return slug && BY_ID[slug] ? slug : null;
};

/* ── Page ─────────────────────────────────────────────────────────────── */

export function V3Site({
  character,
  loaderTheme = "studio",
  door = true,
}: {
  character?: CharacterSlot;
  loaderTheme?: "studio" | "sky";
  /** A loading screen until the scene arrives. Without one, the page is readable at once and he fades in. */
  door?: boolean;
} = {}) {
  const [current, setCurrent] = useState(ROOT);

  /*
   * A returning visitor. Elio remembers their name and what they looked at,
   * on their own device, and skips straight to "welcome back". Restored as
   * the door opens (see enter), because the page is prerendered and the
   * server has no storage to read.
   */
  const [lastTopic, setLastTopic] = useState<string | null>(null);
  const [visitNote, setVisitNote] = useState("");
  const [trail, setTrail] = useState<{ node: string; choice: string }[]>([]);
  const [answers, setAnswers] = useState<Partial<Record<Field, string>>>({});
  const [draft, setDraft] = useState("");
  // On by default: it is a talking character, and arriving to silence makes
  // the mute button look like the broken part. A browser will not let any of
  // it play before the first interaction, so the opening lines stay quiet
  // either way and the voice joins in from whichever turn follows.
  const [sound, setSound] = useState(true);
  // Whether the visitor has clicked or pressed anything yet. Until then the
  // browser will not play a sound, so fetching the voice is wasted bytes.
  const [heard, setHeard] = useState(false);
  useEffect(() => setSfxEnabled(sound), [sound]);
  const [reduced, setReduced] = useState(false);
  const [sceneIn, setSceneIn] = useState(false);
  // "auto" defers to the address bar; the other two are a deliberate choice.
  // A plain boolean could not express "I arrived on a link and have now left
  // it", because setting it false from false is not a change and the page
  // would never re-read the URL it had just cleared.
  const [view, setView] = useState<"auto" | "talk" | "index">("auto");
  /** Which shelf of the file is open: projects, certificates, skills, background. */
  const [shelf, setShelf] = useState<ShelfName>("The work");

  // A link to one project opens the index on it. Read this way rather than in
  // the initial state because the page is prerendered and the server has no
  // query string to read, and rather than in an effect because that would
  // render the conversation once before replacing it.
  const linked = useSyncExternalStore(watchNothing, readLinked, () => null);
  const browsing = view === "index" || (view === "auto" && linked !== null);
  // Arriving on a link to one row opens the shelf that row is on.
  const linkedShelf = linked ? ITEMS.find((i) => i.id === linked)?.section : undefined;
  const openShelfName: ShelfName = view === "auto" && linkedShelf ? linkedShelf : shelf;

  // What the visitor last asked, and what came back. Held apart from the
  // conversation tree: a question is a detour, not a new place to stand.
  const [asked, setAsked] = useState<Answer | null>(null);
  /** Nobody has touched the page for a while. */
  const [idle, setIdle] = useState(false);
  /** A question is being looked up. */
  const [musing, setMusing] = useState(false);
  /** Set by tapping the screen: a giggle, then dizzy, then cross if you keep on. */
  const [bonk, setBonk] = useState<"laugh" | "dizzy" | "angry" | null>(null);
  /** A short remark in a bubble over Elio's head: a reaction, not part of the chat. */
  const [quip, setQuip] = useState<{ text: string; x: number; y: number; id: number } | null>(null);
  /** The question behind the current answer, shown back as the visitor's reply. */
  const [question, setQuestion] = useState<string | null>(null);
  const composer = useRef<HTMLInputElement>(null);

  const signals = useRef<Signals>(makeSignals());
  const node = NODES[current];
  const visitor = answers.name?.trim() || undefined;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(mq.matches);
      signals.current.reduced = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Pointer, in -1..1 from the centre of the window.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      signals.current.px = (e.clientX / window.innerWidth) * 2 - 1;
      signals.current.py = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  // The scene is held apart from every other render on this page. Typing sets
  // state once per character, and without this each of those re-rendered the
  // Three.js canvas too — which pushed a 35ms-per-character line out to about
  // 100ms and made the intro take twenty seconds instead of nine.
  const onSceneReady = useCallback(() => setSceneIn(true), []);

  // The door: the loading screen, and whether the visitor has come through it.
  const [entered, setEntered] = useState(false);
  const [doorGone, setDoorGone] = useState(false);
  const [loaded, setLoaded] = useState({ pct: 0, done: false });
  const onProgress = useCallback((pct: number, finished: boolean) => {
    setLoaded((prev) => (prev.done ? prev : { pct, done: finished }));
  }, []);
  // A slow network or a stalled request must not leave someone locked out.
  useEffect(() => {
    const t = setTimeout(() => setLoaded((p) => ({ pct: Math.max(p.pct, 100), done: true })), 15000);
    return () => clearTimeout(t);
  }, []);

  const scene = useMemo(
    () => (
      <Scene signals={signals} onReady={onSceneReady} onProgress={onProgress} paused={!entered} slot={character} />
    ),
    // Re-rendered once, on entering, to wake the render loop.
    [onSceneReady, onProgress, entered, character],
  );

  // The sky behind him, held apart for the same reason as the scene.
  const [skyIn, setSkyIn] = useState(false);
  const onSkyReady = useCallback(() => setSkyIn(true), []);
  const sky = useMemo(
    () =>
      BACKDROP === "painting" ? (
        <SkyBackdrop signals={signals} onReady={onSkyReady} />
      ) : (
        <ParallaxBackground signals={signals} paused={!entered} onReady={onSkyReady} />
      ),
    [onSkyReady, entered],
  );

  // How Elio sounds: the visitor's choice, remembered on this browser.
  // Nothing about it is in the prerendered markup, so reading storage in the
  // initialiser cannot cause a hydration mismatch.
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() =>
    typeof window === "undefined" ? DEFAULT_VOICE : loadVoiceSettings(),
  );
  const [tuning, setTuning] = useState(false);
  const changeVoice = useCallback((v: VoiceSettings) => {
    setVoiceSettings(v);
    saveVoiceSettings(v);
  }, []);
  const { say, stop, prefetch, level } = useSpeech(sound, voiceSettings);
  const closeTuning = useCallback(() => setTuning(false), []);
  // Typing blips and a speaking voice at once is noise; the voice wins.
  const blip = useBlips(false);
  // One wording per visit for the scripted turns, so a second visitor (or a
  // second look) doesn't hear the same greeting word for word. Picked once:
  // re-rendering must not change what Elio is halfway through saying.
  const [variant] = useState(() => Math.floor(Math.random() * 1000));
  const lines = useMemo(() => {
    if (!entered) return [];
    const options = [node.lines, ...(node.variants ?? [])];
    const prompts = [node.prompt, ...(node.prompts ?? [])].filter(Boolean) as string[];
    const body = asked ? asked.lines : options[variant % options.length];
    const prompt = prompts.length ? prompts[variant % prompts.length] : undefined;
    // The node's own question ("Where would you like to start?") belongs to
    // its opening lines; after Elio has answered something, it would be noise.
    const all = prompt && !asked ? [...body, prompt] : body;
    const last = lastTopic ? `Last time you were looking at ${lastTopic}.` : "Good to see you again.";
    return all.map((l) => fill(l.replace("{last}", last), visitor));
  }, [node, asked, visitor, entered, lastTopic, variant]);
  // How the lines should sound: the mood Elio gave its answer, or the turn's,
  // and line by line where its feeling turns partway through.
  const lineMood = bonk ?? asked?.mood ?? node.mood ?? "neutral";
  const lineMoods = useMemo(
    () => lines.map((_, i) => (bonk ? bonk : (asked?.moods?.[i] ?? lineMood))),
    [lines, asked, bonk, lineMood],
  );
  const speakLine = useCallback(
    (text: string, hooks: LineHooks, i: number) => {
      const mood = lineMoods[i] ?? lineMood;
      // The face turns with the voice, line by line, and the body gives a
      // small gesture as each line starts.
      if (asked?.moods && !bonk) signals.current.mood = mood;
      signals.current.beat += 1;
      // Before the first click or key there can be no sound, so the line is
      // shown silently rather than fetched for nothing; the first touch says
      // whichever line is current.
      if (!heard) return null;
      return say(text, hooks, false, mood);
    },
    [say, lineMood, lineMoods, asked, bonk, heard],
  );
  // Ask for every line's voice as soon as the lines exist, so the second is
  // ready by the time the first has been said.
  useEffect(() => {
    if (heard && lines.length) prefetch(lines, lineMoods);
  }, [heard, lines, lineMoods, prefetch]);
  const typed = useTypewriter(
    lines,
    reduced,
    blip,
    speakLine,
    CHARS_PER_SECOND * voiceSettings.rate,
    asked?.turn !== undefined ? `turn:${asked.turn}` : undefined,
    !!asked?.pending,
  );
  const { shown, done, skip } = typed;
  // One bubble per paragraph: a streamed answer arrives a sentence per line,
  // and the sentences of one paragraph sit together, as they always did.
  const bubbles = useMemo(() => {
    const out: { text: string; first: number }[] = [];
    shown.forEach((l, i) => {
      if (asked?.joins?.[i] && out.length) out[out.length - 1].text += ` ${l}`;
      else out.push({ text: l, first: i });
    });
    return out;
  }, [shown, asked]);

  // Arriving on a link opens the file behind the loading screen, and the
  // Enter button takes the keyboard with it. Hand it back to the row the file
  // is open on, or the arrow keys do nothing until someone clicks into it.
  useEffect(() => {
    if (!entered || !browsing) return;
    const id = requestAnimationFrame(() =>
      (document.querySelector('[role="listbox"] [aria-selected="true"] button') as HTMLElement | null)?.focus({
        preventScroll: true,
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [entered, browsing]);

  // Muting stops the voice mid-word rather than at the end of the line.
  useEffect(() => {
    if (!sound) stop();
  }, [sound, stop]);

  /*
   * Entering, and the first gesture.
   *
   * The page opens by itself, and no browser plays sound before the visitor
   * has clicked or pressed something. So the room tone is unlocked at the
   * first click or key, and if Elio is mid-turn the line on screen is said
   * then, rather than waiting for the next one to start.
   */
  const enter = useCallback((withSound: boolean) => {
    if (!withSound) setSound(false);
    const m: Memory = arrive();
    reportVisit(seenBefore());
    setVisitNote(noteFor(m));
    // Names remembered before the parser knew better ("How Are") are
    // checked again on the way in.
    const remembered = m.name ? nameFrom(m.name) : "";
    if (remembered) {
      setAnswers((a) => ({ ...a, name: remembered }));
      setLastTopic(m.topics[0] ?? null);
      setCurrent("welcome");
    }
    setEntered(true);
    setTimeout(() => setDoorGone(true), 800);
  }, []);
  // No door: straight in. The words are on screen from the first paint, and
  // the character fades in over the room whenever he has loaded.
  useEffect(() => {
    if (!door) enter(true);
  }, [door, enter]);
  const unlocked = useRef(false);
  const latest = useRef({ lines: [] as string[], at: 0, done: true, sound: true });
  useEffect(() => {
    latest.current = { lines, at: shown.length - 1, done, sound };
  }, [lines, shown, done, sound]);
  useEffect(() => {
    if (!entered) return;
    const first = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      setHeard(true);
      primeAudio();
      const now = latest.current;
      const line = now.lines[now.at];
      if (now.sound && !now.done && line) say(line);
    };
    window.addEventListener("pointerdown", first, { capture: true });
    window.addEventListener("keydown", first, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", first, { capture: true });
      window.removeEventListener("keydown", first, { capture: true });
    };
  }, [entered, say]);

  // The face moves with the voice itself: every frame, how loud Elio is right
  // now. It used to follow the typewriter, which finishes before the voice,
  // so the mouth went still while Elio was still talking. Muted, there is no
  // voice to follow, so the typewriter drives it as before.
  useEffect(() => {
    if (!sound) {
      signals.current.talking = done ? 0 : 1;
      return;
    }
    let frame = 0;
    const tick = () => {
      signals.current.talking = level();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      signals.current.talking = 0;
    };
  }, [sound, done, level]);

  // The room tone. Tied to the same switch as the voice and to the same first
  // gesture, because an AudioContext made before one is born suspended.
  // No background hum: visitors found it irritating. Elio's voice is the only sound.
  useAmbience(false, false);

  const go = useCallback(
    (next: string, choice: string) => {
      stop(); // do not let the previous line keep talking over the new one
      signals.current.squint = 1; // a quick think
      setTrail((t) => [...t, { node: current, choice }]);
      setCurrent(next);
      setAsked(null);
      setDraft("");
    },
    [current, stop],
  );


  const restart = useCallback(() => {
    stop();
    setTrail([]);
    setAnswers({});
    setAsked(null);
    setQuestion(null);
    setDraft("");
    setCurrent(ROOT);
  }, [stop]);

  /**
   * Answers a typed question.
   *
   * The model behind /api/chat answers, grounded in his portfolio, and turns
   * small talk back toward his work; askPix falls back to the file's own
   * search when the model cannot be reached. The last few exchanges go with
   * each question so a follow-up makes sense.
   */
  /*
   * The arcade: Snake, Dino and Tetris on Elio's screen. While one runs, the
   * keyboard belongs to it (captured before anything else on the page sees a
   * key), the shelf closes so the screen is in view, and Esc gives it back.
   */
  const [playing, setPlaying] = useState<GameName | null>(null);
  const [arcadeOpen, setArcadeOpen] = useState(false);
  // The game menu closes like any menu: Escape, or a click anywhere else.
  useEffect(() => {
    if (!arcadeOpen) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setArcadeOpen(false);
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest('[role="menu"], [aria-label="Play a game on Elio\'s screen"]')) setArcadeOpen(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", away);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", away);
    };
  }, [arcadeOpen]);
  const play = useCallback(
    (name: GameName) => {
      stop();
      setArcadeOpen(false);
      setView("talk");
      signals.current.panel = null;
      signals.current.game = makeGame(name);
      setPlaying(name);
      (document.activeElement as HTMLElement | null)?.blur?.();
    },
    [stop],
  );
  const quitGame = useCallback(() => {
    signals.current.game = null;
    setPlaying(null);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      const game = signals.current.game;
      if (!game || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        quitGame();
        return;
      }
      // Typing in the box still works; only keys the game uses are taken.
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && !/^Arrow/.test(e.code);
      if (typing) return;
      if (game.key(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [playing, quitGame]);
  const playingGame = playing ? GAMES.find((g) => g.name === playing) : undefined;

  const chat = useRef<Turn[]>([]);
  const asking = useRef(0);
  // Earlier exchanges stay on screen above the current one, oldest first.
  const thread = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState<{ q: string | null; a: string[] }[]>([]);
  // Keep the newest message in view as the thread grows and types out.
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  });
  const ask = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q) return;

      // "play snake", "tetris", "let's play a game": the arcade, not the model.
      const wantsGame = q.length < 48 || /\bplay\b/i.test(q) ? gameAsked(q) : null;
      if (wantsGame) {
        asking.current += 1;
        setDraft("");
        if (wantsGame === "menu") {
          setArcadeOpen(true);
          setAsked({ lines: ["I've got Snake, Dino and Tetris on this screen. Pick one."], also: [] });
        } else {
          play(wantsGame);
          const g = GAMES.find((x) => x.name === wantsGame)!;
          setAsked({ lines: [`${g.title}, on my screen. Controls are just below; Esc when you're done.`], also: [] });
        }
        return;
      }
      stop();
      signals.current.squint = 1;
      setMusing(true);
      setDraft("");
      const id = ++asking.current;
      // The first sentence goes up, and is said, while the rest is written.
      const partial = (a: Answer) => {
        if (id !== asking.current) return;
        setAsked({ ...a, turn: id });
        setMusing(false);
      };
      void askPix(q, chat.current, visitor, visitNote, current === "jd" ? "jd" : undefined, partial).then(({ answer, reply, note }) => {
        // A newer question has been asked since; this answer is stale.
        if (id !== asking.current) return;
        // For next time: what they asked (not pasted job ads), and anything
        // Elio decided was worth remembering about them.
        remember({ asked: q.length < 160 ? q : undefined, note });
        // Remember the work they looked at, not links or contact rows.
        if (answer.item && (answer.item.section === "The work" || answer.item.section === "Certifications")) {
          remember({ topic: answer.item.title });
        }
        chat.current = [
          ...chat.current,
          { role: "user" as const, content: q },
          { role: "assistant" as const, content: reply ?? answer.lines.join(" ") },
        ].slice(-12);
        setAsked({ ...answer, turn: id });
        setMusing(false);
      });
    },
    [stop, visitor, visitNote, current, play],
  );

  const submit = useCallback(() => {
    const field = node.input?.field;
    if (!field || !draft.trim()) return;
    const value = field === "name" ? nameFrom(draft) : draft.trim();
    if (field === "name" && !value) {
      const typed = draft.trim();
      // A question instead of a name: skip the name and answer it.
      if (/\?\s*$/.test(typed) || /^(what|who|where|when|why|how|is|are|does|do|can|could|tell|show|has|have)\b/i.test(typed)) {
        setCurrent("ask");
        setQuestion(typed);
        ask(typed);
        return;
      }
      // Otherwise, go on as if they had skipped it.
      go(node.input!.next, typed);
      return;
    }
    if (field === "name" && value !== "I'd rather not say") {
      remember({ name: value });
      reportName(value);
    }
    setAnswers((a) => ({ ...a, [field]: value }));
    // The last answer of "Message him": the note goes to his dashboard. If
    // that fails, the visitor's mail client opens with it written instead,
    // so a message is never silently lost.
    if (field === "message") {
      const name = answers.name && answers.name !== "I'd rather not say" ? answers.name : visitor ?? "";
      const contact = answers.email ?? "";
      void fetch("/api/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, contact, message: value, vid: visitorId() }),
      })
        .then((r) => r.ok)
        .catch(() => false)
        .then((ok) => {
          if (ok) return;
          const body = [value, "", name, contact ? `Reply to: ${contact}` : ""].filter(Boolean).join("\n");
          window.location.href = `mailto:${profile.email}?subject=${encodeURIComponent(`Hello from ${name || "your site"}`)}&body=${encodeURIComponent(body)}`;
        });
    }
    go(node.input!.next, value);
  }, [node, draft, go, ask, answers, visitor]);

  /**
   * The composer's one action.
   *
   * If Elio has asked for something, a name, an address, a message, what you
   * type is the answer. Otherwise it is a question, answered from the file.
   * The visitor never has to know which mode the box is in.
   */
  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    if (node.input) {
      submit();
      return;
    }
    setQuestion(text);
    ask(text);
  }, [draft, node, submit, ask]);

  /*
   * Talking to Elio. What is heard fills the box as it is said, and the
   * finished sentence is sent on its own, exactly as if it had been typed.
   * Elio stops talking while it listens, or it would hear itself.
   */
  const heardFinal = useRef(false);
  const onHeard = useCallback((text: string, final: boolean) => {
    setDraft(text);
    if (final) heardFinal.current = true;
  }, []);
  const { supported: canListen, state: mic, hold: micHeld, error: micError, meter: micMeter, press: micPress, release: micRelease } = useDictation(onHeard);
  const listening = mic === "listening" || mic === "starting";
  const hearing = mic === "working";
  // Holding the mic: Elio leans in and listens.
  useEffect(() => {
    signals.current.listening = listening;
  }, [listening]);
  // The hotkey's name as the visitor's keyboard prints it; none on a phone.
  const altKey = useSyncExternalStore(
    () => () => {},
    () =>
      matchMedia("(pointer: coarse)").matches ? null : /Mac|iPhone|iPad/.test(navigator.platform) ? "⌥" : "Alt",
    () => "Alt",
  );
  // Elio stops talking while it listens, or it would hear itself.
  const holdToTalk = useCallback(() => {
    stop();
    micPress();
  }, [stop, micPress]);
  // Hold the Alt key (Option on a Mac) to talk, from anywhere on the page.
  useEffect(() => {
    if (!canListen) return;
    const down = (e: KeyboardEvent) => {
      if (e.key !== "Alt" || e.repeat || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      holdToTalk();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      e.preventDefault();
      micRelease();
    };
    // Letting go of the key in another window must not leave the mic open.
    const blur = () => micRelease();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [canListen, holdToTalk, micRelease]);
  useEffect(() => {
    if (!heardFinal.current || !draft.trim()) return;
    heardFinal.current = false;
    send();
  }, [draft, send]);

  /** What you said last, shown as your side of the conversation. */
  const lastSaid = useMemo(() => {
    // A pasted job description would fill the screen; show its start.
    if (asked && question) return question.length > 160 ? `${question.slice(0, 150).trimEnd()}…` : question;
    return trail[trail.length - 1]?.choice ?? null;
  }, [asked, question, trail]);


  // Once the form is complete, hand the whole thing to the mail client.
  const mailto = useMemo(() => {
    const body = [
      answers.message ?? "",
      "",
      `${answers.name ?? ""}`,
      answers.email ? `Reply to: ${answers.email}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return `mailto:${profile.email}?subject=${encodeURIComponent(
      `Hello from ${answers.name ?? "your site"}`,
    )}&body=${encodeURIComponent(body)}`;
  }, [answers]);

  const attention = (on: boolean) => () => {
    signals.current.attention = on ? 1 : 0;
  };

  // The list hands the screen a project. This is written to the signals
  // object rather than React state on purpose: the cursor moves with the
  // pointer, and re-rendering the canvas at that rate would cost far more
  // than the readout itself.
  const showOnScreen = useCallback((panel: Panel | null) => {
    base.current = panel;
    signals.current.panel = panel;
  }, []);

  /*
   * What the screen is showing, and what it goes back to.
   *
   * Three things can claim it: the turn being spoken, the row under the
   * cursor in the file, and whichever link is being hovered at the foot of
   * the page. The first two are the base state; a hover is a glance that has
   * to hand the screen back exactly as it found it, so the base is kept
   * separately rather than recomputed when the pointer leaves.
   */
  const base = useRef<Panel | null>(null);
  const [peek, setPeek] = useState<Panel | null>(null);
  // The pictures of his other pages, fetched once the character is on screen,
  // so the first hover over a link already has one to put on the screen but
  // they don't compete with him for the connection while he is loading.
  useEffect(() => {
    if (!sceneIn) return;
    for (const it of Object.values(BY_TITLE)) {
      if (it.panel.image?.startsWith("/previews/")) new window.Image().src = it.panel.image;
    }
  }, [sceneIn]);

  // The whole conversation stays on screen: when a new turn begins, the one
  // before it (what the visitor said, and everything Elio said back) moves up
  // into the thread.
  // A streamed answer is one turn however many sentences it grows by.
  const turnNow = asked ? `a:${asked.turn ?? asked.lines.join(" ")}` : `n:${node.id}`;
  const shownTurn = useRef<{ key: string; q: string | null; lines: string[] }>({ key: "", q: null, lines: [] });
  useEffect(() => {
    const prev = shownTurn.current;
    if (prev.key && prev.key !== turnNow && prev.lines.length && prev.key !== "n:ask") {
      setPast((p) => [...p, { q: prev.q, a: prev.lines }].slice(-20));
    }
    // As bubbles, so an answer keeps its paragraphs when it moves up.
    const all = lines.reduce<string[]>((out, l, i) => {
      if (asked?.joins?.[i] && out.length) out[out.length - 1] += ` ${l}`;
      else out.push(l);
      return out;
    }, []);
    if (prev.key !== turnNow) shownTurn.current = { key: turnNow, q: lastSaid, lines: all };
    else shownTurn.current = { ...prev, lines: all };
  }, [turnNow, lines, lastSaid, asked]);

  // A project or card on the screen illustrates what Elio is saying; once
  // it has finished, and a moment for the eye, the screen goes back to the
  // face, rather than holding a picture while the visitor reads on.
  const turnKey = asked ? `a:${asked.turn ?? asked.lines.join(" ")}` : `n:${node.id}`;
  const [released, setReleased] = useState<string | null>(null);
  // Something to tap (a project, his CV, a way to message him) stays long
  // enough to be tapped; a plain illustration goes after a moment.
  const tappable = !!asked && (!!asked.item || !!asked.actions?.length);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setReleased(turnKey), tappable ? 12000 : 3500);
    return () => window.clearTimeout(t);
  }, [done, turnKey, tappable]);

  // What the turn, or an answer, wants on the screen.
  const wanted = useMemo<Panel | null>(() => {
    if (released === turnKey) return null;
    if (asked) return asked.item?.panel ?? null;
    const shows = node.shows;
    if (!shows) return null;
    if (shows === "stats") return STATS_PANEL;
    if (shows === "greeting") return visitor ? greetingPanel(visitor) : null;
    return BY_TITLE[shows]?.panel ?? null;
  }, [node, asked, visitor, released, turnKey]);


  /*
   * The expression.
   *
   * A turn carries its own, and three things override it: thinking while a
   * question is being looked up, sleepy when nobody has touched the page for
   * a while, and neutral whenever the screen is showing a card instead of a
   * face. Idleness is worth having — a character that holds one expression
   * forever stops reading as a character and starts reading as an image.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      // Long enough that someone reading quietly isn't met by a sleeping face.
      timer = setTimeout(() => setIdle(true), 120000);
    };
    wake();
    for (const ev of ["pointermove", "keydown", "pointerdown"] as const) {
      window.addEventListener(ev, wake, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const ev of ["pointermove", "keydown", "pointerdown"] as const) {
        window.removeEventListener(ev, wake);
      }
    };
  }, []);

  // Not re-run as a streamed answer grows: each line sets its own mood as it
  // is said (see speakLine), and this would put the first one back.
  const askedMood = asked?.mood;
  const askedTurn = asked?.turn;
  useEffect(() => {
    signals.current.mood = bonk
      ? bonk
      : musing || hearing
        ? "thinking"
        : idle && done
          ? "sleepy"
          : (askedMood ?? node.mood ?? "neutral");
  }, [node, idle, done, musing, hearing, bonk, askedMood, askedTurn]);

  /*
   * Tapping the television.
   *
   * The canvas has pointer events switched off so the links underneath stay
   * clickable, so there is nothing in the scene to attach a handler to. The
   * scene publishes where the head is on screen instead and this checks the
   * distance, which costs one subtraction and needs no raycaster.
   *
   * It is dizzy the first couple of times and cross after that, and it
   * forgets within a few seconds either way. A character that stays angry is
   * a bug report; one that is briefly annoyed is a character.
   */
  const taps = useRef({ n: 0, at: 0 });
  useEffect(() => {
    const clear = { t: 0 as ReturnType<typeof setTimeout> | 0 };
    const pending: { run: (() => void) | null } = { run: null };
    const onLift = (e: PointerEvent) => {
      const run = pending.run;
      pending.run = null;
      const s = signals.current;
      if (run && Math.hypot(e.clientX - s.headX, e.clientY - s.headY) <= s.headR) run();
    };
    const onTap = (e: PointerEvent) => {
      const s = signals.current;
      if (!s.headR) return;
      if ((e.target as HTMLElement | null)?.closest(NOT_PIX)) return;
      const dx = e.clientX - s.headX;
      const dy = e.clientY - s.headY;
      if (Math.hypot(dx, dy) > s.headR) return;
      // Quick taps on the head are a double or triple click to the browser,
      // which selected the page and washed the painting in the highlight
      // colour. A tap on Elio is never a selection.
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      // The game has the screen; a tap there is a miss, not a poke.
      if (s.game) return;
      // A card with something to open: the screen is a button. It fires
      // when the finger lifts, because a phone only lets a page open a link
      // or a download from the end of a tap, not its start.
      if (s.panel?.onTap) {
        s.squint = 1;
        pending.run = s.panel.onTap;
        return;
      }

      const now = performance.now();
      taps.current.n = now - taps.current.at < 2600 ? taps.current.n + 1 : 1;
      taps.current.at = now;

      s.squint = 1;
      const n = taps.current.n;
      const reaction = n >= 3 ? "angry" : n === 2 ? "dizzy" : "laugh";
      setBonk(reaction);
      setQuip(quipOver(s, pick(QUIPS[reaction])));
      clearTimeout(clear.t as ReturnType<typeof setTimeout>);
      // Long enough for the robot's own reaction to play out: its Dizzy
      // animation runs four seconds and Angry three, and cutting either off
      // after a second and a half left the reaction barely started.
      clear.t = setTimeout(() => setBonk(null), reaction === "laugh" ? 2000 : reaction === "angry" ? 3000 : 2800);
    };
    window.addEventListener("pointerdown", onTap);
    window.addEventListener("pointerup", onLift);
    return () => {
      window.removeEventListener("pointerdown", onTap);
      window.removeEventListener("pointerup", onLift);
      clearTimeout(clear.t as ReturnType<typeof setTimeout>);
    };
  }, []);

  /** Opens the shelf a row lives on, at that row; also what a deep link does. */
  const openAt = useCallback(
    (id: string) => {
      stop();
      const url = new URL(window.location.href);
      url.searchParams.set("p", id);
      window.history.replaceState(null, "", url);
      const item = ITEMS.find((i) => i.id === id);
      if (item) setShelf(item.section);
      setView("index");
    },
    [stop],
  );

  const downloadResume = useCallback(() => {
    const link = document.createElement("a");
    link.href = RESUME_PDF;
    link.download = "Ghanshyam-Paunikar-Resume.pdf";
    link.click();
  }, []);

  /** Opens one shelf from the bar. */
  const openShelf = useCallback(
    (section: ShelfName) => {
      stop();
      signals.current.squint = 1;
      const url = new URL(window.location.href);
      url.searchParams.delete("p");
      window.history.replaceState(null, "", url);
      setShelf(section);
      setView("index");
    },
    [stop],
  );

  const openIndex = useCallback(() => openShelf("The work"), [openShelf]);

  // Pointing at Elio: the cursor becomes a hand and the face lights up. The
  // first time, it says hello.
  useEffect(() => {
    let over = false;
    let greeted = false;
    const onMove = (e: PointerEvent) => {
      const s = signals.current;
      const blocked = !!(e.target as HTMLElement | null)?.closest(NOT_PIX);
      const inside =
        !!s.headR && !s.game && !blocked && Math.hypot(e.clientX - s.headX, e.clientY - s.headY) < s.headR;
      if (inside === over) return;
      over = inside;
      s.hover = inside;
      document.documentElement.style.cursor = inside ? "pointer" : "";
      if (inside && !greeted && !s.panel && e.pointerType === "mouse") {
        greeted = true;
        setQuip(quipOver(s, "Oh, hi! Poke my screen, I dare you."));
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.style.cursor = "";
    };
  }, []);

  // While the visitor types, Elio watches the box, and stops talking the
  // moment they start: they have something to say.
  const typedBefore = useRef(false);
  useEffect(() => {
    const typed = !!draft.trim();
    signals.current.typing = typed ? 1 : 0;
    if (typed && !typedBefore.current && draft !== "…") stop();
    typedBefore.current = typed;
  }, [draft, stop]);

  useEffect(() => {
    if (!quip) return;
    const t = window.setTimeout(() => setQuip(null), 2600);
    return () => window.clearTimeout(t);
  }, [quip]);

  /*
   * Things the screen offers on its own.
   *
   * When nothing is going on, every half a minute or so the face gives way
   * for a few seconds to something worth knowing, each one a button: the
   * time where he is, that he is open to work, a project, his code, a game.
   */
  const moments = useMemo<Panel[]>(() => {
    const projects = ITEMS.filter((i) => i.section === "The work");
    const fine = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
    return [
      {
        kicker: "Status",
        title: "Open to work",
        lines: ["AI / ML, LLM and data roles", "Remote, or hybrid in Pune"],
        tap: "Get his CV",
        onTap: downloadResume,
      },
      {
        kicker: "Pune, India · right now",
        title: "Local time",
        metric: "",
        metricLabel: "",
        tap: "Message him",
        onTap: () => go("form_email", "Message him"),
      },
      ...projects.map((p) => ({
        ...p.panel,
        tap: "See it",
        onTap: () => openAt(p.id),
      })),
      {
        kicker: "Try asking me",
        title: "Is he a fit?",
        lines: ["Paste a job description", "and I'll give you an honest answer"],
        tap: "Paste one",
        onTap: () => composer.current?.focus(),
      },
      {
        kicker: "Elsewhere",
        title: "His code is public",
        lines: [social.github.replace(/^https?:\/\/(www\.)?/, ""), "Every project here, source and all"],
        tap: "Open GitHub",
        onTap: () => window.open(social.github, "_blank", "noopener"),
      },
      ...(fine
        ? [
            {
              kicker: "Bored?",
              title: "Play on my screen",
              lines: ["Snake, Dino or Tetris", "Arrow keys to play, Esc to stop"],
              tap: "Pick a game",
              onTap: () => setArcadeOpen(true),
            },
          ]
        : []),
    ];
  }, [downloadResume, go, openAt]);
  const [moment, setMoment] = useState<Panel | null>(null);
  // Bumped to keep a card up while the pointer is on it, so it can be tapped.
  const [hold, setHold] = useState(0);
  const momentIx = useRef(-1);
  const quiet =
    entered &&
    done &&
    !musing &&
    !browsing &&
    !playing &&
    !arcadeOpen &&
    !wanted &&
    !peek &&
    !bonk &&
    !draft.trim() &&
    !(tappable && released !== turnKey);
  useEffect(() => {
    if (!quiet) {
      if (moment) setMoment(null);
      return;
    }
    const t = window.setTimeout(
      () => {
        if (moment && signals.current.hover) return setHold((h) => h + 1);
        setHold(0);
        if (moment) return setMoment(null);
        // The projects take turns, one per cycle, between the other cards.
        momentIx.current += 1;
        const others = moments.filter((m) => !m.image);
        const pics = moments.filter((m) => m.image);
        const i = momentIx.current;
        let next = i % 2 === 1 && pics.length ? pics[Math.floor(i / 2) % pics.length] : others[Math.floor(i / 2) % others.length];
        if (next.title === "Local time") {
          const now = new Date();
          const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
          next = {
            ...next,
            metric: new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(now),
            metricLabel:
              hour < 6 ? "he's asleep. I'm not" : hour < 10 ? "coffee o'clock" : hour < 19 ? "working hours" : "evening, still reading mail",
          };
        }
        setMoment(next);
      },
      moment ? (hold ? 1500 : 10000) : 18000 + Math.random() * 14000,
    );
    return () => window.clearTimeout(t);
  }, [quiet, moment, moments, hold]);

  // What Elio shows while answering, made into a button where there is
  // something to open: the project it mentioned, or the first thing it
  // offered (his CV, a way to message him, the list of work).
  const onScreen = useMemo<Panel | null>(() => {
    if (!wanted) return null;
    if (asked?.item) {
      const item = asked.item;
      return {
        ...wanted,
        tap: item.href ? "Open it" : "See more",
        onTap: () => (item.href ? window.open(item.href, "_blank", "noopener") : openAt(item.id)),
      };
    }
    return wanted;
  }, [wanted, asked, openAt]);
  const offer = useMemo<Panel | null>(() => {
    if (!asked || asked.item || released === turnKey) return null;
    for (const a of asked.actions ?? []) {
      switch (a) {
        case "resume":
          return { kicker: "His CV", title: "Ghanshyam Paunikar", lines: ["One page, PDF"], tap: "Download", onTap: downloadResume };
        case "contact":
          return { kicker: "Get in touch", title: "Message him", lines: [profile.email], tap: "Write now", onTap: () => go("form_email", "Message him") };
        case "index":
          return { kicker: "The work", title: "All his projects", lines: ["Newest first, with code"], tap: "Open the list", onTap: openIndex };
        case "github":
          return { kicker: "GitHub", title: "His code", lines: [social.github.replace(/^https?:\/\/(www\.)?/, "")], tap: "Open GitHub", onTap: () => window.open(social.github, "_blank", "noopener") };
        case "linkedin":
          return { kicker: "LinkedIn", title: "His profile", lines: ["Career, posts, recommendations"], tap: "Open LinkedIn", onTap: () => window.open(social.linkedin, "_blank", "noopener") };
        case "medium":
          return { kicker: "Medium", title: "His writing", lines: ["Articles on AI he's built"], tap: "Open Medium", onTap: () => window.open(social.medium, "_blank", "noopener") };
        default: {
          const art = a.startsWith("read:") ? articles.find((x) => x.id === a.slice(5)) : undefined;
          if (art) return { kicker: "On Medium", title: art.title, lines: [], tap: "Read it", onTap: () => window.open(art.href, "_blank", "noopener") };
        }
      }
    }
    return null;
  }, [asked, released, turnKey, downloadResume, go, openIndex]);

  // The one place the scene is written to, so a glance can always put back
  // what was there. The file owns the screen while it is open, and writes
  // through `base` as the cursor moves.
  useEffect(() => {
    if (!browsing) base.current = onScreen ?? offer;
    signals.current.panel = peek ?? base.current ?? (quiet ? moment : null);
  }, [peek, onScreen, offer, browsing, quiet, moment]);

  const closeIndex = useCallback(() => {
    // Leaving the index leaves the project behind, so a refresh does not drop
    // the reader straight back into it — and so the link above reads as shut.
    const url = new URL(window.location.href);
    url.searchParams.delete("p");
    window.history.replaceState(null, "", url);
    setView("talk");
    base.current = null;
    signals.current.panel = null;
  }, []);

  // Shortcuts, for anyone who would rather not wait for a typing animation:
  // a number picks a choice, return finishes the line, P opens the index.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (browsing) {
        if (e.key === "Escape") closeIndex();
        return;
      }
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        openIndex();
        return;
      }
      if (!done) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          skip();
        }
        return;
      }
      const n = Number(e.key);
      if (node.choices && n >= 1 && n <= node.choices.length) {
        const c = node.choices[n - 1];
        // Questions for the model go through their buttons; this picks those.
        if (c.next) go(c.next, c.label);
        else document.querySelectorAll<HTMLButtonElement>("[data-reply]")[n - 1]?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [browsing, done, node, go, skip, stop, openIndex, closeIndex]);

  /**
   * Links Elio offered with its answer ("there's a write-up on Medium"),
   * shown under the reply so they can be opened right there in the chat.
   */
  const offered = useMemo<{ label: string; run: () => void }[]>(() => {
    if (!asked) return [];
    return (asked.actions ?? []).flatMap((a) => {
      if (a.startsWith("read:")) {
        const art = articles.find((x) => x.id === a.slice(5));
        return art ? [{ label: `Read: ${art.title}`, run: () => window.open(art.href, "_blank", "noopener") }] : [];
      }
      switch (a) {
        case "medium":
          return [{ label: "His Medium", run: () => window.open(social.medium, "_blank", "noopener") }];
        case "github":
          return [{ label: "GitHub", run: () => window.open(social.github, "_blank", "noopener") }];
        case "linkedin":
          return [{ label: "LinkedIn", run: () => window.open(social.linkedin, "_blank", "noopener") }];
        case "resume":
          return [{ label: "Download the résumé", run: downloadResume }];
        case "contact":
          return [{ label: "Message him", run: () => go("form_email", "Message him") }];
        default:
          return [];
      }
    });
  }, [asked, downloadResume, go]);

  /**
   * The quick replies under what Elio just said.
   *
   * They are suggestions for the composer rather than the only way forward,
   * so every state offers some, including the ones that used to be dead ends:
   * the question turn shows example questions, an answer shows where it
   * points, and the contact form can be backed out of.
   */
  const replies = useMemo<{ label: string; run: () => void }[]>(() => {
    if (node.input) {
      return node.input.field === "name"
        ? [{ label: "I'd rather not say", run: () => go(node.input!.next, "I'd rather not say") }]
        : [{ label: "Never mind", run: () => go("ask", "Never mind") }];
    }
    if (node.end) {
      return [
        { label: "Open it in mail", run: () => { window.location.href = mailto; } },
        { label: "Start again", run: () => restart() },
      ];
    }
    if (asked) {
      // Elio's own offers first, then related work.
      const acts = (asked.actions ?? []).map((a) => {
        switch (a) {
          case "contact":
            return { label: "Message him", run: () => go("form_email", "Message him") };
          case "resume":
            return { label: "Download the résumé", run: () => downloadResume() };
          case "index":
            return { label: "See all his work", run: () => openIndex() };
          case "github":
            return { label: "GitHub", run: () => window.open(social.github, "_blank", "noopener") };
          case "linkedin":
            return { label: "LinkedIn", run: () => window.open(social.linkedin, "_blank", "noopener") };
          case "medium":
            return { label: "His Medium", run: () => window.open(social.medium, "_blank", "noopener") };
          default: {
            const art = a.startsWith("read:") ? articles.find((x) => x.id === a.slice(5)) : undefined;
            return art ? { label: "Read the article", run: () => window.open(art.href, "_blank", "noopener") } : undefined;
          }
        }
      }).filter((x): x is { label: string; run: () => void } => !!x);
      // Then the questions Elio expects next, which go straight back to it;
      // related work only when it suggested none.
      const follow = (asked.next ?? []).map((q) => ({
        label: q,
        run: () => {
          setQuestion(q);
          ask(q);
        },
      }));
      const items = follow.length ? [] : asked.also.map((item) => ({ label: item.title, run: () => openAt(item.id) }));
      return [...acts.slice(0, 2), ...follow, ...items].slice(0, 4);
    }
    return (node.choices ?? []).map((c) => ({
      label: c.label,
      run: () => {
        if (c.ask) {
          setQuestion(c.label);
          ask(c.ask);
        } else if (c.next) go(c.next, c.label);
      },
    }));
  }, [node, asked, go, mailto, restart, openAt, ask, openIndex, downloadResume]);

  // On a desk, the composer takes the keyboard once Elio has finished
  // speaking, so typing a reply needs no click. On a phone it does not:
  // focusing an input there throws a keyboard over half the screen.
  useEffect(() => {
    if (!entered || !done || browsing) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    composer.current?.focus({ preventScroll: true });
  }, [entered, done, browsing, current]);

  return (
    <main
      className="relative h-[100svh] w-full overflow-hidden text-black"
      style={{
        // A studio sweep rather than a flat wash: cool at the top, warming
        // toward the floor, the way a seamless backdrop lit from one side
        // actually falls. The character is lit by a blue probe, so the room
        // it stands in has to agree with that or he looks pasted on.
        background:
          "linear-gradient(174deg, #eaebee 0%, #dee0e4 34%, #c9cacd 66%, #a9a8a8 100%)",
        fontFamily: "var(--font-text), var(--font-sans), system-ui, sans-serif",
      }}
    >
      {/* The room: a key light behind the character, a cool fill behind the
          text, a pool of phosphor where the screen throws green onto the
          backdrop, and a contact shadow so he is standing on something rather
          than floating. All gradients — nothing to load, and it scales to any
          window because every stop is a percentage. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
        {character?.backdrop ?? (
        <>
        {/* The sky: the painting (or its 3D rebuild, see BACKDROP) fades in
            over the studio sweep once it has loaded. Until then the sweep and
            its lights below are the room. */}
        <div
          className="absolute inset-0 transition-opacity duration-[1400ms] ease-out"
          style={{ opacity: skyIn ? 1 : 0 }}
        >
          {sky}
        </div>
        {/* Key: a wide soft pool behind the shoulders, warm against the sweep. */}
        <div
          className="absolute -inset-x-[10%] -top-[20%] bottom-0 transition-opacity duration-[1400ms]"
          style={{
            opacity: skyIn ? 0 : 1,
            background:
              "radial-gradient(54% 50% at 70% 34%, rgba(255,252,246,0.98) 0%, rgba(255,249,238,0.5) 34%, rgba(255,249,238,0) 70%)",
            // v3breathe animates opacity, which would hold this lit over the sky.
            animation: reduced || skyIn ? undefined : "v3breathe 19s ease-in-out infinite",
          }}
        />
        {/* Fill: cool, low and to the left, so the reading side stays calm. */}
        <div
          className="absolute inset-0 transition-opacity duration-[1400ms]"
          style={{
            // Over the sky it only greys the blue; the painting is calm enough.
            opacity: skyIn ? 0 : 1,
            background:
              "radial-gradient(48% 46% at 10% 62%, rgba(196,210,226,0.72) 0%, rgba(196,210,226,0) 68%)",
          }}
        />
        {/* The screen's own light, thrown back onto the backdrop. It sits
            where the head is and lifts a little while a card is up. */}
        <div
          className="absolute inset-0 transition-opacity duration-[1400ms] ease-out"
          style={{
            opacity: sceneIn ? (browsing ? 0.85 : 0.5) : 0,
            background:
              "radial-gradient(26% 24% at 72% 30%, rgba(120,230,190,0.2) 0%, rgba(120,230,190,0.06) 45%, rgba(120,230,190,0) 75%)",
            animation: reduced ? undefined : "v3breathe 13s ease-in-out infinite reverse",
          }}
        />
        {/* Contact shadow: the floor he is standing on. */}
        <div
          className="absolute inset-x-0 bottom-0 h-[44%] transition-opacity duration-[1400ms]"
          style={{
            opacity: skyIn ? 0 : 1,
            background:
              "radial-gradient(56% 100% at 70% 122%, rgba(22,25,31,0.62) 0%, rgba(22,25,31,0.24) 40%, rgba(22,25,31,0) 74%)",
          }}
        />
        {/* Vignette, very slight, to stop the corners glowing. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(116% 106% at 52% 40%, rgba(0,0,0,0) 48%, rgba(24,26,31,0.34) 100%)",
          }}
        />
        </>
        )}
      </div>

      {/* Film grain. Generated by the browser, so there is no texture to load. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[5] opacity-[0.16] mix-blend-multiply ${character?.grain === false ? "hidden" : ""}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />

      {/* The character, bleeding off the bottom and right edges. */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] transition-opacity duration-[1200ms] ease-out"
        style={{ opacity: sceneIn ? 1 : 0 }}
      >
        <div className={`h-full w-full ${browsing ? "max-lg:opacity-0" : ""}`}>{scene}</div>
      </div>

      {/* The top bar.
          A band across the page rather than three things floating over the
          room: it gives the links somewhere to live, and a hairline along the
          bottom tells the eye where the page ends and the studio begins. */}
      <header
        className="absolute inset-x-0 top-0 z-20 flex h-[58px] items-center justify-between gap-2 whitespace-nowrap px-3 text-[14px] text-black/70 sm:h-[64px] sm:gap-5 sm:px-6 sm:text-[15px]"
        style={{
          // The room's own colour, half a step lighter.
          //
          // Ink made the bar a separate object sitting on top of the page.
          // This is the top of the studio sweep with a little more light in
          // it, so the bar reads as the same surface, lifted — the hairline
          // and the shadow under it do the separating, not the hue.
          background: "transparent",
        }}
      >
        {/* Left: what there is to look at, in the order a visitor wants it.
            The two sections anyone actually comes for hang off the bar
            directly, because someone who wants the projects wants a list of
            the projects, not a search box and thirty-six rows to scroll. */}
        <div className="flex min-w-0 items-center gap-2 max-sm:flex-1 sm:gap-3">
          {/* One button per shelf. The open one is dark; pressing it again goes
              back to the talk. */}
          <nav
            aria-label="The file"
            className="neu-sunk flex items-center gap-1 overflow-x-auto max-sm:w-full max-sm:justify-between max-sm:gap-0 sm:max-w-[calc(100vw-150px)] rounded-full p-1 [scrollbar-width:none]"
          >
            {SHELF_TABS.map((t) => {
              const on = browsing && openShelfName === t.shelf;
              // The résumé is a download, not a shelf: no preview.
              if (t.shelf === "Resume")
                return (
                  <a
                    key={t.shelf}
                    href={RESUME_PDF}
                    download
                    className="flex h-[30px] shrink-0 items-center gap-1 rounded-full px-[7px] text-[13px] tracking-[-0.01em] text-black/60 transition-all duration-200 hover:text-black sm:px-[15px] sm:text-[15px]"
                  >
                    {t.label}
                    <span aria-hidden className="text-[0.85em]">↓</span>
                  </a>
                );
              return (
                <button
                  key={t.shelf}
                  type="button"
                  aria-pressed={on}
                  onClick={() => (on ? closeIndex() : openShelf(t.shelf))}
                  className={`flex h-[30px] shrink-0 items-center rounded-full px-[7px] text-[13px] tracking-[-0.01em] transition-all duration-200 sm:px-[15px] sm:text-[15px] ${
                    on ? "neu-raised text-black" : "text-black/60 hover:text-black"
                  }`}
                >
                  {t.shelf === "Certifications" ? (
                    <>
                      <span className="sm:hidden">Certs</span>
                      <span className="max-sm:hidden">{t.label}</span>
                    </>
                  ) : (
                    t.label
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: whose site this is, and where else he is. */}
        <div className="flex items-center gap-2 sm:gap-3">
          <nav
            aria-label="Elsewhere"
            className="neu-sunk flex items-center gap-0.5 rounded-full p-1 max-lg:hidden"
          >
            {LINKS.map(({ key, label, Icon }) => (
              <a
                key={key}
                href={social[key]}
                target="_blank"
                rel="noreferrer"
                title={label}
                aria-label={label}
                onMouseEnter={() => {
                  attention(true)();
                  setPeek(BY_TITLE[label]?.panel ?? null);
                }}
                onMouseLeave={() => {
                  attention(false)();
                  setPeek(null);
                }}
                onFocus={() => setPeek(BY_TITLE[label]?.panel ?? null)}
                onBlur={() => setPeek(null)}
                className="grid h-[30px] w-[30px] place-items-center rounded-full text-black/45 transition-colors duration-200 hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white"
              >
                <Icon className="h-[15px] w-[15px]" />
              </a>
            ))}
          </nav>
          {/* Games on Elio's screen. Opening the picker brings the conversation
              back if a shelf is open, since the picker sits above the box. */}
          <button
            type="button"
            aria-label={playing ? "Stop the game" : "Play a game on Elio's screen"}
            title="Play Snake, Dino or Tetris on Elio's screen"
            aria-pressed={!!playing || arcadeOpen}
            onClick={() => {
              if (playing) return quitGame();
              setView("talk");
              setArcadeOpen((v) => !v);
            }}
            className={`neu-sunk flex h-[34px] items-center gap-1.5 rounded-full px-[14px] tracking-[-0.01em] transition-colors duration-200 pointer-coarse:hidden ${
              playing || arcadeOpen ? "text-black" : "hover:text-black/60"
            }`}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="1.8" y="5.5" width="16.4" height="9.5" rx="4.75" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6 8.4v3.6M4.2 10.2h3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="13.2" cy="9.2" r="0.95" fill="currentColor" />
              <circle cx="15" cy="11.2" r="0.95" fill="currentColor" />
            </svg>
            <span className="max-xl:hidden">{playing ? "Stop" : "Play"}</span>
          </button>
          <a
            href={mailto}
            className="neu-sunk flex h-[34px] items-center rounded-full px-[18px] tracking-[-0.01em] transition-colors duration-200 hover:text-black/60 max-sm:hidden"
          >
            Let&apos;s talk
          </a>
        </div>
      </header>

      {/* Who this is, in words, before anything else has loaded: a visitor
          who gives the page ten seconds should leave knowing his name, what
          he does and where the work is, whether or not they talk to Elio. */}
      {!browsing && (
        <div className="absolute left-4 top-[66px] z-10 max-w-[min(520px,calc(100vw-32px))] sm:left-6 lg:left-[clamp(40px,3.4vw,76px)] lg:top-[clamp(96px,14vh,150px)]">
          <h1 className="text-[clamp(24px,2.7vw,42px)] font-medium leading-[1.05] tracking-[-0.025em] text-[#1d2026]">
            {profile.name}
          </h1>
          <p className="mt-1.5 text-[clamp(13px,1.05vw,17px)] leading-snug text-black/60 lg:mt-2.5">
            {profile.title}
          </p>
          <div className="mt-3 flex items-center gap-2 lg:hidden">
            <a
              href={mailto}
              className="neu-sunk flex h-[34px] items-center rounded-full px-4 text-[14px] tracking-[-0.01em] text-black/75 transition-colors hover:text-black"
            >
              Let&apos;s talk
            </a>
          </div>
        </div>
      )}

      {browsing && (
        <Shelf
          key={openShelfName}
          shelf={openShelfName}
          start={linked}
          onClose={closeIndex}
          onShow={showOnScreen}
          reduced={reduced}
        />
      )}

      {/* The conversation.
          One way in: a composer that is always there. Whatever Elio is asking
          for, a name, an address, a question about the work, you type it in
          the same box, and the choices sit above it as quick replies. The
          earlier version had pills, number keys, a name box, a separate turn
          you had to find before you could ask anything, a skip gesture, a back
          button and a restart button: seven ways to interact, none of them
          obvious, which is what made it read as complicated rather than rich. */}
      {!browsing && (
        <section
          aria-label="Conversation with Elio"
          className="absolute inset-y-0 left-0 z-10 flex w-[min(560px,40vw)] flex-col px-7 pb-[clamp(28px,4vh,48px)] pt-24 lg:pt-[clamp(250px,34vh,330px)] max-lg:inset-x-0 max-lg:top-auto max-lg:max-h-[47svh] max-lg:pt-0 max-lg:w-full max-lg:px-4 max-lg:pb-8 lg:pl-[clamp(40px,3.4vw,76px)]"
        >
          {/* Until the visitor has said anything, the conversation sits in the
              middle of the page; their first message sends it down to rest on
              the bottom edge, the way a chat settles once it has begun. Two
              springs, the lower one let go, so the move is a glide. */}
          <div aria-hidden className="grow" />
          {/* What Elio is saying. Tapping it finishes the typing. */}
          <div
            onClick={done ? undefined : skip}
            ref={thread}
            className="min-h-0 overflow-y-auto pt-14 [scrollbar-width:none] max-lg:[mask-image:linear-gradient(to_bottom,transparent_0,#000_52px)] max-lg:[-webkit-mask-image:linear-gradient(to_bottom,transparent_0,#000_52px)]"

          >
            {/* Your last message, as a reply, so the page reads as a
                conversation you are part of rather than a script you watch. */}
            {past.map((x, i) => (
              <div key={i} className="mb-5 opacity-80">
                {x.q && <div className="mb-2 flex justify-end">
                  <p className="neu-raised max-w-[80%] rounded-[20px] rounded-br-[6px] px-4 py-2.5 text-[clamp(14px,1vw,16px)] leading-[1.45] text-[#1d2026]">
                    {x.q}
                  </p>
                </div>}
                <div className="flex flex-col items-start gap-1.5 text-[clamp(14px,1vw,16px)] leading-[1.5] text-[#1d2026]">
                  {x.a.map((l, j) => (
                    <p key={j} className="neu-card max-w-[88%] rounded-[20px] rounded-bl-[6px] px-4 py-2.5">
                      {l}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {lastSaid && (
              <div className="mb-6 flex justify-end">
                <p
                  key={lastSaid}
                  className="neu-raised max-w-[80%] rounded-[20px] rounded-br-[6px] px-4 py-2.5 text-[clamp(14px,1vw,16px)] leading-[1.45] text-[#1d2026]"
                  style={{ animation: reduced ? undefined : "v3rise 320ms cubic-bezier(.16,1,.3,1) both" }}
                >
                  {lastSaid}
                </p>
              </div>
            )}

            <p className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-black/45">
              <span
                aria-hidden
                className="block h-[7px] w-[7px] rounded-full bg-[#2fbf8f]"
                style={{ animation: !done && !reduced ? "v3pulse 1.4s ease-in-out infinite" : undefined, boxShadow: "0 0 10px rgba(47,191,143,0.55)" }}
              />
              {ASSISTANT}
            </p>

            {/* Elio's side, as chat bubbles: the same size and shape as the
                visitor's, light where theirs is dark, one per line. */}
            <div
              aria-live="polite"
              className="flex flex-col items-start gap-1.5 text-[clamp(14px,1vw,16px)] leading-[1.5] tracking-[-0.005em] text-[#1d2026]"
              style={{ fontFamily: "var(--font-text), system-ui, sans-serif" }}
            >
              {musing && (
                <p className="neu-card rounded-[20px] rounded-bl-[6px] px-4 py-3" aria-label="Elio is typing">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="block h-1.5 w-1.5 rounded-full bg-black/40"
                        style={{ animation: reduced ? undefined : `v3pulse 1s ${d * 0.15}s ease-in-out infinite` }}
                      />
                    ))}
                  </span>
                </p>
              )}
              {!musing && bubbles.map(({ text: l, first: i }, b) => {
                const isPrompt = !!node.prompt && !asked && i === lines.length - 1;
                const last = b === bubbles.length - 1;
                return (
                  <p
                    key={i}
                    className={`neu-card max-w-[88%] rounded-[20px] rounded-bl-[6px] px-4 py-2.5 ${
                      last ? "rounded-bl-[6px]" : ""
                    } ${isPrompt ? "font-medium text-[#121418]" : ""}`}
                  >
                    {l}
                    {last && !done && (
                      <span
                        aria-hidden
                        className="ml-1 inline-block h-[0.8em] w-[2px] translate-y-[0.08em] bg-[#121418]"
                        style={{ animation: reduced ? undefined : "v3blink 1s steps(1) infinite" }}
                      />
                    )}
                  </p>
                );
              })}
            </div>
          </div>

          {/* No suggested replies: the visitor types (or talks) whatever they
              like. Only the links Elio offered sit under its answer. */}
          {done && offered.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {offered.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={o.run}
                  className="neu-raised max-w-full truncate rounded-full px-3.5 py-1.5 text-[13px] transition-opacity hover:opacity-80"
                >
                  {o.label} ↗
                </button>
              ))}
            </div>
          )}
          <div className="mt-4" />

          {/* The composer. Always present, always the same place. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="neu-sunk relative mt-3 flex items-center gap-1.5 rounded-[22px] p-1.5"
          >
            <button
              type="button"
              aria-label={sound ? "Mute Elio" : "Let Elio speak"}
              aria-pressed={sound}
              onClick={() => {
                if (sound) stop();
                setSound((v) => !v);
              }}
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-black/55 transition-colors hover:bg-black/[0.06] hover:text-black"
            >
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M3 5.2h2L7.6 3v8L5 8.8H3z" fill="currentColor" />
                {sound ? (
                  <path d="M9.6 5a2.6 2.6 0 0 1 0 4M10.9 3.6a4.6 4.6 0 0 1 0 6.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                ) : (
                  <path d="M9.6 5.2 12 8.8M12 5.2 9.6 8.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                )}
              </svg>
            </button>
            <button
              type="button"
              aria-label="Choose Elio's voice"
              aria-expanded={tuning}
              onClick={() => setTuning((v) => !v)}
              className={`grid h-10 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-black/[0.06] hover:text-black ${
                tuning ? "text-black" : "text-black/45"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="6" cy="4" r="1.6" fill="#f7f8f9" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="10.5" cy="8" r="1.6" fill="#f7f8f9" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="5" cy="12" r="1.6" fill="#f7f8f9" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
            {tuning && (
              <VoicePicker
                settings={voiceSettings}
                onChange={changeVoice}
                onClose={closeTuning}
                onTest={() => {
                  stop();
                  say(`Hi${visitor ? ` ${visitor}` : ""}, I'm Elio. This is how I sound now.`, {}, true);
                }}
              />
            )}
            <input
              ref={composer}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              // Enter in an empty box hurries Elio along. The box holds the
              // keyboard while Elio types, so without this the key that people
              // reach for to skip ahead would simply vanish into it.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !draft.trim() && !done) {
                  e.preventDefault();
                  skip();
                }
              }}
              placeholder={
                micError && !draft
                  ? micError
                  : mic === "starting"
                    ? "Opening the mic…"
                    : mic === "listening"
                      ? micHeld
                        ? "Listening… let go to send"
                        : "Listening… pause or tap the mic to send"
                      : hearing
                        ? "Getting your words…"
                        : node.input?.placeholder ??
                    (node.id === "jd"
                      ? "Paste the job description…"
                      : node.end
                        ? "Anything else? Ask away"
                        : !altKey
                          ? "Ask Elio anything"
                          : canListen
                            ? `Ask Elio anything · hold ${altKey} to talk`
                            : "Ask Elio anything about Ghanshyam")
              }
              type={node.input?.field === "email" ? "email" : "text"}
              aria-label={node.input ? node.input.placeholder : "Ask Elio about Ghanshyam"}
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[clamp(15px,1.05vw,17px)] tracking-[-0.01em] text-black outline-none placeholder:text-black/38"
            />
            {canListen && (
              <button
                type="button"
                ref={micMeter}
                aria-label={listening ? "Stop and send" : "Talk to Elio: tap and speak, or hold (also Alt / Option)"}
                title={listening ? "Tap to send" : "Tap and speak · or hold · or hold Alt / ⌥"}
                aria-pressed={listening}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  holdToTalk();
                }}
                onPointerUp={micRelease}
                onPointerCancel={micRelease}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault();
                    holdToTalk();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter") micRelease();
                }}
                disabled={hearing}
                className={`relative grid h-10 w-10 shrink-0 touch-none select-none place-items-center rounded-full transition-colors duration-200 ${
                  mic === "listening"
                    ? "bg-[#e5484d] text-white"
                    : mic === "starting"
                      ? "bg-[#e5484d]/25 text-[#e5484d]"
                      : hearing
                        ? "text-black/55"
                        : "text-black/55 hover:bg-black/[0.06] hover:text-black"
                }`}
              >
                {/* Swells with the voice, so you can see it's hearing you. */}
                {mic === "listening" && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-[#e5484d]/30 transition-transform duration-75"
                    style={{ transform: "scale(calc(1 + var(--level, 0) * 0.7))" }}
                  />
                )}
                {hearing && (
                  <span aria-hidden className="absolute inset-[3px] animate-spin rounded-full border-2 border-black/10 border-t-black/50" />
                )}
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="relative">
                  <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#121418] text-white transition-[opacity,transform] duration-200 enabled:hover:scale-[1.04] disabled:opacity-25"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 11.5V2.8M3 6.6 7 2.6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
          <div
            aria-hidden
            className="max-lg:hidden"
            style={{ flexGrow: lastSaid ? 0 : 1, transition: reduced ? undefined : "flex-grow 700ms cubic-bezier(.16,1,.3,1)" }}
          />
        </section>
      )}

      {/* The arcade, under the Play button: a game picker, or the controls of
          the game being played. Up here it reads as part of the button that
          opened it, not as something Elio said. */}
      {playing && (
        <div
          data-no-pix
          className="neu-card absolute right-3 top-[62px] z-30 flex max-w-[calc(100vw-24px)] flex-wrap items-center justify-end gap-2 rounded-[20px] px-3 py-2.5 sm:right-6 sm:top-[70px]"
          style={{ animation: reduced ? undefined : "v3rise 260ms cubic-bezier(.16,1,.3,1) both" }}
        >
          <span className="text-[13px] text-black/60">
            <span className="font-medium text-black/80">{playingGame?.title}</span> · {playingGame?.help}
          </span>
          <button
            type="button"
            onClick={quitGame}
            className="neu-raised rounded-full px-3.5 py-1.5 text-[13px] text-black/75 hover:text-black"
          >
            Stop game
          </button>
        </div>
      )}
      {/* The game menu: the same pill as the bar's own links, hanging under
          the Play button, so it reads as part of the bar rather than a popup. */}
      {arcadeOpen && !playing && (
        <nav
          data-no-pix
          role="menu"
          aria-label="Play a game on Elio's screen"
          className="neu-sunk absolute right-3 top-[62px] z-30 flex items-center gap-1 rounded-full p-1 sm:right-6 sm:top-[70px]"
          style={{ animation: reduced ? undefined : "v3rise 220ms cubic-bezier(.16,1,.3,1) both" }}
        >
          {GAMES.map((g) => (
            <button
              key={g.name}
              type="button"
              role="menuitem"
              onClick={() => play(g.name)}
              className="flex h-[30px] items-center rounded-full px-[15px] text-[15px] tracking-[-0.01em] transition-colors hover:bg-white/10"
            >
              {g.title}
            </button>
          ))}
        </nav>
      )}

      {/* What Elio says when poked, in a bubble over its head. */}
      {quip && (
        <div
          key={quip.id}
          aria-live="polite"
          className="neu-card pointer-events-none absolute z-30 max-w-[300px] -translate-x-1/2 -translate-y-full rounded-[18px] rounded-bl-[6px] px-4 py-2 text-[14.5px] leading-snug text-[#1d2026]"
          style={{ left: quip.x, top: quip.y, animation: reduced ? undefined : "v3rise 320ms cubic-bezier(.16,1,.3,1) both" }}
        >
          {quip.text}
        </div>
      )}

      {/* How Elio works, and what the site records. */}
      <nav className="absolute bottom-2 right-3 z-20 flex gap-3 text-[11px] text-black/40 max-lg:hidden">
        <a href="/about" className="transition-colors hover:text-black">About</a>
        <a href="/lab" className="transition-colors hover:text-black">How Elio works</a>
        <a href="/privacy" className="transition-colors hover:text-black">Privacy</a>
      </nav>

      {door && !doorGone && (
        <Loader progress={loaded.pct} ready={loaded.done} onEnter={enter} reduced={reduced} theme={loaderTheme} />
      )}

      {/* The résumé, before it is handed over.
          A download is a decision made blind: you get a file and find out
          afterwards whether it was worth the click. Showing the document
          first costs nothing, since the PDF is already on the same origin,
          and the button underneath still does the plain thing. */}



      <style jsx global>{`
        @keyframes v3blink {
          0%,
          50% { opacity: 1; }
          50.01%,
          100% { opacity: 0; }
        }
        @keyframes v3rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes v3bar {
          0%, 100% { height: 5px; }
          50% { height: 15px; }
        }
        @keyframes v3fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes v3breathe {
          0%,
          100% {
            transform: scale(1) translate3d(0, 0, 0);
            opacity: 1;
          }
          50% {
            transform: scale(1.06) translate3d(0, -1.2%, 0);
            opacity: 0.86;
          }
        }
        @keyframes v3pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </main>
  );
}
