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
          ? pointsAwarded > 0
            ? `Updated! Your latest pending check-in is synced and +${pointsAwarded} points were added.`
            : "Updated! Your pending check-in was refreshed for manager review."
          : pointsAwarded > 0
            ? "Saved! Your check-in is now pending manager review, and points were added."
            : "Saved! Your check-in is now waiting for manager approval."
      }
      onClose={closePopup}
      open={open}
      pointsLabel={
        pointsAwarded > 0
          ? `💃 +${pointsAwarded} points! Check-in submit bonus added`
          : updatedMode
            ? "Pending Submission Updated"
            : "Submission Complete"
      }
      progressCaption="Check-in"
      progressTarget={100}
      title={pointsAwarded > 0 ? "Check-in Bonus Added!" : updatedMode ? "Update Complete!" : "Great Work Today!"}
    />
  );
}
