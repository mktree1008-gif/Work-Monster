"use client";

import { useEffect, useState } from "react";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";

type Props = {
  openOnMount: boolean;
  points: number;
};

export function LoginBonusPopup({ openOnMount, points }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (openOnMount) {
      setOpen(true);
    }
  }, [openOnMount]);

  return (
    <AnimatedCelebrationPopup
      characterMode="both"
      closeLabel="Continue"
      managerEmotion="encouraging"
      message="Daily login bonus has been applied to your score."
      onClose={() => setOpen(false)}
      open={open}
      pointsLabel={`✨ +${points} points`}
      progressCaption="Daily bonus"
      progressTarget={100}
      title="Login Bonus Added!"
      userEmotion="excited"
    />
  );
}
