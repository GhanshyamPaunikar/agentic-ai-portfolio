"use client";

/** Ghanshyam: the homepage CRT character.
 * Original model provenance: Locomotive L.I.S.A. (lisa.locomotive.ca).
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import type { CharacterSlot, Signals } from "@/components/v3/character";
import { GhanshyamScreen } from "@/components/v4/screen";

// Geometry meshopt-compressed losslessly and the fabric textures in WebP:
// 2.0 MB, not 2.8. Not quantized (it hid the TV's logo), and the TV's own
// textures are left alone (WebP turned the baked chrome beige). A new file name for each new version, because
// /v4/ is served with a year-long immutable cache (next.config.ts).
export const GHANSHYAM_URL = "/v4/ghanshyam-3.glb";

/** The TV head's materials, by the name the model gives each part. */
const HEAD: Record<string, THREE.MeshPhysicalMaterialParameters> = {
  // Matte silver: rough enough that the room blurs into a soft sheen and
  // the model's flat facets don't show.
  light_grey: { color: "#c4c7cc", metalness: 0.85, roughness: 0.5 },
  // Black chrome around the screen, lit harder by the room so the mirror
  // still shows its highlights.
  plastic_black: { color: "#2c2e33", metalness: 1, roughness: 0.14, envMapIntensity: 2.2 },
  chrome: { color: "#f2f2f2", metalness: 1, roughness: 0.06 },
};

/* Framing, after the reference: the set fills the upper middle right, the
   shoulders run off the foot of the window. The figure stands from about -3.5
   (chest) to 1.1 (top of the set). */
const DESK = { scale: 1.28, x: 0.12, y: 0.2 };
/* On a phone or tablet the figure is centred and sized to the window: the
   shoulders run off the foot and both sides, as on a desktop, so the cut
   sleeves never show, but the set never grows wide enough to crowd the
   sides. Fractions of the window in world units. */
const narrowFrame = (w: number, h: number) => {
  const scale = Math.min(Math.max(0.185 * h, 0.29 * w), 0.38 * w);
  // The chest (about -3.5) sits below the bottom edge, and the top of the
  // set (about 1.4) no higher than just under the menu.
  return { scale, x: 0, y: Math.min(-0.53 * h + 3.5 * scale, 0.37 * h - 1.4 * scale) };
};
/** Turned a little toward the conversation, as in the reference. */
const REST_TURN = -0.16;

