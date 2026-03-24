"use client";

import { useState } from "react";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";

type Props = {
  openOnMount: boolean;
  approved: boolean;
  points: number;
  note?: string;
};

export function ManagerReviewResultPopup({ openOnMount, approved, points, note }: Props) {
  const [open, setOpen] = useState(openOnMount);
  const safeNote = (note ?? "").trim();
  const message = safeNote.length > 0 ? safeNote : approved ? "Points confirmed and user score updated." : "Reviewed as no-points for this entry.";

  return (
    <AnimatedCelebrationPopup
      autoCloseMs={2200}
      characterMode="manager"
      closeLabel="Done"
      managerEmotion="approval"
      message={message}
      onClose={() => setOpen(false)}
      open={open}
      pointsLabel={approved ? `+${points} pts reviewed` : "No points decision"}
      progressCaption="Review"
      progressTarget={100}
      title={approved ? "manager_approving" : "Review completed"}
    />
  );
}
