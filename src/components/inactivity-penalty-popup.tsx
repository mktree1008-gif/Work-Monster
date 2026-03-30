"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  openOnMount: boolean;
  locale: "en" | "ko";
  notificationId: string;
  missedDays: number;
  points: number;
  message: string;
};

function seenKey(notificationId: string): string {
  return `wm-inactivity-penalty-seen:${notificationId}`;
}

export function InactivityPenaltyPopup({
  openOnMount,
  locale,
  notificationId,
  missedDays,
  points,
  message
}: Props) {
  const [open, setOpen] = useState(false);
  const isKo = locale === "ko";

  useEffect(() => {
    if (!openOnMount) return;
    const key = seenKey(notificationId);
    try {
      if (window.sessionStorage.getItem(key) === "1") return;
      window.sessionStorage.setItem(key, "1");
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [notificationId, openOnMount]);

  const headline = useMemo(() => {
    if (isKo) {
      return `${missedDays}일 미로그인으로 ${points} pts 반영`;
    }
    return `${points} pts applied for ${missedDays} inactive day(s)`;
  }, [isKo, missedDays, points]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[74] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="container-mobile card anim-pop p-5">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
          <AlertTriangle size={14} />
          {isKo ? "Inactivity Penalty" : "Inactivity Penalty"}
        </p>
        <h3 className="mt-2 text-2xl font-black text-indigo-900">{headline}</h3>
        <p className="mt-2 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">{message}</p>
        <button className="btn btn-primary mt-4 w-full" onClick={() => setOpen(false)} type="button">
          {isKo ? "확인" : "Understood"}
        </button>
      </div>
    </div>
  );
}

