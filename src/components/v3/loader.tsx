"use client";

import { useEffect, useState } from "react";

import { SkyLoader } from "./sky-loader";
import { StudioLoader } from "./studio-loader";

/**
 * The door.
 *
 * Two jobs. The obvious one is to cover the few seconds the character takes
 * to arrive, so nobody watches a television assemble itself out of nothing.
 *
 * It opens by itself once everything has arrived. Browsers will not play
 * sound before the visitor has clicked or pressed something, so the voice
 * joins from the first interaction rather than the first line; a button just
 * to unlock audio cost every visitor a click to get in.
 *
 * It is part of the prerendered HTML, so the mark is the first thing on
 * screen rather than a blank page waiting on JavaScript.
 */
export function Loader({
  progress,
  ready,
  onEnter,
  reduced,
  theme = "studio",
}: {
  /** 0 to 100, from the scene's own loader. */
  progress: number;
  ready: boolean;
  onEnter: (withSound: boolean) => void;
  reduced: boolean;
  theme?: "studio" | "sky";
}) {
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // The figure eases toward the real one rather than jumping, so a model that
  // arrives in two large chunks still reads as steady progress.
  //
  // Eased against the clock, not per frame. Per frame, the counter crawled on
  // a slow machine: frames are exactly what a struggling device has fewest of,
  // and this was crawling to 92 in a minute on a software renderer.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      setShown((v) => {
        const target = ready ? 100 : Math.min(progress, 96);
        const next = v + (target - v) * (1 - Math.exp(-dt * 7));
        return Math.abs(target - next) < 0.3 ? target : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress, ready]);

  const canEnter = ready && shown >= 99.5;

  // In by itself, a beat after the bar fills so the full mark is seen.
  useEffect(() => {
    if (!canEnter || leaving) return;
    const t = setTimeout(() => {
      setLeaving(true);
      onEnter(true);
    }, 450);
    return () => clearTimeout(t);
  }, [canEnter, leaving, onEnter]);

  if (theme === "sky") {
    return <SkyLoader progress={shown} ready={canEnter} leaving={leaving} reduced={reduced} />;
  }

  return <StudioLoader progress={shown} ready={canEnter} leaving={leaving} reduced={reduced} />;
}
