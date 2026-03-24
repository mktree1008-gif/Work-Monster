"use client";

import { useState } from "react";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";

type Props = {
  openOnMount: boolean;
  version: number;
};

export function ManagerRulesSavedPopup({ openOnMount, version }: Props) {
  const [open, setOpen] = useState(openOnMount);

  return (
    <AnimatedCelebrationPopup
      autoCloseMs={2200}
      characterMode="manager"
      closeLabel="Done"
      managerEmotion="approval"
      message="Rules were saved successfully. User screens will reflect this update immediately."
      onClose={() => setOpen(false)}
      open={open}
      pointsLabel={`Rule v${version}`}
      progressCaption="Saved"
      progressTarget={100}
      title="Rules updated"
    />
  );
}
