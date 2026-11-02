"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { Face, type Mood, type Panel } from "@/components/v3/face";
import type { Signals } from "@/components/v3/character";

export const SCOUT_URL = "/models/scout.glb";

/**
 * Which of the robot's own animations plays for each of Elio's moods.
 *
 * The robot arrives with its expressions already built: six clips, each
 * moving the body and swapping the pixel face together. So a mood here picks
 * a clip rather than drawing eyes, and the canvas face is only used for the
 * thing the clips cannot do, which is putting a project on the screen.
 */
const CLIP_FOR: Record<Mood, string> = {
  neutral: "Idle",
  thinking: "Idle",
  sleepy: "Idle",
  blank: "Idle",
  // The lively clips hop and spin, and Elio is happy most of the time, so
  // the everyday moods keep to Idle; the screen stays readable.
  happy: "Idle",
  wink: "Idle",
  surprised: "Idle",
  dizzy: "Dizzy",
  angry: "Angry",
  shy: "Idle",
  love: "Idle",
  laugh: "Idle",
  excited: "Idle",
  cool: "Idle",
  confused: "Idle",
  sad: "Idle",
  listening: "Idle",
};

/**
 * The lively clips, played once as a mood arrives rather than looped: a hop
 * of joy when it laughs or is thanked, a spin when something impresses it.
 * Then it settles back into Idle so the screen stays readable.
 */
const ONCE_FOR: Partial<Record<Mood, string>> = {
  laugh: "Happy",
  love: "Happy",
  excited: "Excited",
};

/**
 * The bones that carry the screen: while a game is played their motion is
 * left out of the idle clip, so the board holds still while the antennas,
 * fans, jet flames and arms stay alive around it.
 */
const CARRIERS = new Set(["root", "body", "hover", "head", "face"]);

/** Crossfade between clips, in seconds. Short enough to read as a reaction. */
const FADE = 0.32;

/**
 * The resting angle on a desk: turned a third of the way toward the
 * conversation, so the screen faces the reader and the side with the speaker
 * shows, which is the view the character reads best from.
 */
const REST_TURN = 0.36;

/** How quickly the body turns toward the pointer, per second. */
const TURN_RATE = 5;

/** How quickly the screen changes over between face and card, per second. */
const PANEL_RATE = 7;

/*
 * Framing. The model stands 2.76 units tall, from 0.05 to 2.81.
 * On a desk it fills most of the height to the right of the conversation; on
 * a phone it is smaller and lifted, so it sits above the conversation rather
 * than behind it.
 */
const MID_Y = 1.43;
const DESK = { scale: 1.2, centreY: -0.12, offsetX: 0.25 };
const PHONE = { scale: 0.74, centreY: 0.9, offsetX: 0 };

/** The screen's width on the page, as a share of the window's height, at scale 1. */
const SCREEN_PER_SCALE = 0.194;

