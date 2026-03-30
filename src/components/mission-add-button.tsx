"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";

type Props = {
  locale: "en" | "ko";
  missionId?: string;
  title: string;
  objective: string;
  startDate?: string;
  deadline?: string;
  bonusPoints: number;
};

const ACTIVE_MISSION_KEY = "workmonster-active-mission";
const PLAN_STORAGE_PREFIX = "workmonster-plan";

function toLocalISODate(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(input);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function MissionAddButton({ locale, missionId, title, objective, startDate = "", deadline = "", bonusPoints }: Props) {
  const isKo = locale === "ko";
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleAdd() {
    const todayKey = `${PLAN_STORAGE_PREFIX}-${toLocalISODate()}`;
    const raw = window.localStorage.getItem(todayKey);
    let parsed: Array<Record<string, unknown>> = [];
    if (raw) {
      try {
        const value = JSON.parse(raw) as Array<Record<string, unknown>>;
        parsed = Array.isArray(value) ? value : [];
      } catch (_error) {
        parsed = [];
      }
    }
    const exists = parsed.some((item) => item.linkedToMission && String(item.text ?? "").trim() === objective.trim());
    if (!exists && objective.trim().length > 0) {
      parsed.unshift({
        id: `mission-${Date.now()}`,
        text: objective.trim(),
        category: "mission",
        priority: "high",
        estimatedMinutes: 60,
        note: title.trim(),
        linkedToMission: true,
        completed: false,
        createdAt: new Date().toISOString()
      });
      window.localStorage.setItem(todayKey, JSON.stringify(parsed));
    }

    window.localStorage.setItem(
      ACTIVE_MISSION_KEY,
      JSON.stringify({
        id: missionId ?? "",
        title,
        objective,
        startDate,
        deadline,
        bonusPoints,
        acceptedAt: new Date().toISOString(),
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
