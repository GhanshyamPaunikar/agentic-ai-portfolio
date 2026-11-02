"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import type { Signals } from "@/components/v3/character";

/**
 * The sky behind Elio: clouds, mountains, the cliff with the table and the gp
 * laptop, bushes and an overhanging branch, each at its real depth so a
 * small camera move gives true parallax.
 *
 * Built in Blender by public/models/Parallax Background/build_parallax.py.
 * Every material is unlit with its toon shading baked into vertex colours, so
 * the scene needs no lights and looks the same here as in Blender. Two clips
 * loop together: Wind (branch, bushes, grass) and Drift (the clouds).
 */
export const PARALLAX_URL = "/models/parallax.glb";

/** Draco decoder, hosted with the site rather than fetched from a CDN. */
const DRACO = "/draco/";

/*
 * The camera as authored in Blender: 20 units back and 2 up, pitched 8° up,
 * a 35mm lens on a 36mm sensor, framed for the 2752×1536 reference. Blender
 * is Z-up and three is Y-up, so (0, -20, 2) there is (0, 2, 20) here.
 */
const CAM_POS = new THREE.Vector3(0, 2, 20);
const CAM_PITCH = THREE.MathUtils.degToRad(8);
const ASPECT = 2752 / 1536;
const TAN_HALF_W = 18 / 35;
const TAN_HALF_H = TAN_HALF_W / ASPECT;

/**
 * On windows narrower than the painting, the sides are cropped. The cliff,
 * the table and Elio all live on the right, so the crop leans that way rather
 * than keeping the middle.
 */
const NARROW_BIAS = 0.8;

/** How far the camera slides with the pointer, in scene units. */
const DRIFT_X = 0.5;
const DRIFT_Y = 0.22;
/** How quickly the camera catches up with the pointer, per second. */
const FOLLOW = 2.2;

function Backdrop({ signals }: { signals: React.RefObject<Signals> }) {
  const { scene, animations } = useGLTF(PARALLAX_URL, DRACO);
  const root = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, root);
  const { camera, size } = useThree();
  const eased = useRef({ x: 0, y: 0 });

  // Skinned meshes are culled against their bind pose, which the clips move
  // away from: skip the test, the whole scene is always in view anyway.
  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
    });
  }, [scene]);

  useEffect(() => {
    const reduced = signals.current?.reduced;
    for (const name of ["Wind", "Drift"]) {
      const a = actions[name];
      if (!a) continue;
      a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      // Reduced motion keeps the picture and drops the movement.
      a.paused = !!reduced;
    }
  }, [actions, signals]);

  useFrame((_, delta) => {
    const s = signals.current;
    const cam = camera as THREE.PerspectiveCamera;

    // Cover the window: fit the width on wide screens, the height on narrow
    // ones, and on narrow ones keep the right-hand side in frame.
    const w = size.width;
    const h = size.height;
    const aspect = w / Math.max(h, 1);
    if (aspect >= ASPECT) {
      cam.clearViewOffset();
      cam.aspect = aspect;
      cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(TAN_HALF_W / aspect));
    } else {
      const fullW = h * ASPECT;
      cam.aspect = ASPECT;
      cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(TAN_HALF_H));
      cam.setViewOffset(fullW, h, (fullW - w) * NARROW_BIAS, 0, w, h);
    }

    // Parallax: slide, never turn, so near things move and the sky stays put.
    const k = 1 - Math.exp(-FOLLOW * Math.min(delta, 0.05));
    const tx = s && !s.reduced ? s.px : 0;
    const ty = s && !s.reduced ? s.py : 0;
    eased.current.x += (tx - eased.current.x) * k;
    eased.current.y += (ty - eased.current.y) * k;
    cam.rotation.set(CAM_PITCH, 0, 0);
    cam.position.set(
      CAM_POS.x + eased.current.x * DRIFT_X,
      CAM_POS.y - eased.current.y * DRIFT_Y * Math.cos(CAM_PITCH),
      CAM_POS.z - eased.current.y * DRIFT_Y * Math.sin(CAM_PITCH),
    );
    cam.updateProjectionMatrix();
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
    </group>
  );
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function ParallaxBackground({
  signals,
  paused = false,
  onReady,
}: {
  signals: React.RefObject<Signals>;
  /** While the loading screen covers the page, draw only on demand. */
  paused?: boolean;
  /** Called once the scene has loaded and drawn. */
  onReady?: () => void;
}) {
  const webgl = useMemo(() => (typeof window === "undefined" ? false : hasWebGL()), []);
  if (!webgl) return null;
  return (
    <Canvas
      // Vertex colours are the final colours: no tone mapping on top of them.
      flat
      dpr={[1, 1.5]}
      frameloop={paused ? "demand" : "always"}
      camera={{ position: CAM_POS.toArray(), fov: 32, near: 0.5, far: 2000 }}
      gl={{ antialias: true, alpha: false }}
      style={{ pointerEvents: "none" }}
      onCreated={({ gl }) => gl.setClearColor("#6aa8e6")}
    >
      <Suspense fallback={null}>
        <Backdrop signals={signals} />
        <Ready onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

/** Mounted inside the Suspense boundary, so it only runs once the model is in. */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

useGLTF.preload(PARALLAX_URL, DRACO);