export function ScoutCharacter({
  signals,
  awake,
}: {
  signals: React.RefObject<Signals>;
  /** False while the loading screen covers the scene. */
  awake: boolean;
}) {
  const { scene, animations } = useGLTF(SCOUT_URL);
  const rig = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  // Idle without the body's own motion, for games.
  const clips = useMemo(() => {
    const idle = animations.find((a) => a.name === "Idle");
    if (!idle) return animations;
    const still = idle.clone();
    still.name = "GameIdle";
    still.tracks = still.tracks.filter((t) => !CARRIERS.has(t.name.split(".")[0]));
    return [...animations, still];
  }, [animations]);
  const { actions } = useAnimations(clips, rig);
  const { viewport, size } = useThree();
  // The screen's texture coordinates come from Blender, which glTF stores
  // with v running top to bottom, so the canvas needs the same flip as the
  // TV avatar's glass.
  const face = useMemo(() => {
    const f = new Face();
    f.flipV();
    return f;
  }, []);

  const playing = useRef("");
  const lockUntil = useRef(0);
  const turn = useRef({ x: 0, y: 0 });
  const shy = useRef(0);
  const bounds = useRef(new THREE.Box3());
  const probe = useRef(new THREE.Vector3());
  const wander = useRef<{ x: number | null; y: number; vx: number; vy: number; tx: number; ty: number; next: number }>({
    x: null,
    y: 0,
    vx: 0,
    vy: 0,
    tx: 0,
    ty: 0,
    next: 6,
  });
  const card = useRef<{ panel: Panel | null; amount: number }>({ panel: null, amount: 0 });
  const lastMood = useRef<Mood>("neutral");
  // Where the eyes are looking, and the idle glances when the pointer rests.
  const look = useRef({ x: 0, y: 0, tx: 0, ty: 0, next: 0, px: 0, py: 0, still: 0 });
  // The game close-up: how far into it (0..1), the scale and the spot it
  // settles on, found by measuring where the screen actually lands.
  const close = useRef({ t: 0, scale: 0, x: 0, y: 0 });
  const centre = useRef(new THREE.Vector3());

  // The parts that matter: the screen panel the card is drawn on, and the
  // pixel face that has to step aside while it is.
  const parts = useMemo(() => {
    let screen: THREE.Mesh | null = null;
    // Everything drawn over the display: the pixel face, and the diagonal
    // sheen (Scout_screen2), which the first attempt mistook for the display
    // and so filled only half the glass.
    const pixels: THREE.Object3D[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Skinned meshes are culled against their bind pose, which floats the
      // wrong way once a clip lifts the body: skip the test entirely.
      mesh.frustumCulled = false;
      const name = (mesh.material as THREE.Material)?.name ?? "";
      if (name === "Scout_screen") screen = mesh;
      if (name === "Scout_pixel" || name === "Scout_screen2") pixels.push(mesh);
    });
    const original = screen ? (screen as THREE.Mesh).material : null;
    const cardMaterial = new THREE.MeshBasicMaterial({ map: face.texture, toneMapped: false });
    return { screen: screen as THREE.Mesh | null, pixels, original, cardMaterial };
  }, [scene, face]);

  useEffect(
    () => () => {
      parts.cardMaterial.dispose();
      face.dispose();
    },
    [parts, face],
  );

  const play = (name: string, once = false) => {
    const next = actions[name];
    if (!next || playing.current === name) return;
    const prev = playing.current ? actions[playing.current] : null;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(prev ? FADE : 0).play();
    prev?.fadeOut(FADE);
    playing.current = name;
  };

  // Idle from the first frame. The start-up routine used to play as the
  // loading screen lifted; it read as a jolt, so Elio simply stands there.
  useEffect(() => {
    if (!actions.Idle) return;
    play("Idle");
    // play is stable in behaviour; it reads refs and the actions map.
  }, [awake, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, delta) => {
    const s = signals.current;
    const outer = body.current;
    if (!s || !outer) return;
    const d = Math.min(delta, 0.05);

    // Mood picks the clip for the body; the face itself is drawn on the screen.
    // Development only: window.__pinMood holds an expression still so it can
    // be looked at. A software renderer runs at a frame a second, slower than
    // a tap's reaction lasts, so there is no other way to inspect one there.
    const pinned =
      process.env.NODE_ENV !== "production"
        ? (window as unknown as { __pinMood?: Mood }).__pinMood
        : undefined;
    const mood = pinned ?? s.mood;
    // A lively mood arriving plays its clip once, then hands back to Idle.
    if (mood !== lastMood.current) {
      lastMood.current = mood;
      const once = ONCE_FOR[mood];
      if (once && actions[once] && !s.game && !s.reduced) {
        play(once, true);
        lockUntil.current = performance.now() + actions[once]!.getClip().duration * 1000;
      }
    }
    if (s.game) play("GameIdle");
    else if (performance.now() > lockUntil.current) play(CLIP_FOR[mood] ?? "Idle");

    // Framing, every frame so a resize carries it along.
    const narrow = size.width < 900;
    const f = narrow ? PHONE : DESK;
    // The game close-up eases in and out, so the robot glides forward to
    // play and back to the cliff afterwards.
    const cl = close.current;
    cl.t += ((s.game ? 1 : 0) - cl.t) * (1 - Math.exp(-3.2 * d));
    if (cl.t < 0.001) cl.t = 0;
    if (!cl.scale) cl.scale = f.scale;
    if (s.game) {
      // Big enough that the game reads comfortably, small enough that the
      // whole head stays in the window. At scale 1 the screen is about a
      // fifth of the window's height wide, whatever the window's shape.
      const want = narrow
        ? Math.min(size.width * 0.52, size.height * 0.25)
        : Math.min(size.height * 0.37, size.width * 0.28);
      const target = want / (SCREEN_PER_SCALE * size.height);
      cl.scale += (target - cl.scale) * (1 - Math.exp(-4 * d));
    } else cl.scale += (f.scale - cl.scale) * (1 - Math.exp(-4 * d));
    outer.scale.setScalar(f.scale + (cl.scale - f.scale) * cl.t);
    // Home: standing on the cliff. On a desk it also flies about the right
    // of the window, never into the left 40% where the conversation is, and
    // comes home and stays still while its screen is showing something.
    const homeX = viewport.width * f.offsetX;
    const homeY = f.centreY - MID_Y * f.scale;
    const t = state.clock.elapsedTime;
    const w = wander.current;
    if (w.x === null) {
      w.x = homeX;
      w.y = homeY;
    }
    const halfWidth = 1.05 * f.scale;
    const xMin = viewport.width * (0.4 - 0.5) + halfWidth + 0.15;
    const xMax = viewport.width * 0.5 - halfWidth - 0.2;
    const busy = !!s.game || s.reduced || narrow || xMin >= xMax;
    // Showing a card, or with the pointer on it: it stays put, so a tap
    // lands where the visitor aimed.
    const hold = !!card.current.panel || s.hover;
    if (busy) {
      w.tx = homeX;
      w.ty = homeY;
      w.next = t + 4;
    } else if (hold) {
      w.tx = w.x!;
      w.ty = w.y;
      w.vx *= Math.exp(-6 * d);
      w.vy *= Math.exp(-6 * d);
      w.next = Math.max(w.next, t + 3);
    } else if (t > w.next) {
      // Now and then land again; otherwise somewhere new in the open sky.
      const land = Math.random() < 0.3;
      w.tx = land ? homeX : xMin + Math.random() * (xMax - xMin);
      // Never so high that the antennas reach the bar along the top.
      const barGap = (96 / size.height) * viewport.height;
      const yMax = Math.max(homeY, Math.min(homeY + 0.9, viewport.height / 2 - barGap - 2.95 * f.scale));
      w.ty = land ? homeY : homeY + Math.random() * (yMax - homeY);
      w.next = t + 5 + Math.random() * 5;
    }
    // A soft spring toward the target: unhurried, no overshoot to speak of.
    const spring = 1.1;
    const damp = 2.1;
    w.vx += ((w.tx - w.x!) * spring - w.vx * damp) * d;
    w.vy += ((w.ty - w.y) * spring - w.vy * damp) * d;
    w.x = w.x! + w.vx * d;
    w.y += w.vy * d;
    const airborne = Math.min(1, Math.max(0, (w.y - homeY) / 0.15));
    const flyX = w.x!;
    const flyY = w.y + airborne * Math.sin(t * 1.7) * 0.05 * (1 - cl.t);
    if (cl.t === 0) {
      cl.x = flyX;
      cl.y = flyY;
    } else if (s.game && s.headR) {
      // Steer the screen to the middle of the free space: the right of the
      // conversation on a desk, the upper half on a phone.
      const wantX = narrow ? 0 : 0.4;
      const wantY = narrow ? 0.45 : -0.06;
      const atX = (s.headX / size.width) * 2 - 1;
      const atY = 1 - (s.headY / size.height) * 2;
      const k = 1 - Math.exp(-5 * d);
      cl.x += (wantX - atX) * (viewport.width / 2) * k;
      cl.y += (wantY - atY) * (viewport.height / 2) * k;
    }
    outer.position.set(flyX + (cl.x - flyX) * cl.t, flyY + (cl.y - flyY) * cl.t, 0);

    // Keep the whole robot on screen, below the top bar and out of the
    // conversation: measure where it actually is and nudge it back if any
    // part would cross. Measured rather than assumed, because the model's
    // reach changes with its animation and the window's shape.
    if (!narrow && cl.t === 0) {
      outer.updateMatrixWorld(true);
      bounds.current.setFromObject(outer);
      const bb = bounds.current;
      const project = (x: number, y: number) => probe.current.set(x, y, (bb.min.z + bb.max.z) / 2).project(state.camera);
      const topNdc = project((bb.min.x + bb.max.x) / 2, bb.max.y).y;
      const leftNdc = project(bb.min.x, (bb.min.y + bb.max.y) / 2).x;
      const rightNdc = project(bb.max.x, (bb.min.y + bb.max.y) / 2).x;
      const topLimit = 1 - (2 * 76) / size.height; // the bar along the top
      const leftLimit = -1 + 2 * 0.4; // the conversation's 40%
      const rightLimit = 1 - (2 * 16) / size.width;
      const perNdcY = viewport.height / 2;
      const perNdcX = viewport.width / 2;
      let dy = 0;
      let dx = 0;
      if (topNdc > topLimit) dy = -(topNdc - topLimit) * perNdcY;
      if (rightNdc > rightLimit) dx = -(rightNdc - rightLimit) * perNdcX;
      if (leftNdc < leftLimit) dx = (leftLimit - leftNdc) * perNdcX;
      if (dx || dy) {
        w.x = w.x! + dx;
        w.y += dy;
        if (dy < 0) {
          w.ty = Math.min(w.ty, w.y);
          w.vy = Math.min(w.vy, 0);
        }
        if (dx) {
          w.tx = w.x;
          w.vx = 0;
        }
        outer.position.x += dx;
        outer.position.y += dy;
      }
    }

    // Turn toward the pointer. The clips own the bones, so the turn goes on
    // the group around them and the two compose instead of fighting.
    const k = 1 - Math.exp(-TURN_RATE * d);
    // Face the player square on while a game is running.
    const tx = s.reduced || s.game ? 0 : s.px;
    const ty = s.reduced || s.game ? 0 : s.py;
    turn.current.x += (tx - turn.current.x) * k;
    turn.current.y += (ty - turn.current.y) * k;
    // Shy: it turns half away and dips its head, easing in and out.
    const shyNow = (pinned ?? s.mood) === "shy" && !s.game ? 1 : 0;
    shy.current += (shyNow - shy.current) * (1 - Math.exp(-3 * d));
    // Square on and dead still for a game; otherwise the usual attitude.
    const free = 1 - cl.t;
    // In a game the screen turns to look straight down the camera, wherever
    // in the window it sits, so the board is square on rather than skewed.
    const cam = state.camera.position;
    const c0 = centre.current;
    const faceY = Math.atan2(cam.x - c0.x, cam.z - c0.z);
    const faceX = -Math.atan2(cam.y - c0.y, cam.z - c0.z);
    outer.rotation.y = (turn.current.x * 0.5 - (narrow ? 0 : REST_TURN) + shy.current * 0.42) * free + faceY * cl.t;
    outer.rotation.x = (turn.current.y * 0.14 + shy.current * 0.16) * free + faceX * cl.t;
    // Bank into the direction of flight, gently.
    const bank = Math.max(-0.12, Math.min(0.12, -wander.current.vx * 0.09));
    outer.rotation.z = (bank + shy.current * 0.06 * Math.sin(state.clock.elapsedTime * 2.2)) * free;

    // The gaze. It follows the pointer relative to where the head is, watches
    // the box while the visitor types, and glances about when left alone.
    const lk = look.current;
    if (Math.abs(s.px - lk.px) + Math.abs(s.py - lk.py) > 0.002) {
      lk.px = s.px;
      lk.py = s.py;
      lk.still = t;
    }
    if (s.typing) {
      lk.tx = narrow ? 0 : -1;
      lk.ty = narrow ? 1 : 0.6;
    } else if (t - lk.still < 4 && s.headR) {
      const pxX = ((s.px + 1) / 2) * size.width;
      const pxY = ((s.py + 1) / 2) * size.height;
      lk.tx = (pxX - s.headX) / (size.width * 0.3);
      lk.ty = (pxY - s.headY) / (size.height * 0.35);
    } else if (t > lk.next) {
      const centre = Math.random() < 0.4;
      lk.tx = centre ? 0 : Math.random() * 2 - 1;
      lk.ty = centre ? 0 : Math.random() * 1.4 - 0.7;
      lk.next = t + 1.2 + Math.random() * 2.6;
    }
    const lr = 1 - Math.exp(-9 * d);
    lk.x += (lk.tx - lk.x) * lr;
    lk.y += (lk.ty - lk.y) * lr;

    // The card, wiped onto the screen and back off it.
    const c = card.current;
    const want = s.panel;
    if (want && want !== c.panel) {
      if (c.panel && c.amount > 0.02) c.amount = Math.max(0, c.amount - d * PANEL_RATE * 1.6);
      else {
        c.panel = want;
        c.amount += (1 - c.amount) * (1 - Math.exp(-PANEL_RATE * d));
      }
    } else if (want) {
      c.amount += (1 - c.amount) * (1 - Math.exp(-PANEL_RATE * d));
    } else {
      c.amount = Math.max(0, c.amount - d * PANEL_RATE * 0.9);
      if (c.amount < 0.02) c.panel = null;
    }

    const showing = (!!c.panel && c.amount > 0.02) || !!s.game;
    // With a card on the screen, slow right down so it can be read.
    // During a game it holds perfectly still.
    const clip = actions[playing.current];
    const pace = s.game ? 1 : showing ? 0.3 : 1;
    if (clip) clip.timeScale += (pace - clip.timeScale) * (1 - Math.exp(-4 * d));
    if (parts.screen) {
      // The screen is always the canvas now: its own pixel faces, a card, or
      // a game. The model's built-in face meshes stay hidden.
      parts.screen.material = parts.cardMaterial;
      for (const px of parts.pixels) px.visible = false;
      if (s.game) {
        s.game.update(d);
        face.drawGame(s.game, state.clock.elapsedTime);
      } else if (!showing) {
        // Noticed: a pleased face when the pointer is on it, an attentive one
        // while the visitor types, unless the mood says otherwise.
        const shown =
          pinned ?? (mood === "neutral" ? (s.hover ? "happy" : s.typing ? "listening" : mood) : mood);
        face.drawPixelFace(shown, state.clock.elapsedTime, s.talking, lk.x, lk.y);
      } else {
        face.draw({
          lookX: 0,
          lookY: 0,
          blink: 0,
          squint: 0,
          talking: s.talking,
          time: state.clock.elapsedTime,
          mood: "blank",
          panel: c.panel,
          panelIn: c.amount,
          power: 1,
        });
      }

      // Where the screen is, for the page's tap test. computeBoundingSphere
      // on a skinned mesh accounts for the current pose, so the target
      // follows the robot as a clip moves it.
      const skinned = parts.screen as THREE.SkinnedMesh;
      skinned.computeBoundingSphere();
      const sphere = skinned.boundingSphere;
      if (sphere) {
        centre.current.copy(sphere.center).applyMatrix4(parts.screen.matrixWorld);
        const ndc = centre.current.clone().project(state.camera);
        s.headX = ((ndc.x + 1) / 2) * size.width;
        s.headY = ((1 - ndc.y) / 2) * size.height;
        const edge = centre.current
          .clone()
          .add(
            new THREE.Vector3()
              .setFromMatrixColumn(state.camera.matrixWorld, 0)
              .multiplyScalar(sphere.radius * outer.scale.x * 1.7),
          )
          .project(state.camera);
        // A little larger than the panel, so a tap on the casing counts too.
        s.headR = Math.abs(((edge.x + 1) / 2) * size.width - s.headX);
      }
    }
    s.power = 1;
  });

  return (
    <group ref={body}>
      <group ref={rig}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

