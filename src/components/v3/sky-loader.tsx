"use client";

import Image from "next/image";
import { profile } from "@/data/portfolio";
import styles from "./sky-loader.module.css";

/**
 * The /v1 entrance: Elio's screen warming up. Static clears and the face
 * fades in as the scene loads, and the dial turns with the progress.
 * Timing remains owned by Loader.
 */
export function SkyLoader({ progress, ready, leaving, reduced }: {
  progress: number;
  ready: boolean;
  leaving: boolean;
  reduced: boolean;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <section
      className={`${styles.screen} ${styles.tuning}`}
      aria-label="Loading portfolio"
      data-loader-theme="sky"
      data-leaving={leaving}
      data-reduced={reduced}
      style={{ ["--p" as string]: percent / 100 }}
    >
      <div className={styles.tv}>
        <div className={styles.screenGlass}>
          <div className={styles.static} aria-hidden="true" />
          <div className={styles.face} aria-hidden="true">
            <i /><i />
            <b />
          </div>
          <div className={styles.osd} aria-hidden="true">
            <span>CH {String(percent).padStart(2, "0")}</span>
            <span>{ready ? "ON AIR" : "TUNING"}</span>
          </div>
        </div>
        <div className={styles.panel}>
          <div className={styles.dial} aria-hidden="true">
            <span style={{ transform: `rotate(${percent * 2.7 - 135}deg)` }} />
          </div>
          <Image src="/gp-logo.png" alt="GP" width={1405} height={1118} unoptimized priority className={styles.badge} />
        </div>
      </div>
      <h1 className={styles.name}>{profile.name}</h1>
      <p className={styles.role}>{profile.title}</p>
      <div className={styles.track} role="progressbar" aria-label="Loading portfolio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
      <span className={styles.srOnly} role="status">{ready ? "Portfolio ready. Opening." : "Loading the portfolio."}</span>
    </section>
  );
}
