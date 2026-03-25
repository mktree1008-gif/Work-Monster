"use client";

import { useState } from "react";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";

type Props = {
  openOnMount: boolean;
  approved: boolean;
  points: number;
  bonusPoints?: number;
  bonusMessage?: string;
  note?: string;
};

export function ManagerReviewResultPopup({ openOnMount, approved, points, bonusPoints = 0, bonusMessage, note }: Props) {
  const [open, setOpen] = useState(openOnMount);
  const safeNote = (note ?? "").trim();
  const safeBonusMessage = (bonusMessage ?? "").trim();
  const hasBonus = bonusPoints > 0;
  const message =
    safeNote.length > 0
      ? safeNote
      : hasBonus
        ? safeBonusMessage.length > 0
          ? safeBonusMessage
          : "Bonus surprise is included for this review."
      : points < 0
        ? "Point deduction applied and reflected in user score."
        : approved
          ? "Points confirmed and user score updated."
          : "Reviewed as no-points for this entry.";
  const pointsLabel =
    points !== 0
      ? `${points > 0 ? `+${points}` : points} pts reviewed${hasBonus ? ` (+${bonusPoints} bonus)` : ""}`
      : approved
        ? "0 pts reviewed"
        : "No points decision";
  const title = points < 0 ? "manager_alert" : approved ? "manager_approving" : "Review completed";

  return (
    <AnimatedCelebrationPopup
      autoCloseMs={2200}
      characterMode="manager"
      closeLabel="Done"
      managerEmotion={points < 0 ? "alert" : "approval"}
      message={message}
      onClose={() => setOpen(false)}
      open={open}
      pointsLabel={pointsLabel}
      progressCaption="Review"
      progressTarget={100}
      title={title}
    />
  );
}
