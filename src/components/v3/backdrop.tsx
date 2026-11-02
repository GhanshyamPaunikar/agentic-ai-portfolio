"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import type { Signals } from "@/components/v3/character";
import styles from "./backdrop.module.css";

export const SKY_IMAGE = "/v1/sky-garden.webp";

/** Original painted sky garden, with independent weather and depth layers. */
export function SkyBackdrop({ signals, onReady }: {
  signals: React.RefObject<Signals>;
  onReady?: () => void;
}) {
  const room = useRef<HTMLDivElement>(null);
  const landscape = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = room.current;
    const painting = landscape.current;
    if (!el || !painting) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    let x = 0;
    let y = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // Keep this light: the robot has its own render loop.
      if (now - last < 32) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const ease = 1 - Math.exp(-2 * dt);
      x += (signals.current.px * -9 - x) * ease;
      y += (signals.current.py * -5 - y) * ease;
      painting.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(1.035)`;
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      const paused = motion.matches || document.hidden;
      el.dataset.paused = String(paused);
      if (motion.matches) painting.style.transform = "scale(1.035)";
      if (!paused) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [signals]);

  return (
    <div ref={room} className={styles.room}>
      <div ref={landscape} className={styles.landscape}>
        <Image
          src={SKY_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.painting}
          onLoad={() => onReady?.()}
        />
      </div>
      <div className={styles.sunlight} />
      <div className={`${styles.cloud} ${styles.farCloud}`} />
      <div className={`${styles.cloud} ${styles.highCloud}`} />
      <div className={`${styles.cloud} ${styles.nearCloud}`} />
      <div className={styles.birds}>
        {[0, 1, 2, 3, 4].map((i) => (
          <svg key={i} viewBox="0 0 40 20" className={styles.bird} aria-hidden="true">
            <path d="M2 8 Q11 0 20 12 Q29 0 38 8 Q29 5 20 15 Q11 5 2 8Z" fill="currentColor" />
          </svg>
        ))}
      </div>
      <div className={styles.mist} />
      <div className={styles.seeds}>
        {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} />)}
      </div>
    </div>
  );
}
