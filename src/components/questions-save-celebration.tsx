"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";

type Props = {
  openOnMount: boolean;
  updatedMode?: boolean;
  pointsAwarded?: number;
};

export function QuestionsSaveCelebration({ openOnMount, updatedMode = false, pointsAwarded = 0 }: Props) {
  const [open, setOpen] = useState(openOnMount);
  const router = useRouter();
  const pathname = usePathname();

  function closePopup() {
    setOpen(false);
    router.replace(pathname);
  }

  return (
    <AnimatedCelebrationPopup
      characterMode="manager"
      closeLabel="Continue Quest"
      message={
        updatedMode
          ? "Updated! Your pending check-in was refreshed for manager review."
          : "Saved! Your check-in is now waiting for manager approval."
      }
      onClose={closePopup}
      open={open}
      pointsLabel={
        updatedMode
          ? "Pending Submission Updated"
          : pointsAwarded > 0
            ? `💃 +${pointsAwarded} points! Submission bonus added`
            : "Submission Complete"
      }
      progressCaption="Check-in"
      progressTarget={100}
      title={updatedMode ? "Update Complete!" : "Great Work Today!"}
    />
  );
}
