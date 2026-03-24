"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { ChibiAvatar } from "@/components/chibi-avatar";

type CharacterMode = "user" | "manager" | "both";

type Props = {
  open: boolean;
  title: string;
  message: string;
  pointsLabel?: string;
  progressTarget?: number;
  progressCaption?: string;
  characterMode?: CharacterMode;
  userGlasses?: boolean;
  managerEmotion?: "neutral" | "encouraging" | "alert" | "excited" | "approval";
  userEmotion?: "neutral" | "encouraging" | "alert" | "excited" | "approval";
  autoCloseMs?: number;
  closeLabel?: string;
  onClose: () => void;
};

const ringRadius = 52;
const ringLength = 2 * Math.PI * ringRadius;

export function AnimatedCelebrationPopup({
  open,
  title,
  message,
  pointsLabel,
  progressTarget = 0,
  progressCaption = "Progress",
  characterMode = "both",
  userGlasses = false,
  managerEmotion = "excited",
  userEmotion = "approval",
  autoCloseMs,
  closeLabel = "Awesome",
  onClose
}: Props) {
  const [progress, setProgress] = useState(0);
  const normalizedTarget = useMemo(() => Math.max(0, Math.min(100, Math.round(progressTarget))), [progressTarget]);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      return;
    }

    let raf = 0;
    let start: number | undefined;
    const durationMs = 760;

    const tick = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const ratio = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - ratio) * (1 - ratio);
      setProgress(Math.round(normalizedTarget * eased));
      if (ratio < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, normalizedTarget]);

  useEffect(() => {
    if (!open || !autoCloseMs) return;
    const timer = window.setTimeout(() => onClose(), autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;

  const offset = ringLength * (1 - progress / 100);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="container-mobile card anim-pop relative overflow-hidden p-5 text-center">
        <span className="anim-confetti absolute left-[12%] top-5 text-lg">🎉</span>
        <span className="anim-confetti-delay absolute left-[78%] top-6 text-lg">✨</span>
        <span className="anim-confetti absolute left-[20%] top-14 text-base">⭐</span>
        <span className="anim-confetti-delay absolute left-[70%] top-14 text-base">🚀</span>

        <div className="mx-auto mb-3 flex items-center justify-center gap-2">
          {(characterMode === "manager" || characterMode === "both") && (
            <ChibiAvatar className="anim-bounce-soft" emotion={managerEmotion} role="manager" size={54} />
          )}
          {(characterMode === "user" || characterMode === "both") && (
            <ChibiAvatar className="anim-float" emotion={userEmotion} glasses={userGlasses} role="user" size={54} />
          )}
        </div>

        <div className="mx-auto mb-2 flex h-32 w-32 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={ringRadius} stroke="rgba(99,102,241,0.16)" strokeWidth="9" fill="transparent" />
            <circle
              cx="60"
              cy="60"
              r={ringRadius}
              stroke="url(#celebrateGradient)"
              strokeLinecap="round"
              strokeWidth="9"
              fill="transparent"
              strokeDasharray={ringLength}
              strokeDashoffset={offset}
              className="transition-all duration-300"
            />
            <defs>
              <linearGradient id="celebrateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="55%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute">
            <p className="text-3xl font-black text-indigo-900">{progress}%</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{progressCaption}</p>
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Achievement unlocked</p>
        <h3 className="mt-1 text-2xl font-black text-indigo-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{message}</p>
        {pointsLabel && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-800">
            <Sparkles size={14} />
            {pointsLabel}
          </p>
        )}

        <button className="btn btn-energetic mt-4 w-full" onClick={onClose} type="button">
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
