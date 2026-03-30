"use client";

import { BellRing } from "lucide-react";
import { Locale } from "@/lib/types";

type Props = {
  unreadCount: number;
  locale: Locale;
};

export function NotificationShortcutChip({ unreadCount, locale }: Props) {
  const isKo = locale === "ko";
  const label = unreadCount > 0 ? `${unreadCount} new` : isKo ? "No new" : "No new";

  return (
    <button
      className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
      onClick={() => window.dispatchEvent(new CustomEvent("workmonster:open-notifications"))}
      type="button"
    >
      <BellRing size={14} />
      {label}
    </button>
  );
}

