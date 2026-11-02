"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, RoundedBox, useAnimations, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";

import type { Game } from "@/components/v3/arcade";
import { Face, type Mood, type Panel } from "@/components/v3/face";
import { ENV_URL, MODEL_URL, useModelPresent } from "@/components/v3/model";
import { SCOUT_URL, ScoutCharacter } from "@/components/v3/scout";

/**
 * Which character stands in the scene.
 *
 * The TV-head avatar is kept, rigged and working, behind this switch, so going
 * back to it is one word rather than a revert.
 */
const CHARACTER = "scout" as "scout" | "tv";
const CHARACTER_URL = CHARACTER === "scout" ? SCOUT_URL : MODEL_URL;

/**
 * Signals the page writes and the scene reads, every frame.
 *
 * A plain mutable object rather than React state: the pointer moves at screen
 * refresh rate and re-rendering a component tree that often would cost far
 * more than the scene itself.
 */
export type Signals = {
  /** Pointer in -1..1, origin at the centre of the window. */
  px: number;
  py: number;
  /** Raised while the assistant is typing. */
  talking: number;
  /** Raised while a choice is hovered — the eyes open wider. */
  attention: number;
  /** Pulsed on click, decays on its own: a quick "thinking" narrow. */
  squint: number;
  /** Set from the media query: stills the sway and the cursor tracking. */
  reduced: boolean;
  /**
   * What the screen is showing. null means the eyes. The scene eases its own
   * way in and out of this, so a change here wipes rather than cuts.
   */
  panel: Panel | null;
  /** The expression. */
  mood: Mood;
  /** 0 off, 1 on. Raised once, at the start, so the set warms up. */
  power: number;
  /**
   * Where the head is on screen, in CSS pixels, and how big.
   *
   * The canvas has pointer events switched off so the links underneath it
   * stay clickable, which also means nothing in the scene can be clicked. So
   * the scene publishes where the head is instead, and the page decides
   * whether a click landed on it. No raycaster, and no fighting the links.
   */
  headX: number;
  headY: number;
  headR: number;
  /** A game playing on the screen, which then shows nothing else. */
  game: Game | null;
  /** Raised while the visitor is typing to it: it watches the box. */
  typing: number;
  /** The pointer is over the head: it looks pleased to be noticed. */
  hover: boolean;
  /**
   * Counts spoken lines as they start. A change plays one small gesture for
   * the mood of the line (a nod, a tilt, a shake), on top of the idle sway.
   */
  beat: number;
  /** The visitor is holding the mic: it leans in and listens. */
  listening: boolean;
};

export function makeSignals(): Signals {
  return {
    px: 0,
    py: 0,
    talking: 0,
    attention: 0,
    squint: 0,
    reduced: false,
    panel: null,
    mood: "neutral",
    power: 0,
    headX: 0,
    headY: 0,
    headR: 0,
    game: null,
    typing: 0,
    hover: false,
    beat: 0,
    listening: false,
  };
}

const CAM_Z = 7.4;

/** How quickly the screen changes over, per second. */
const PANEL_RATE = 7;

type ScreenRef = { panel: Panel | null; amount: number };

/**
 * Eases the screen between the eyes and a project readout.
 *
 * The panel being shown is held until the wipe has finished leaving, so
 * swapping projects crosses through the eyes rather than snapping.
 */
function screen(ref: React.RefObject<ScreenRef>, want: Panel | null, d: number): ScreenRef {
  const r = ref.current;
  if (want && want !== r.panel) {
    // Another project arrived: let this one leave first, then take over.
    if (r.panel && r.amount > 0.02) r.amount = Math.max(0, r.amount - d * PANEL_RATE * 1.6);
    else {
      r.panel = want;
      r.amount += (1 - r.amount) * (1 - Math.exp(-PANEL_RATE * d));
    }
  } else if (want) {
    r.amount += (1 - r.amount) * (1 - Math.exp(-PANEL_RATE * d));
  } else {
    r.amount = Math.max(0, r.amount - d * PANEL_RATE * 0.9);
    if (r.amount < 0.02) r.panel = null;
  }
  return r;
}

/* ── Studio environment, generated rather than fetched ─────────────────── */

