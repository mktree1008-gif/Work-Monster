"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";

type Props = {
  locale: "en" | "ko";
  title: string;
  objective: string;
  bonusPoints: number;
};

const ACTIVE_MISSION_KEY = "workmonster-active-mission";

export function MissionAddButton({ locale, title, objective, bonusPoints }: Props) {
  const isKo = locale === "ko";
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleAdd() {
    window.localStorage.setItem(
      ACTIVE_MISSION_KEY,
      JSON.stringify({
        title,
        objective,
        bonusPoints,
        savedAt: new Date().toISOString()
      })
    );
    setSaved(true);
  }

  return (
    <div className="space-y-2">
      <button className="btn btn-energetic w-full" onClick={handleAdd} type="button">
        <span className="inline-flex items-center gap-2">
          <Sparkles size={16} />
          {isKo ? "오늘 계획에 미션 추가" : "Add mission to my plan"}
        </span>
      </button>
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 size={15} />
            {isKo ? "추가 완료! Plan 페이지로 이동해 체크리스트에서 확인하세요." : "Added. Open Plan page to see it in your checklist."}
          </span>
          <button
            className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700"
            onClick={() => router.push("/app/plan")}
            type="button"
          >
            {isKo ? "Plan 열기" : "Open plan"}
          </button>
        </div>
      )}
    </div>
  );
}

