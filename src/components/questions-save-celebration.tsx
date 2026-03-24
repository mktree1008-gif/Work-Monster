"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";

type Props = {
  openOnMount: boolean;
};

export function QuestionsSaveCelebration({ openOnMount }: Props) {
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
      message="Saved! Your check-in is now waiting for manager approval."
      onClose={closePopup}
      open={open}
      pointsLabel="Submission Complete"
      progressCaption="Check-in"
      progressTarget={100}
      title="Great Work Today!"
    />
  );
}
