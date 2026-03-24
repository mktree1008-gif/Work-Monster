"use client";

import { useState } from "react";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";

type Props = {
  openOnMount: boolean;
  rewardTitle: string;
  requiredPoints: number;
};

export function RewardClaimPopup({ openOnMount, rewardTitle, requiredPoints }: Props) {
  const [open, setOpen] = useState(openOnMount);

  return (
    <AnimatedCelebrationPopup
      autoCloseMs={2200}
      characterMode={requiredPoints >= 30 ? "both" : "user"}
      closeLabel="Awesome"
      managerEmotion={requiredPoints >= 30 ? "approval" : "encouraging"}
      message={
        requiredPoints >= 30
          ? "manager_approving: Reward confirmed and added to your collection."
          : "Reward claimed successfully."
      }
      onClose={() => setOpen(false)}
      open={open}
      pointsLabel={`${requiredPoints} pts reward`}
      progressCaption="Reward"
      progressTarget={100}
      title={rewardTitle || "Reward unlocked"}
      userEmotion="excited"
    />
  );
}
