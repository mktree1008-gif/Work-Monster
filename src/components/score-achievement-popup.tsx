"use client";

import { useEffect, useState } from "react";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";

type Props = {
  totalPoints: number;
  currentStreak: number;
  multiplierActive: boolean;
  multiplierValue: number;
  nextRewardProgress: number;
};

type PopupState = {
  title: string;
  message: string;
  pointsLabel: string;
  progressTarget: number;
};

type Snapshot = {
  totalPoints: number;
  currentStreak: number;
  multiplierActive: boolean;
};

const SNAPSHOT_KEY = "wm_score_snapshot_v1";
const LAST_POPUP_SIG_KEY = "wm_score_popup_sig_v1";

function safeParseSnapshot(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Snapshot;
  } catch (_error) {
    return null;
  }
}

export function ScoreAchievementPopup({
  totalPoints,
  currentStreak,
  multiplierActive,
  multiplierValue,
  nextRewardProgress
}: Props) {
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<PopupState | null>(null);

  useEffect(() => {
    const previous = safeParseSnapshot(localStorage.getItem(SNAPSHOT_KEY));
    const current: Snapshot = { totalPoints, currentStreak, multiplierActive };
    const signature = `${totalPoints}|${currentStreak}|${multiplierActive ? "1" : "0"}`;

    let nextPopup: PopupState | null = null;
    if (previous) {
      if (multiplierActive && !previous.multiplierActive) {
        nextPopup = {
          title: `${multiplierValue.toFixed(1)}x Multiplier Activated!`,
          message: "Rocket boost unlocked. Your approved points now scale up with your streak momentum.",
          pointsLabel: `Current ${totalPoints} pts`,
          progressTarget: Math.max(18, Math.round(nextRewardProgress))
        };
      } else if (currentStreak > previous.currentStreak && currentStreak >= 2) {
        nextPopup = {
          title: `${currentStreak}-Day Streak!`,
          message: "Streak extended. Keep this rhythm and your next reward arrives faster.",
          pointsLabel: `Streak +${currentStreak - previous.currentStreak}`,
          progressTarget: Math.max(12, Math.round(nextRewardProgress))
        };
      } else if (totalPoints > previous.totalPoints) {
        const gained = totalPoints - previous.totalPoints;
        nextPopup = {
          title: `${totalPoints} pts Achieved!`,
          message: "Score updated from manager approval. Nice momentum gain.",
          pointsLabel: `+${gained} pts`,
          progressTarget: Math.max(8, Math.round(nextRewardProgress))
        };
      }
    }

    const lastSig = localStorage.getItem(LAST_POPUP_SIG_KEY);
    if (nextPopup && lastSig !== signature) {
      setPopup(nextPopup);
      setOpen(true);
      localStorage.setItem(LAST_POPUP_SIG_KEY, signature);
    }

    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(current));
  }, [totalPoints, currentStreak, multiplierActive, multiplierValue, nextRewardProgress]);

  return (
    <AnimatedCelebrationPopup
      characterMode="both"
      closeLabel="Keep Momentum"
      message={popup?.message ?? ""}
      onClose={() => setOpen(false)}
      open={open}
      pointsLabel={popup?.pointsLabel}
      progressCaption="Reward Path"
      progressTarget={popup?.progressTarget ?? 0}
      title={popup?.title ?? ""}
    />
  );
}
