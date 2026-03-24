"use client";

import { useEffect, useState } from "react";
import { CharacterCue } from "@/lib/character-system";
import { ChibiAvatar } from "@/components/chibi-avatar";

type Props = {
  openOnMount: boolean;
  role: "manager" | "user";
  cue: CharacterCue;
  durationMs?: number;
  glasses?: boolean;
  tone?: "default" | "warning" | "success";
};

function toneClass(tone: Props["tone"]): string {
  if (tone === "warning") return "border-amber-300 bg-amber-50 text-amber-900";
  if (tone === "success") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  return "border-indigo-200 bg-indigo-50 text-indigo-900";
}

export function CharacterToast({
  openOnMount,
  role,
  cue,
  durationMs = 2200,
  glasses = false,
  tone = "default"
}: Props) {
  const [open, setOpen] = useState(openOnMount);

  useEffect(() => {
    if (!openOnMount) return;
    setOpen(true);
    const timer = window.setTimeout(() => setOpen(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [openOnMount, durationMs]);

  if (!open) return null;

  const emotion =
    cue.expression === "wide-eyes"
      ? "alert"
      : cue.expression === "wink" || cue.expression === "clap" || cue.expression === "jump"
        ? "excited"
        : cue.expression === "sad" || cue.expression === "nervous"
          ? "alert"
          : "encouraging";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[72] px-4">
      <div className={`container-mobile anim-pop rounded-2xl border px-3 py-2 shadow-xl ${toneClass(tone)}`}>
        <div className="flex items-center gap-2">
          <ChibiAvatar emotion={emotion} glasses={glasses} role={role} size={42} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em]">{cue.spriteName}</p>
            <p className="truncate text-sm font-semibold">
              {cue.emoji} {cue.message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
