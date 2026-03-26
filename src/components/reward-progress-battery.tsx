"use client";

import { useEffect, useMemo, useState } from "react";

type BatteryTone = "sunset" | "gold" | "mint" | "violet";
type RewardStatus = "Locked" | "Available" | "Claimed";

type Props = {
  progressPercent: number;
  currentPoints: number;
  requiredPoints: number;
  tone: BatteryTone;
  status: RewardStatus;
};

const TONE_FILL: Record<BatteryTone, string> = {
  sunset: "linear-gradient(180deg, #ffe760 0%, #ffb733 42%, #ff8b4f 100%)",
  gold: "linear-gradient(180deg, #fff59e 0%, #ffd84a 50%, #ffb520 100%)",
  mint: "linear-gradient(180deg, #b5f28f 0%, #74df8a 45%, #49cdb1 100%)",
  violet: "linear-gradient(180deg, #c49cff 0%, #8a5cf7 45%, #5938df 100%)"
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function RewardProgressBattery({ progressPercent, currentPoints, requiredPoints, tone, status }: Props) {
  const target = useMemo(() => clampPercent(progressPercent), [progressPercent]);
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const safeCurrent = Math.max(0, Math.round(currentPoints));
  const safeRequired = Math.max(1, Math.round(requiredPoints));

  useEffect(() => {
    let raf = 0;
    let start: number | undefined;
    const durationMs = 680;

    const tick = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const ratio = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - ratio) * (1 - ratio);
      setAnimatedPercent(Math.round(target * eased));
      if (ratio < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    setAnimatedPercent(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <div className="relative flex w-[92px] flex-col items-center">
      <div className="relative h-[144px] w-[70px]">
        <div className="absolute left-1/2 top-0 h-[15px] w-[28px] -translate-x-1/2 rounded-[7px] border-[3px] border-indigo-800 bg-gradient-to-b from-slate-100 to-slate-200" />
        <div className="absolute bottom-0 left-1/2 h-[132px] w-[70px] -translate-x-1/2 rounded-[24px] border-[4px] border-indigo-800 bg-gradient-to-br from-white via-indigo-50 to-indigo-100 p-[6px] shadow-[0_10px_22px_rgba(67,86,180,0.24)]">
          <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-gradient-to-b from-indigo-100/80 to-indigo-200/90">
            <div
              className="absolute bottom-0 left-0 right-0 transition-[height] duration-500 ease-out"
              style={{
                height: `${animatedPercent}%`,
                background: TONE_FILL[tone]
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0)_48%,rgba(255,255,255,0.38)_100%)]" />
            <div className="pointer-events-none absolute inset-x-[10%] top-[20%] h-[20%] rounded-full bg-white/26 blur-[2px]" />
            <div className="pointer-events-none absolute inset-x-0 top-[25%] border-t border-white/50" />
            <div className="pointer-events-none absolute inset-x-0 top-[50%] border-t border-white/50" />
            <div className="pointer-events-none absolute inset-x-0 top-[75%] border-t border-white/50" />
          </div>
        </div>
      </div>

      <div className="mt-[-2px] rounded-full bg-indigo-900 px-3 py-1 text-sm font-black text-amber-200 shadow-lg">
        +{safeCurrent} pts
      </div>
      <p className="mt-1 text-center text-[11px] font-semibold text-slate-500">
        {safeCurrent}/{safeRequired} pts
      </p>
      {status === "Claimed" && <p className="anim-pulse-soft mt-0.5 text-sm">✨</p>}
    </div>
  );
}

