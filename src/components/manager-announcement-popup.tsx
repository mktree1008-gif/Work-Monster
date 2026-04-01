"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Megaphone } from "lucide-react";

type Props = {
  openOnMount: boolean;
  locale: "en" | "ko";
  notificationId: string;
  title: string;
  message: string;
  createdAt: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaLink?: string;
};

function seenKey(notificationId: string): string {
  return `wm-announcement-popup-seen:${notificationId}`;
}

export function ManagerAnnouncementPopup({
  openOnMount,
  locale,
  notificationId,
  title,
  message,
  createdAt,
  imageUrl,
  ctaLabel,
  ctaLink
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isKo = locale === "ko";

  useEffect(() => {
    if (!openOnMount) return;
    const key = seenKey(notificationId);
    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // ignore storage read errors
    }

    const timer = window.setTimeout(() => setOpen(true), 180);
    return () => window.clearTimeout(timer);
  }, [notificationId, openOnMount]);

  const createdLabel = useMemo(() => {
    try {
      return new Date(createdAt).toLocaleString(isKo ? "ko-KR" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return createdAt;
    }
  }, [createdAt, isKo]);

  function closePopup() {
    setOpen(false);
    try {
      window.localStorage.setItem(seenKey(notificationId), "1");
    } catch {
      // ignore storage write errors
    }
  }

  function openNotificationCenter() {
    window.dispatchEvent(new CustomEvent("workmonster:open-notifications"));
    closePopup();
  }

  function openAnnouncementLink() {
    if (!ctaLink) return;
    router.push(ctaLink);
    closePopup();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/45 p-4">
      <article className="container-mobile anim-pop w-full max-w-[26.5rem] rounded-[1.6rem] border border-indigo-100 bg-white p-5 shadow-[0_26px_56px_rgba(15,23,42,0.28)]">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
          <Megaphone size={14} />
          {isKo ? "Manager Announcement" : "Manager Announcement"}
        </p>
        <h3 className="mt-2 text-[1.28rem] font-bold leading-tight tracking-[-0.01em] text-slate-900">{title}</h3>
        <p className="mt-2 whitespace-pre-line break-words text-[14px] leading-relaxed text-slate-600">{message}</p>

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Manager announcement" className="mt-3 max-h-60 w-full rounded-xl object-cover" src={imageUrl} />
        )}

        <p className="mt-2 text-[11px] font-medium text-slate-500">{createdLabel}</p>

        <div className="mt-4 flex gap-2">
          <button className="btn btn-muted flex-1" onClick={closePopup} type="button">
            {isKo ? "닫기" : "Close"}
          </button>
          {ctaLink ? (
            <button className="btn btn-primary flex-1" onClick={openAnnouncementLink} type="button">
              <span className="inline-flex items-center gap-1">
                {ctaLabel?.trim() || (isKo ? "바로 보기" : "Open")}
                <ChevronRight size={14} />
              </span>
            </button>
          ) : (
            <button className="btn btn-primary flex-1" onClick={openNotificationCenter} type="button">
              <span className="inline-flex items-center gap-1">
                <Bell size={14} />
                {isKo ? "알림센터" : "Notifications"}
              </span>
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