function makeEnvTexture(): THREE.Texture {
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#c9ced6");
  base.addColorStop(0.45, "#8f959d");
  base.addColorStop(0.52, "#4a4f55");
  base.addColorStop(1, "#15171a");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // Soft banks, feathered to nothing so no edge can reflect as an edge.
  const pool = (x: number, y: number, r: number, a: number) => {
    const grad = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  };
  pool(0.2, 0.22, 0.2, 0.95);
  pool(0.62, 0.14, 0.15, 0.8);
  pool(0.86, 0.3, 0.14, 0.6);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Radial falloff used for the screen's halo — stands in for a bloom pass. */
function makeGlowTexture(): THREE.Texture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, "rgba(150,255,215,0.55)");
  grad.addColorStop(0.4, "rgba(90,220,180,0.18)");
  grad.addColorStop(1, "rgba(60,200,160,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── The character ────────────────────────────────────────────────────── */

const SHELL = "#dfe2e4";
const SHELL_DARK = "#2b2f33";
const ACCENT = "#1f7a5e";


function PrimitiveCharacter({ signals }: { signals: React.RefObject<Signals> }) {
  const panel = useRef<ScreenRef>({ panel: null, amount: 0 });
  /** When the first frame ran, so the warm-up is measured in seconds. */
  const warmFrom = useRef(-1);
  const warm = useRef(0);
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const { size } = useThree();

  const face = useMemo(() => new Face(), []);
  const glow = useMemo(() => makeGlowTexture(), []);
  useEffect(() => () => { face.dispose(); glow.dispose(); }, [face, glow]);

  // Eased pointer. The lag is what makes it read as a head turning to look
  // rather than a value being assigned to a rotation.
  const eased = useRef({ x: 0, y: 0 });
  const blink = useRef(0);
  const nextBlink = useRef(1.5);
  const talk = useRef(0);
  const attn = useRef(0);
  const squint = useRef(0);

  useFrame((state, delta) => {
    const s = signals.current;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05);
    if (!s || !head.current || !body.current || !root.current) return;

    // Reduced motion: hold the head still and face front.
    const tx = s.reduced ? 0 : s.px;
    const ty = s.reduced ? 0 : s.py;
    const k = 1 - Math.exp(-HEAD_RATE * Math.min(d, 0.05));
    eased.current.x += (tx - eased.current.x) * k;
    eased.current.y += (ty - eased.current.y) * k;
    const mx = eased.current.x;
    const my = eased.current.y;

    // Head turns a lot, body a little. That ratio is the whole trick.
    head.current.rotation.y = mx * 0.5;
    head.current.rotation.x = my * 0.25;
    head.current.rotation.z = -mx * 0.06;
    body.current.rotation.y = mx * 0.15;
    body.current.rotation.x = my * 0.05;

    // Breathing.
    const sway = s.reduced ? 0 : 1;
    const breath = Math.sin(t * 0.9) * 0.5 + 0.5;
    root.current.position.y = -0.9 + breath * 0.035 * sway;
    root.current.rotation.z = Math.sin(t * 0.37) * 0.012 * sway;

    // Blink: shut fast, open a touch slower, at an irregular cadence.
    nextBlink.current -= d;
    if (nextBlink.current <= 0) {
      blink.current = 1;
      nextBlink.current = 2.2 + Math.random() * 4.5;
    }
    blink.current = Math.max(0, blink.current - d * 7.5);
    const blinkAmt = Math.sin(Math.min(1, blink.current) * Math.PI);

    talk.current += (s.talking - talk.current) * 0.12;
    attn.current += (s.attention - attn.current) * 0.1;
    squint.current += (s.squint - squint.current) * 0.18;
    s.squint *= 0.94; // the pulse decays by itself

    // The tube takes about a second and a half to come up, and does not go
    // back down: switching off mid-conversation would read as a fault.
    //
    // Measured against the clock rather than accumulated from deltas. Delta
    // is capped at 50ms to survive a stalled tab, and accumulating a capped
    // delta makes the warm-up frame-rate dependent — on a software renderer
    // the set was still coming up six seconds in.
    if (warmFrom.current < 0) warmFrom.current = t;
    const since = t - warmFrom.current;
    warm.current = s.reduced ? 1 : Math.max(0, Math.min(1, (since - 0.15) / 1.35));
    s.power = warm.current;
    const shown = screen(panel, s.panel, d);
    face.draw({
      lookX: mx,
      lookY: my,
      blink: blinkAmt,
      // Attention widens the eyes, so it works against the squint.
      squint: Math.max(0, squint.current - attn.current * 0.5),
      talking: talk.current,
      time: t,
      panel: shown.panel,
      panelIn: shown.amount,
      mood: s.mood,
      power: warm.current,
    });

    // Mobile: the character sits behind the text, so pull it back and in.
    const narrow = size.width < 900;
    root.current.scale.setScalar(narrow ? 0.52 : 0.68);
    root.current.position.x = narrow ? 0 : 1.0;
  });

  return (
    <group ref={root} position={[1.0, -0.9, 0]} scale={0.68}>
      <group ref={body}>
        {/* Turtleneck bust */}
        <mesh position={[0, -1.5, 0]}>
          <cylinderGeometry args={[1.32, 1.52, 1.5, 48, 1, true]} />
          <meshStandardMaterial color="#1b1e21" roughness={0.92} metalness={0} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <cylinderGeometry args={[0.56, 0.62, 0.52, 40]} />
          <meshStandardMaterial color="#23272b" roughness={0.88} metalness={0} />
        </mesh>
        {/* Neck */}
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[0.3, 0.34, 0.5, 32]} />
          <meshStandardMaterial color={SHELL_DARK} roughness={0.42} metalness={0.7} />
        </mesh>

        <group ref={head} position={[0, 0.72, 0]}>
          {/* Casing */}
          <RoundedBox args={[2.5, 2.0, 2.05]} radius={0.22} smoothness={6}>
            <meshStandardMaterial color={SHELL} roughness={0.34} metalness={0.12} envMapIntensity={1.15} />
          </RoundedBox>
          {/* Recessed bezel */}
          <RoundedBox args={[2.12, 1.62, 0.12]} radius={0.1} smoothness={5} position={[0, 0.06, 1.0]}>
            <meshStandardMaterial color="#17191c" roughness={0.5} metalness={0.3} />
          </RoundedBox>
          {/* The screen itself — unlit, so it reads as emitting rather than lit */}
          <mesh position={[0, 0.06, 1.075]}>
            <planeGeometry args={[1.86, 1.38]} />
            <meshBasicMaterial map={face.texture} toneMapped={false} />
          </mesh>
          {/* Halo, standing in for a bloom pass */}
          <mesh position={[0, 0.06, 1.1]}>
            <planeGeometry args={[3.4, 2.8]} />
            <meshBasicMaterial
              map={glow}
              transparent
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>

          {/* Control strip under the screen */}
          {[-0.62, -0.34].map((x) => (
            <mesh key={x} position={[x, -0.76, 1.03]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.075, 0.075, 0.07, 24]} />
              <meshStandardMaterial color="#3a3f45" roughness={0.3} metalness={0.85} />
            </mesh>
          ))}
          <mesh position={[0.55, -0.76, 1.03]}>
            <boxGeometry args={[0.62, 0.07, 0.05]} />
            <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.7} roughness={0.4} />
          </mesh>

          {/* Vents on the sides */}
          {[-1, 1].map((side) =>
            [0.45, 0.2, -0.05, -0.3].map((y) => (
              <mesh key={`${side}-${y}`} position={[side * 1.27, y, 0]}>
                <boxGeometry args={[0.03, 0.06, 1.1]} />
                <meshStandardMaterial color="#9aa0a6" roughness={0.6} metalness={0.4} />
              </mesh>
            )),
          )}

          {/* Headphones: band over the top, cups on the sides */}
          <mesh position={[0, 0.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.32, 0.085, 16, 48, Math.PI]} />
            <meshStandardMaterial color={SHELL_DARK} roughness={0.35} metalness={0.6} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 1.36, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.46, 0.46, 0.26, 32]} />
              <meshStandardMaterial color="#26292d" roughness={0.75} metalness={0.2} />
            </mesh>
          ))}

          {/* Antennae */}
          {[-0.5, 0.42].map((x, i) => (
            <group key={x} position={[x, 1.0, -0.35]} rotation={[-0.3, 0, i ? 0.32 : -0.28]}>
              <mesh position={[0, 0.42, 0]}>
                <cylinderGeometry args={[0.028, 0.038, 0.95, 12]} />
                <meshStandardMaterial color="#b9bfc5" roughness={0.25} metalness={0.95} />
              </mesh>
              <mesh position={[0, 0.92, 0]}>
                <sphereGeometry args={[0.075, 20, 20]} />
                <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.55} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/* ── The downloaded model ─────────────────────────────────────────────── */

/** The node carrying the TV head — the one part that turns. */
const HEAD_NODE = "mixamorig:Head";
/** Whole-figure height in world units. */
/*
 * Framed on the head and shoulders, as the reference is, rather than the whole
 * figure. The target is the full height the model would occupy — most of it
 * falls below the frame, which is the point: the chest runs off the bottom
 * edge instead of the feet sitting inside it.
 */
const BODY_TARGET = 11.2;

/*
 * How quickly the look follows the pointer, as a rate rather than a per-frame
 * fraction.
 *
 * A fixed fraction per frame is both slow and inconsistent: 0.05 takes about a
 * second to catch up, and it catches up at different speeds depending on the
 * frame rate, so the same code feels sluggish on a slower machine. These are
 * time constants — the easing covers the same ground per second whatever the
 * frame rate.
 *
 * The eyes are quicker than the head on purpose. Eyes reach a thing first and
 * the head follows; moving both at one speed is what makes a character look
 * like it is turning to face a sound rather than looking at you.
 */
const EYE_RATE = 14;
const HEAD_RATE = 6;
/** The mesh the face is drawn onto, added by scripts/rig-avatar.py. */
const SCREEN_NAMES = ["screen", "screenface", "display"];
/** Drops the figure so the head sits high and the body leaves the frame. */
const MODEL_BASE_Y = -4.15;

/**
 * On a phone the character is scaled down and lifted.
 *
 * A portrait screen is narrow but no shorter, so the desktop framing filled
 * its width with the screen alone and cropped the set at both edges. Scaled
 * to 0.6 the whole television fits, and lifting the group keeps the head in
 * the upper half, above the conversation, rather than sinking behind it.
 */
const NARROW_SCALE = 0.6;
const NARROW_BASE_Y = -2.05;

/**
 * How far right of centre the character stands, as a fraction of the window.
 *
 * Measured against the viewport rather than set in world units so it keeps
 * the same share of the screen at any resolution or aspect ratio — the same
 * reason everything else in this scene is sized from the viewport.
 *
 * Narrow screens get much less of it: there the character sits behind the
 * conversation rather than beside it, and a quarter of a phone's width puts
 * it off the side instead of out of the way.
 */
const MODEL_OFFSET_X = 0.25;
const MODEL_OFFSET_X_NARROW = 0.06;

/**
 * The Sketchfab model, when it is present.
 *
 * Fitted rather than hard-coded: the bounding box decides the scale and the
 * centring, so swapping in a different model does not mean re-tuning numbers.
 * The screen mesh is found by name and its material replaced with the drawn
 * face, which is what lets the eyes keep tracking rather than being baked in.
 */
/*
 * The bone the look-at turns.
 *
 * Three strips reserved characters from node names rather than replacing
 * them, so a colon or a dot simply disappears — guessing an underscore is why
 * this lookup once returned nothing and the head never tracked at all. Every
 * plausible spelling is tried, and a model whose head is named something else
 * again falls through to no tracking rather than turning the whole figure.
 */
/** The bones the idle drives, by the names the rig gives them. */
const RIG = {
  chest: ["chest"],
  spine: ["spine"],
  armL: ["upper_arm.L", "upper_armL"],
  armR: ["upper_arm.R", "upper_armR"],
  foreL: ["forearm.L", "forearmL"],
  foreR: ["forearm.R", "forearmR"],
  handL: ["hand.L", "handL"],
  handR: ["hand.R", "handR"],
};

const HEAD_NAMES = [
  // Rigify names the spine chain, and its last link is the head — its only
  // children are the head tip and the face helper. Three strips reserved
  // characters from node names, so "spine.005" may arrive without its dot.
  "spine005",
  "spine.005",
  // The Sketchfab TV head names nothing helpfully — every mesh is
  // "defaultMaterial" — so its head is identified by the node above it.
  "Cylinder006",
  // The rig built by scripts/rig-avatar.py.
  "head",
  // Mixamo-named rigs, for whatever is dropped in next.
  "mixamorigHead",
  "mixamorig:Head",
  "Head",
];

function ModelCharacter({ signals }: { signals: React.RefObject<Signals> }) {
  const panel = useRef<ScreenRef>({ panel: null, amount: 0 });
  /** When the first frame ran, so the warm-up is measured in seconds. */
  const warmFrom = useRef(-1);
  const warm = useRef(0);
  const { viewport, size } = useThree();
  const headWorld = useRef(new THREE.Vector3());
  const baseY = useRef(MODEL_BASE_Y);
  /** The glass itself, which is what a visitor actually taps. */
  const glass = useRef<THREE.Mesh | null>(null);
  const scratch = useRef(new THREE.Vector3());
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);

  /*
   * Measure the model, but scale the wrapper rather than the model.
   *
   * useGLTF caches and shares the loaded scene, so writing scale and position
   * onto it mutates the cache: on a second render the thing being measured has
   * already been resized, and the fit computes from its own output.
   */
  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const dims = new THREE.Vector3();
    const mid = new THREE.Vector3();
    box.getSize(dims);
    box.getCenter(mid);
    const k = dims.y > 0 ? BODY_TARGET / dims.y : 1;
    return { scale: k, offset: new THREE.Vector3(-mid.x * k, -mid.y * k, -mid.z * k) };
  }, [scene]);

  /*
   * What the look-at turns.
   *
   * A bone can be rotated directly: the mixer rewrites it from the clip every
   * frame, so an added offset does not accumulate. A plain node cannot — its
   * transform is baked in by the exporter, and writing a rotation would throw
   * that orientation away. So a non-bone head gets a pivot inserted above it,
   * at the base of the head so it swivels on the neck rather than orbiting its
   * own middle, and `attach` moves it under without changing where it sits.
   */
  const head = useMemo(() => {
    /*
     * Matched without regard to case.
     *
     * getObjectByName is case-sensitive, and this rig names the bone "head"
     * while the list carried "Head" — so the lookup returned nothing and the
     * head simply did not track, with no error to show for it. Exporters
     * disagree about case, so the comparison should not depend on it.
     */
    const want = new Set(HEAD_NAMES.map((n) => n.toLowerCase()));
    const matches: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.name && want.has(o.name.toLowerCase())) matches.push(o);
    });
    const found = matches[0];
    if (!found) return null;
    if ((found as THREE.Bone).isBone) return found;

    const parent = found.parent;
    if (!parent) return found;
    scene.updateMatrixWorld(true);
    const hb = new THREE.Box3().setFromObject(found);
    const neck = new THREE.Vector3((hb.min.x + hb.max.x) / 2, hb.min.y, (hb.min.z + hb.max.z) / 2);
    const pivot = new THREE.Group();
    parent.add(pivot);
    parent.updateMatrixWorld(true);
    pivot.position.copy(parent.worldToLocal(neck.clone()));
    pivot.updateMatrixWorld(true);
    pivot.attach(found);
    return pivot;
  }, [scene]);

  useEffect(() => {
    /*
     * Skinned meshes get culled wrongly here: culling tests the geometry's
     * bounding sphere, but the skeleton moves the vertices after that sphere
     * was computed, so the renderer can decide the figure is off-screen and
     * draw nothing.
     */
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.frustumCulled = false;
    });
  }, [scene]);

  const clipped = animations.length > 0;

  useEffect(() => {
    if (!clipped) return;
    const first = actions[Object.keys(actions)[0]];
    first?.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.4).play();
    return () => void first?.fadeOut(0.3);
  }, [actions, clipped]);

  /*
   * The bones the idle moves.
   *
   * Looked up once. A rig that does not have them simply yields nulls and the
   * figure keeps still rather than throwing — this loader has to take whatever
   * model is dropped in, and they are not named alike.
   */
  const bones = useMemo(() => {
    const find = (names: string[]) => {
      for (const n of names) {
        const o = scene.getObjectByName(n);
        if (o) return o;
      }
      return null;
    };
    return Object.fromEntries(
      Object.entries(RIG).map(([k, names]) => [k, find(names)]),
    ) as Record<keyof typeof RIG, THREE.Object3D | null>;
  }, [scene]);

  /** Rest rotations, so each frame is set from the pose rather than added to. */
  const rest = useMemo(() => {
    const m = new Map<THREE.Object3D, THREE.Euler>();
    for (const b of Object.values(bones)) if (b) m.set(b, b.rotation.clone());
    if (head) m.set(head, head.rotation.clone());
    return m;
  }, [bones, head]);

  /*
   * The face, drawn onto the screen mesh.
   *
   * Replacing that mesh's material rather than laying a plane over the front
   * is what keeps it inside the bezel instead of stuck to it. Unlit, so the
   * eyes read as light coming out of the tube rather than a picture being lit
   * from the room.
   */
  const face = useMemo(() => new Face(), []);
  useEffect(() => () => face.dispose(), [face]);

  useEffect(() => {
    const want = new Set(SCREEN_NAMES);
    let found: THREE.Mesh | null = null;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!found && m.isMesh && m.name && want.has(m.name.toLowerCase())) found = m;
    });
    const target = found as THREE.Mesh | null;
    glass.current = target;
    if (!target) return;
    const prev = target.material;
    face.flipV();
    target.material = new THREE.MeshBasicMaterial({ map: face.texture, toneMapped: false });
    return () => {
      (target.material as THREE.Material).dispose();
      target.material = prev;
    };
  }, [scene, face]);

  const blink = useRef({ v: 0, next: 1.5 });
  const smooth = useRef({ talk: 0, attn: 0, squint: 0 });
  const eye = useRef({ x: 0, y: 0 });
  const turn = useRef({ x: 0, y: 0 });

  /*
   * No priority argument, deliberately. A priority above zero hands the render
   * loop over: react-three-fiber stops drawing and waits for a gl.render that
   * never comes, silently. Ordering comes from declaration instead — within
   * one priority, callbacks run in registration order, and useAnimations
   * registers its mixer update above this.
   */
  useFrame((state, delta) => {
    const s = signals.current;
    if (!s || !group.current) return;
    const t = state.clock.elapsedTime;

    const tx = s.reduced ? 0 : s.px;
    const ty = s.reduced ? 0 : s.py;
    const d = Math.min(delta, 0.05);
    const toward = (cur: { x: number; y: number }, rate: number) => {
      const k = 1 - Math.exp(-rate * d);
      cur.x += (tx - cur.x) * k;
      cur.y += (ty - cur.y) * k;
    };
    toward(eye.current, EYE_RATE);
    toward(turn.current, HEAD_RATE);

    // Set every frame rather than once, so a resize carries it along.
    const narrow = size.width < 900;
    group.current.position.x = viewport.width * (narrow ? MODEL_OFFSET_X_NARROW : MODEL_OFFSET_X);
    group.current.scale.setScalar(narrow ? NARROW_SCALE : 1);
    baseY.current = narrow ? NARROW_BASE_Y : MODEL_BASE_Y;
    if (clipped || s.reduced) group.current.position.y = baseY.current;
    blink.current.next -= d;
    if (blink.current.next <= 0) {
      blink.current.v = 1;
      blink.current.next = 2.2 + Math.random() * 4.5;
    }
    blink.current.v = Math.max(0, blink.current.v - d * 7.5);
    smooth.current.talk += (s.talking - smooth.current.talk) * 0.12;
    smooth.current.attn += (s.attention - smooth.current.attn) * 0.1;
    smooth.current.squint += (s.squint - smooth.current.squint) * 0.18;
    s.squint *= 0.94;

    // The tube takes about a second and a half to come up, and does not go
    // back down: switching off mid-conversation would read as a fault.
    //
    // Measured against the clock rather than accumulated from deltas. Delta
    // is capped at 50ms to survive a stalled tab, and accumulating a capped
    // delta makes the warm-up frame-rate dependent — on a software renderer
    // the set was still coming up six seconds in.
    if (warmFrom.current < 0) warmFrom.current = t;
    const since = t - warmFrom.current;
    warm.current = s.reduced ? 1 : Math.max(0, Math.min(1, (since - 0.15) / 1.35));
    s.power = warm.current;
    // Where the television is, for the page's hit test.
    const screenMesh = glass.current;
    if (screenMesh) {
      if (!screenMesh.geometry.boundingSphere) screenMesh.geometry.computeBoundingSphere();
      const sphere = screenMesh.geometry.boundingSphere;
      if (sphere) {
        headWorld.current.copy(sphere.center).applyMatrix4(screenMesh.matrixWorld);
        const centre = headWorld.current.clone().project(state.camera);
        s.headX = ((centre.x + 1) / 2) * size.width;
        s.headY = ((1 - centre.y) / 2) * size.height;
        // The sphere's radius, carried into screen space along the camera's
        // right, so the hit area tracks the set as it is scaled and framed.
        const edge = headWorld.current
          .clone()
          .add(
            new THREE.Vector3()
              .setFromMatrixColumn(state.camera.matrixWorld, 0)
              .multiplyScalar(sphere.radius * screenMesh.getWorldScale(scratch.current).x),
          )
          .project(state.camera);
        s.headR = Math.abs(((edge.x + 1) / 2) * size.width - s.headX);
      }
    }

    const shown = screen(panel, s.panel, d);
    face.draw({
      lookX: eye.current.x,
      lookY: eye.current.y,
      blink: s.reduced ? 0 : Math.sin(Math.min(1, blink.current.v) * Math.PI),
      squint: Math.max(0, smooth.current.squint - smooth.current.attn * 0.5),
      talking: smooth.current.talk,
      time: t,
      panel: shown.panel,
      panelIn: shown.amount,
      mood: s.mood,
      power: warm.current,
    });

    if (head) {
      if (clipped) {
        // The clip rewrites the bone each frame, so this adds to it.
        head.rotation.y += turn.current.x * 0.45;
        head.rotation.x += turn.current.y * 0.22;
      } else {
        /*
         * Nothing else writes this one, so it is set rather than added —
         * adding would wind the head further every frame. Set from the rest
         * rotation, not from zero: a bone carries its own orientation, and
         * assigning raw values would throw that away and leave the head
         * facing somewhere other than forward.
         */
        const r = rest.get(head);
        const bx = r?.x ?? 0;
        const by = r?.y ?? 0;
        const bz = r?.z ?? 0;
        head.rotation.set(bx + turn.current.y * 0.22, by + turn.current.x * 0.45, bz);
      }
    }

    /*
     * The idle, driven through the bones.
     *
     * Every term is set from the bone's rest rotation rather than added to it,
     * because nothing else writes these bones — adding would wind them a
     * little further every frame until the arms had rotated through the body.
     *
     * The periods are deliberately unrelated: arms at 0.55 and 0.48, forearms
     * a touch faster, breathing at 0.9. Shared periods make the whole figure
     * pulse together, which reads as a machine rather than a person standing.
     */
    if (!clipped) {
      const sway = s.reduced ? 0 : 1;
      const set = (b: THREE.Object3D | null, x: number, y: number, z: number) => {
        if (!b) return;
        const r = rest.get(b);
        if (!r) return;
        b.rotation.set(r.x + x * sway, r.y + y * sway, r.z + z * sway);
      };

      const breath = Math.sin(t * 0.9);
      set(bones.chest, breath * 0.022, 0, Math.sin(t * 0.31) * 0.02);
      set(bones.spine, breath * 0.012, Math.sin(t * 0.23) * 0.03, Math.sin(t * 0.37) * 0.018);

      // The arms swing out of phase with each other, as they do at rest.
      set(bones.armL, Math.sin(t * 0.55) * 0.05, 0, Math.sin(t * 0.41) * 0.045 + 0.02);
      set(bones.armR, Math.sin(t * 0.48 + 1.7) * 0.05, 0, -Math.sin(t * 0.37 + 0.9) * 0.045 - 0.02);
      set(bones.foreL, Math.sin(t * 0.62 + 0.4) * 0.05, 0, 0);
      set(bones.foreR, Math.sin(t * 0.58 + 2.2) * 0.05, 0, 0);
      set(bones.handL, Math.sin(t * 0.77) * 0.06, Math.sin(t * 0.5) * 0.04, 0);
      set(bones.handR, Math.sin(t * 0.71 + 1.3) * 0.06, Math.sin(t * 0.46 + 2) * 0.04, 0);

      group.current.position.y = baseY.current + (breath * 0.5 + 0.5) * 0.03 * sway;
    }
  });

  return (
    <group ref={group} position={[0, MODEL_BASE_Y, 0]}>
      <group scale={scale} position={offset}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

/* ── Guards ───────────────────────────────────────────────────────────── */

function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Reports how much of the scene has arrived.
 *
 * The canvas is created long before anything worth showing is in it: the
 * model is several megabytes and the lighting probe another one and a half.
 * This reads the loader everything in the scene goes through and passes the
 * figure up, so the page can hold a loading screen over the gap instead of
 * letting a visitor watch a television materialise out of nothing.
 */
function Progress({ onProgress }: { onProgress?: (percent: number, done: boolean) => void }) {
  const { progress, active, total } = useProgress();
  useEffect(() => {
    onProgress?.(progress, total > 0 && !active && progress >= 100);
  }, [progress, active, total, onProgress]);
  return null;
}

function Done({ onProgress }: { onProgress?: (percent: number, done: boolean) => void }) {
  useEffect(() => onProgress?.(100, true), [onProgress]);
  return null;
}

/**
 * Another character for the same page: where its model lives, how bright the
 * renderer should be for it, and the component that draws it. Lets a variant
 * of the site swap the figure without forking the scene.
 */
export type CharacterSlot = {
  url: string;
  exposure?: number;
  /** Tone mapping for this character; ACES when unset. */
  toneMapping?: THREE.ToneMapping;
  /** The character brings its own lights and environment. */
  ownLighting?: boolean;
  /** Replaces the page's room (painting, light pools, glow) behind the scene. */
  backdrop?: React.ReactNode;
  /** False to leave out the page's film grain over the room. */
  grain?: boolean;
  render: (props: { signals: React.RefObject<Signals>; awake: boolean }) => React.ReactNode;
};

export function Scene({
  signals,
  onReady,
  onProgress,
  paused = false,
  slot,
}: {
  /** A different character to stand in the scene instead of the default. */
  slot?: CharacterSlot;
  signals: React.RefObject<Signals>;
  onReady?: () => void;
  onProgress?: (percent: number, done: boolean) => void;
  /**
   * While the loading screen covers the scene, render only on demand. Drawing
   * a full 3D scene sixty times a second behind an opaque page costs the
   * loader the very frames it needs to animate, on exactly the devices that
   * have fewest to spare. Loading is unaffected: it does not need frames.
   */
  paused?: boolean;
}) {
  const envMap = useMemo(() => (typeof window === "undefined" ? null : makeEnvTexture()), []);
  // A slot's model ships with the site, so it is not worth a round trip to
  // ask whether it exists before the canvas can start.
  const present = useModelPresent(slot ? null : CHARACTER_URL);
  // Nothing to load without WebGL, so say so at once rather than leaving the
  // loading screen waiting on a canvas that will never exist.
  if (!hasWebGL()) return <Done onProgress={onProgress} />;
  // Wait for the answer rather than mounting the fallback and swapping: a
  // visible switch from one character to another reads as a glitch.
  if (present === null) return null;
  const hasModel = present;

  return (
    <>
    <Progress onProgress={onProgress} />
    <Canvas
      dpr={[1, 2]}
      frameloop={paused ? "demand" : "always"}
      camera={{ position: [0, 0, CAM_Z], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: "none" }}
      onCreated={({ gl }) => {
        gl.toneMapping = slot?.toneMapping ?? THREE.ACESFilmicToneMapping;
        // Lifted against the probe: Ferndale is a dim studio, and at the stock
        // exposure the dark trousers went to a flat black and the figure sat
        // heavier than the pale background behind it.
        // The robot is flat toon colour, and the lift the old avatar needed
        // (a dim probe, dark trousers) bleached its cream body almost white.
        gl.toneMappingExposure = slot?.exposure ?? (CHARACTER === "scout" ? 1.0 : 1.45);
        onReady?.();
      }}
    >
      {/* The probe does most of the lighting; these only lift the shadow side
          so the figure does not go flat against a pale background. */}
      {/* Neutral fill, which also tempers the probe's blue cast on the casing
          and the lavender it throws onto the neck. */}
      {!slot?.ownLighting && (
        <>
          <ambientLight intensity={0.5} />
          <directionalLight position={[4, 5, 6]} intensity={0.8} />
          <directionalLight position={[-5, 1, 2]} intensity={0.3} color="#ffffff" />
        </>
      )}
      <Suspense fallback={null}>
        {!hasModel ? (
          <PrimitiveCharacter signals={signals} />
        ) : slot ? (
          slot.render({ signals, awake: !paused })
        ) : CHARACTER === "scout" ? (
          <ScoutCharacter signals={signals} awake={!paused} />
        ) : (
          <ModelCharacter signals={signals} />
        )}
        {/* Falls back to the generated gradient if the probe cannot be read,
            so a missing or broken file leaves the scene lit rather than black. */}
        {!slot?.ownLighting && (
          <Suspense fallback={envMap ? <Environment map={envMap} /> : null}>
            <Environment files={ENV_URL} environmentIntensity={0.78} />
          </Suspense>
        )}
      </Suspense>
    </Canvas>
    </>
  );
}
