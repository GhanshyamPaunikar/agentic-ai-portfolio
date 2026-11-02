"use client";

import { useEffect, useRef } from "react";

import { type VoiceSettings } from "@/components/v3/speech";

/**
 * How Elio sounds: Olivia's speed, and a button to hear the result. Opens above
 * the composer, from the button beside the mute switch.
 */
export function VoicePicker({
  settings,
  onChange,
  onTest,
  onClose,
}: {
  settings: VoiceSettings;
  onChange: (v: VoiceSettings) => void;
  onTest: () => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  // Closes on Escape and on a click anywhere outside it.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const click = (e: PointerEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", click);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", click);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Elio's voice"
      className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-[min(320px,calc(100vw-32px))] rounded-[16px] border border-black/[0.09] bg-[#f7f8f9]/96 p-4 text-[13px] text-black/75 shadow-[0_26px_60px_-28px_rgba(20,22,27,0.55)] backdrop-blur-xl"
      style={{ animation: "v3rise 220ms cubic-bezier(.16,1,.3,1) both" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">Voice · Olivia</span>
        <button
          type="button"
          onClick={onTest}
          className="rounded-full bg-[#16181c] px-3 py-1 text-[12px] text-white transition-transform hover:scale-[1.03]"
        >
          Test
        </button>
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-black/50">
          <span>Speed</span>
          <span className="tabular-nums">{settings.rate.toFixed(2)}×</span>
        </span>
        <input
          type="range"
          min={0.6}
          max={1.8}
          step={0.05}
          value={settings.rate}
          onChange={(e) => onChange({ ...settings, rate: Number(e.target.value) })}
          className="w-full accent-[#16181c]"
        />
      </label>
    </div>
  );
}