export function GhanshyamCharacter({ signals, awake }: { signals: React.RefObject<Signals>; awake: boolean }) {
  const { scene } = useGLTF(GHANSHYAM_URL);
  const { viewport, size } = useThree();
  const rig = useRef<THREE.Group>(null);

  const face = useMemo(() => new GhanshyamScreen(typeof window !== "undefined" && window.innerWidth < 900 ? 1024 : 1536), []);

  // Materials and the parts that are not meant to be seen, as the original
  // site set them up; and the screen, which now shows Elio's face.
  const parts = useMemo(() => {
    const atlas: Record<string, THREE.MeshStandardMaterial> = {};
    scene.getObjectByName("Maps")?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m) atlas[m.name] = m;
    });
    let screen: THREE.Mesh | null = null;
    let led: THREE.MeshStandardMaterial | null = null;
    let glow: THREE.MeshBasicMaterial | null = null;
    let logoAt: { mesh: THREE.Mesh; centre: THREE.Vector3; normal: THREE.Vector3 } | null = null;
    const hide = new Set(["Maps", "Icosphere", "Plane001", "Plane.001", "Empty002", "Raycaster", "ScreenGlow", "Lights_glow", "FaceCam"]);
    scene.traverse((o) => {
      if (hide.has(o.name)) {
        o.visible = false;
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((raw, i) => {
        let m = raw as THREE.MeshStandardMaterial;
        // The head is a matte silver TV with a black chrome front: its
        // own copies, so the cables that share these materials keep theirs.
        const look = o.parent?.name === "TV" ? HEAD[m.name] : undefined;
        if (look) {
          m = new THREE.MeshPhysicalMaterial({ name: m.name, ...look });
          if (Array.isArray(mesh.material)) mesh.material[i] = m;
          else mesh.material = m;
        }
        m.envMapIntensity = look ? (look.envMapIntensity ?? 1.3) : 1;
        const lightmap = atlas.lightmap?.map;
        if (lightmap) {
          m.aoMap = lightmap;
          m.aoMap.channel = 1;
          // Lighter on the head, or its colours turn muddy.
          m.aoMapIntensity = look ? 0.5 : 0.8;
        }
        if (m.name === "Screen") {
          screen = mesh;
          m.map = null;
          // Dark glass that shows the picture, with only a faint sheen of the
          // room across it, as on real tube glass.
          m.color.setRGB(0.01, 0.01, 0.01);
          m.emissiveMap = face.texture;
          m.emissive.setRGB(1, 1, 1);
          m.emissiveIntensity = 1.6;
          m.roughness = 0.6;
          m.metalness = 0;
          m.envMapIntensity = 0.12;
          m.toneMapped = false;
          const phys = m as THREE.MeshPhysicalMaterial;
          if (phys.isMeshPhysicalMaterial) {
            phys.clearcoat = 1;
            phys.clearcoatRoughness = 0.06;
            phys.sheen = 0;
            phys.transmission = 0;
            phys.iridescence = 0;
            phys.specularIntensity = 0.2;
          }
        }
        if (m.name === "Cloth") {
          m.color.set("#151515");
          const n = atlas.fabric?.normalMap;
          if (n) {
            m.normalMap = n;
            n.wrapS = n.wrapT = THREE.RepeatWrapping;
            n.repeat.set(5, 5);
            m.normalScale.set(2.5, 2.5);
          }
          m.roughness = 0.89;
        }
        if (m.name === "Skin" && atlas.pores?.normalMap) {
          m.normalMap = atlas.pores.normalMap;
          m.normalScale.set(0.1, 0.1);
        }
        if (m.name === "Lights") {
          // One power light, not a row of six: keep only the rightmost.
          const g = mesh.geometry;
          const pos = g.attributes.position;
          g.computeBoundingBox();
          const cut = g.boundingBox!.max.x - 0.07;
          if (g.index) {
            const idx = Array.from(g.index.array);
            const keep: number[] = [];
            for (let t = 0; t < idx.length; t += 3) {
              if (pos.getX(idx[t]) > cut && pos.getX(idx[t + 1]) > cut && pos.getX(idx[t + 2]) > cut) keep.push(idx[t], idx[t + 1], idx[t + 2]);
            }
            g.setIndex(keep);
          }
          m.color.setRGB(0.02, 0.05, 0.03);
          m.emissive.setRGB(0.15, 1, 0.35);
          // Past the tone mapping, or the green greys out and the pulse is lost.
          m.toneMapped = false;
          led = m;
          // A faint spill of light around it on the black front, breathing with it.
          const c = document.createElement("canvas");
          c.width = c.height = 128;
          const cg = c.getContext("2d")!;
          const grad = cg.createRadialGradient(64, 64, 0, 64, 64, 64);
          grad.addColorStop(0, "rgba(255,255,255,1)");
          grad.addColorStop(0.25, "rgba(255,255,255,0.45)");
          grad.addColorStop(1, "rgba(255,255,255,0)");
          cg.fillStyle = grad;
          cg.fillRect(0, 0, 128, 128);
          glow = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(c),
            color: new THREE.Color(0.2, 1, 0.4),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          });
          const ledBox = new THREE.Box3();
          for (let k = 0; k < pos.count; k++) if (pos.getX(k) > cut) ledBox.expandByPoint(new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)));
          const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), glow);
          halo.position.copy(ledBox.getCenter(new THREE.Vector3())).setZ(ledBox.max.z + 0.004);
          mesh.add(halo);
          // The logo sits on the same strip of the front, centred.
          const box = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute);
          const normal = new THREE.Vector3();
          const na = g.attributes.normal;
          for (let k = 0; k < na.count; k++) normal.add(new THREE.Vector3(na.getX(k), na.getY(k), na.getZ(k)));
          normal.normalize();
          // The light is a short rod set into the front: its outer face is the surface.
          const centre = box.getCenter(new THREE.Vector3()).setX(0).setZ(box.max.z);
          logoAt = { mesh, centre, normal };
        }
        // The green on the plugs reflected onto the glass; keep them dark.
        if (m.name === "Lights.001") m.emissiveIntensity = 0;
        m.needsUpdate = true;
      });
    });
    // His logo, in silver, on the front below the screen.
    // (Set inside the traverse callback, which TypeScript does not follow.)
    const at = logoAt as { mesh: THREE.Mesh; centre: THREE.Vector3; normal: THREE.Vector3 } | null;
    if (at) {
      const { mesh, centre, normal } = at;
      const tex = new THREE.TextureLoader().load("/gp-logo-512.png");
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const h = 0.085;
      const logo = new THREE.Mesh(
        new THREE.PlaneGeometry(h * (1405 / 1118), h),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, color: "#d4d8de", metalness: 0.6, roughness: 0.35 }),
      );
      logo.name = "Logo";
      // Raised from the light's line to the middle of the black strip.
      logo.position.copy(centre).addScaledVector(normal, 0.003);
      logo.position.y += 0.1;
      logo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      mesh.add(logo);
    }
    const bones: Record<string, THREE.Object3D> = {};
    const base: Record<string, THREE.Euler> = {};
    for (const n of ["torso", "neck1", "neck2", "shoulderL", "shoulderR"]) {
      const b = scene.getObjectByName(n);
      if (b) {
        bones[n] = b;
        base[n] = b.rotation.clone();
      }
    }
    return { screen: screen as THREE.Mesh | null, led: led as THREE.MeshStandardMaterial | null, glow: glow as THREE.MeshBasicMaterial | null, bones, base };
  }, [scene, face]);

  useEffect(() => () => face.dispose(), [face]);

  const look = useRef({ x: 0, y: 0 });
  const blink = useRef({ v: 0, next: 1.5 });
  const card = useRef<{ panel: Signals["panel"]; amount: number }>({ panel: null, amount: 0 });
  const close = useRef(0);
  const warm = useRef(0);
  const gesture = useRef({ key: "", mood: "neutral", t0: -10 });
  const lean = useRef(0);
  // Life while nobody is talking to it: from 20 s of quiet, now and then a
  // glance around, a double blink or a stretch. Never while it speaks.
  const quiet = useRef({ last: 0, px: 0, py: 0, beat: 0, next: 26, kind: "", t0: -10, gx: 0, gy: 0 });
  const sphere = useRef(new THREE.Sphere());
  const tmp = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    // The power light breathes: a slow rise and fall, about every 3.5 s, from
    // nearly off to bright, its halo swelling with it.
    const breath = 0.5 - 0.5 * Math.cos(state.clock.elapsedTime * 1.8);
    if (parts.led) parts.led.emissiveIntensity = 0.06 + 1.1 * breath;
    if (parts.glow) parts.glow.opacity = 0.22 * breath * breath;
    const s = signals.current;
    const g = rig.current;
    if (!s || !g) return;
    const d = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    // Framing, with a gentle push in while a game is on the screen.
    // Any portrait window, a large tablet included, takes the centred framing.
    const narrow = size.width < 900 || size.height > size.width;
    const f = narrow ? narrowFrame(viewport.width, viewport.height) : DESK;
    close.current += ((s.game ? 1 : 0) - close.current) * (1 - Math.exp(-3 * d));
    const k = close.current;
    g.scale.setScalar(f.scale * (1 + 0.35 * k));
    g.position.set(
      viewport.width * f.x * (1 - k * 0.15),
      f.y + (narrow ? 0.25 : -0.35) * k,
      0,
    );

    // Anything the visitor or Elio does resets the quiet clock.
    const q = quiet.current;
    if (s.px !== q.px || s.py !== q.py || s.typing || s.listening || s.talking > 0.05 || s.beat !== q.beat) {
      q.last = t;
      q.px = s.px;
      q.py = s.py;
      q.beat = s.beat;
      if (q.next < t) q.next = t + 20;
    }
    const still = !s.reduced && !s.game && s.mood !== "sleepy";
    if (still && t - q.last > 20 && t > q.next) {
      q.kind = ["glance", "glance", "blinks", "stretch"][Math.floor(Math.random() * 4)];
      q.t0 = t;
      q.gx = (Math.random() * 2 - 1) * 0.7;
      q.gy = Math.random() * 0.5 - 0.2;
      q.next = t + 6 + Math.random() * 8;
      if (q.kind === "blinks") blink.current.v = 1;
    }
    const qa = t - q.t0;
    const qe = (dur: number) => (still && qa < dur ? Math.sin((Math.PI * qa) / dur) : 0);
    // The second blink of the pair, once the first has closed and opened.
    if (q.kind === "blinks" && qa > 0.28) {
      blink.current.v = 1;
      q.kind = "";
    }

    // The pointer measured from the head, not the middle of the window: on a
    // desktop the head sits right of centre, so the window's edge is nearer
    // on that side, and without this it turned far less to the right.
    const hx = s.headX ? (s.headX / size.width) * 2 - 1 : 0;
    const aim = Math.max(-1, Math.min(1, s.px >= hx ? (s.px - hx) / (1 - hx) : (s.px - hx) / (1 + hx)));
    // Look toward the pointer, or the box while the visitor types; now and
    // then, when it's quiet, somewhere else for a moment.
    const glance = q.kind === "glance" ? qe(1.6) : 0;
    const want = s.reduced || s.game || s.listening
      ? { x: 0, y: 0 }
      : s.typing
        ? { x: narrow ? 0 : -0.8, y: -0.5 }
        : { x: aim + (q.gx - aim) * glance, y: s.py + (q.gy - s.py) * glance };
    const lr = 1 - Math.exp(-4 * d);
    look.current.x += (want.x - look.current.x) * lr;
    look.current.y += (want.y - look.current.y) * lr;
    const mx = look.current.x;
    const my = look.current.y;
    const { bones, base } = parts;
    for (const n in bones) bones[n].rotation.copy(base[n]);

    // One small gesture as each line starts, for its mood: added on top of the
    // sway, eased in and out, and replaced (never stacked) by the next one.
    const gkey = `${s.beat}|${s.mood}`;
    if (gkey !== gesture.current.key) gesture.current = { key: gkey, mood: s.mood, t0: t };
    const ga = t - gesture.current.t0;
    let nodX = 0; // neck pitch, + looks down
    let turnY = 0; // neck yaw
    let tilt = 0; // neck roll
    let bodyX = 0; // torso pitch, - leans back
    let lift = 0; // the whole figure, up
    if (!s.reduced && !s.game) {
      const in_ = (dur: number) => (ga < dur ? Math.sin((Math.PI * ga) / dur) : 0);
      switch (gesture.current.mood) {
        case "happy":
        case "excited": {
          const e = in_(0.9);
          nodX = 0.05 * Math.sin((2 * Math.PI * ga) / 0.45) * e;
          lift = 0.025 * Math.abs(Math.sin((2 * Math.PI * ga) / 0.45)) * e;
          break;
        }
        case "laugh": {
          const e = in_(0.8);
          lift = 0.03 * Math.abs(Math.sin((2 * Math.PI * ga) / 0.4)) * e;
          nodX = 0.03 * e;
          break;
        }
        case "thinking": {
          const e = in_(1.4);
          tilt = 0.07 * e;
          turnY = -0.06 * e;
          nodX = -0.03 * e;
          break;
        }
        case "sad": {
          const e = in_(1.4);
          turnY = 0.05 * Math.sin((2 * Math.PI * ga) / 0.7) * e;
          nodX = 0.05 * e;
          bodyX = 0.03 * e;
          break;
        }
        case "surprised": {
          const e = in_(0.6);
          bodyX = -0.05 * e;
          nodX = -0.04 * e;
          break;
        }
        case "cool": {
          const e = in_(1);
          nodX = -0.05 * e;
          break;
        }
        case "shy": {
          nodX = 0.04 * in_(1.2);
          break;
        }
        case "confused": {
          tilt = -0.07 * in_(1.2);
          break;
        }
        case "love": {
          const e = in_(1.2);
          tilt = 0.05 * e;
          nodX = 0.03 * e;
          break;
        }
      }
    }
    // Holding the mic: lean in a little and face the visitor.
    lean.current += ((s.listening && !s.reduced ? 1 : 0) - lean.current) * (1 - Math.exp(-5 * d));
    nodX += 0.04 * lean.current;
    bodyX += 0.04 * lean.current;
    if (q.kind === "stretch") {
      const e = qe(1.8);
      bodyX -= 0.04 * e;
      nodX -= 0.05 * e;
      lift += 0.015 * e;
    }
    g.position.y += lift;
    const shy = s.mood === "shy" && !s.game ? 1 : 0;
    const sway = s.reduced || s.game ? 0 : 1;
    if (bones.neck1) {
      bones.neck1.rotation.y += mx * 0.25 + shy * 0.3 + (narrow ? 0 : REST_TURN) * (1 - k) + turnY;
      bones.neck1.rotation.x += my * 0.08 + shy * 0.08 + nodX;
      bones.neck1.rotation.z += -mx * 0.05 + tilt;
    }
    if (bones.neck2) {
      // A small dip on each stressed syllable, following the voice's level.
      bones.neck2.rotation.x += Math.sin(t * 0.51) * 0.025 * sway + s.talking * 0.02 * sway;
      bones.neck2.rotation.z += Math.sin(t * 0.23) * 0.02 * sway;
    }
    if (bones.torso) {
      bones.torso.rotation.x += my * 0.035 + bodyX;
      bones.torso.rotation.y += mx * 0.07;
    }
    for (const [n, sign] of [["shoulderL", 1], ["shoulderR", -1]] as const) {
      if (bones[n]) bones[n].rotation.y += Math.sin(t * 1.2) * 0.012 * sign * sway;
    }

    // The screen: a game, a card, or Elio's face, warming up on first light.
    warm.current = awake ? Math.min(1, warm.current + d * 1.6) : warm.current;
    s.power = warm.current;
    blink.current.next -= d;
    if (blink.current.next <= 0) {
      blink.current.v = 1;
      blink.current.next = 2.2 + Math.random() * 4.5;
    }
    blink.current.v = Math.max(0, blink.current.v - d * 7.5);
    const c = card.current;
    if (s.panel && s.panel !== c.panel) {
      if (c.panel && c.amount > 0.02) c.amount = Math.max(0, c.amount - d * 11);
      else c.panel = s.panel;
    }
    if (s.panel && s.panel === c.panel) c.amount += (1 - c.amount) * (1 - Math.exp(-7 * d));
    if (!s.panel) {
      c.amount = Math.max(0, c.amount - d * 6);
      if (c.amount < 0.02) c.panel = null;
    }
    s.squint *= 0.94;
    face.draw(
      {
        reduced: s.reduced,
        mood: s.listening || (s.typing && s.mood === "neutral") ? "listening" : s.mood,
        lookX: s.typing ? -0.6 : mx,
        lookY: s.typing ? 0.5 : my,
        blink: s.reduced ? 0 : Math.sin(Math.min(1, blink.current.v) * Math.PI),
        talking: s.talking,
        time: t,
        power: warm.current,
        panel: c.panel,
        panelIn: c.amount,
        px: s.px,
        py: s.py,
        hover: s.hover,
        squint: s.squint,
        attention: s.attention,
      },
      s.game ? (s.game.update(d), s.game) : null,
    );

    // Where the screen is on the page, for taps and hover.
    const screen = parts.screen;
    if (screen) {
      screen.updateWorldMatrix(true, false);
      if (!screen.geometry.boundingSphere) screen.geometry.computeBoundingSphere();
      sphere.current.copy(screen.geometry.boundingSphere!).applyMatrix4(screen.matrixWorld);
      const ndc = tmp.current.copy(sphere.current.center).project(state.camera);
      s.headX = ((ndc.x + 1) / 2) * size.width;
      s.headY = ((1 - ndc.y) / 2) * size.height;
      const edge = tmp.current
        .copy(sphere.current.center)
        .add(new THREE.Vector3().setFromMatrixColumn(state.camera.matrixWorld, 0).multiplyScalar(sphere.current.radius))
        .project(state.camera);
      s.headR = Math.abs(((edge.x + 1) / 2) * size.width - s.headX) * 1.05;
    }
  });

  return (
    <>
      {/* The reference's own studio: its HDR probe, a warm key from the upper
          left and a cool fill from the right. */}
      <Environment files="/v4/envmap.exr" environmentRotation={[0, Math.PI * 0.7, 0]} environmentIntensity={1} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[-3, 4, 5]} intensity={1.6} color="#ffe8dc" />
      <directionalLight position={[4, 1, 3]} intensity={0.35} color="#b1c6ed" />
      <group ref={rig}>
        <primitive object={scene} />
      </group>
    </>
  );
}

useGLTF.preload(GHANSHYAM_URL);

/** A seamless grey studio sweep, lighter behind the words, as in the reference. */
const STUDIO = (
  <div
    className="absolute inset-0"
    style={{
      // The reference's own: grey that falls off evenly from the middle of the
      // window, 0.89 at the centre toward 0.3 (reaching about 0.47 at the
      // corners), with no texture over it.
      background: "radial-gradient(ellipse farthest-corner at 50% 50%, rgb(227,227,227) 0%, rgb(120,120,120) 100%)",
    }}
  />
);

export const GHANSHYAM_SLOT: CharacterSlot = {
  url: GHANSHYAM_URL,
  exposure: 1,
  toneMapping: THREE.AgXToneMapping,
  ownLighting: true,
  backdrop: STUDIO,
  grain: false,
  render: ({ signals, awake }) => <GhanshyamCharacter signals={signals} awake={awake} />,
};
