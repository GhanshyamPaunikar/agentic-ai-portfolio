"use client";

import { profile } from "@/data/portfolio";
import styles from "./studio-loader.module.css";

/**
 * The homepage entrance: his logo on the same grey as the studio.
 * It pulls into focus, then a glint runs across it until the page is ready.
 * No count: the wait is short, and a number only makes it feel longer.
 * Timing remains owned by Loader.
 */
export function StudioLoader({ ready, leaving, reduced }: {
  progress: number;
  ready: boolean;
  leaving: boolean;
  reduced: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name}, loading`}
      className={styles.screen}
      data-leaving={leaving}
      data-ready={ready}
      data-reduced={reduced}
    >
      <div className={styles.mark} aria-hidden="true">
        <div className={styles.logo} />
        <div className={`${styles.logo} ${styles.glint}`} />
      </div>
      <span className={styles.srOnly} role="status">{ready ? "Ready. Opening." : "Loading the portfolio."}</span>
    </div>
  );
}
