"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  locale: "en" | "ko";
};

function formatNow(locale: Props["locale"], date: Date) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function LiveTimeChip({ locale }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const text = useMemo(() => formatNow(locale, now), [locale, now]);
  return (
    <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm">
      {text}
    </span>
  );
}

