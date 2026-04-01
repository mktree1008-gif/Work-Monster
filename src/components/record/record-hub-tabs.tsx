"use client";

import { useState } from "react";
import { ProductivityRecordSystem } from "@/components/record/productivity-record-system";
import { WellnessRecordSections } from "@/components/wellness/wellness-record-sections";
import type { AppNotification, Locale, PenaltyEvent, RewardClaim, ScoreState, Submission } from "@/lib/types";

type ViewMode = "productivity" | "wellness";

type Props = {
  locale: Locale;
  userId: string;
  score: ScoreState;
  submissions: Submission[];
  notifications: AppNotification[];
  rewardClaims: RewardClaim[];
  penaltyHistory: PenaltyEvent[];
  initialWellnessSection?: string;
  focusSubmissionId?: string;
};

export function RecordHubTabs({
  locale,
  userId,
  score,
  submissions,
  notifications,
  rewardClaims,
  penaltyHistory,
  initialWellnessSection,
  focusSubmissionId
}: Props) {
  const [view, setView] = useState<ViewMode>(initialWellnessSection || focusSubmissionId ? "wellness" : "productivity");
  const isProductivity = view === "productivity";
  const isWellness = view === "wellness";

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden border border-blue-100/80 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/40 p-1.5 shadow-[0_10px_30px_rgba(59,130,246,0.12)]">
        <div className="grid grid-cols-2 gap-1">
          <button
            className={`group relative rounded-2xl px-4 py-2.5 text-[1.03rem] font-black tracking-tight transition-all duration-200 ${
              isProductivity
                ? "bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.34)]"
                : "bg-transparent text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => setView("productivity")}
            type="button"
          >
            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${isProductivity ? "drop-shadow-sm" : ""}`}>
              <span className={`text-[1.04rem] ${isProductivity ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""}`} role="img" aria-label="man working on laptop">👨‍💻</span>
              {locale === "ko" ? "Productivity" : "Productivity"}
            </span>
            {isProductivity && <span className="pointer-events-none absolute right-3 top-2 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.95)]" />}
          </button>
          <button
            className={`group relative rounded-2xl px-4 py-2.5 text-[1.03rem] font-black tracking-tight transition-all duration-200 ${
              isWellness
                ? "bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 text-white shadow-[0_10px_24px_rgba(20,184,166,0.3)]"
                : "bg-transparent text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => setView("wellness")}
            type="button"
          >
            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${isWellness ? "drop-shadow-sm" : ""}`}>
              <span className={`text-[1.04rem] ${isWellness ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""}`} role="img" aria-label="man lifting weights">🏋️‍♂️</span>
              Wellness
            </span>
            {isWellness && <span className="pointer-events-none absolute right-3 top-2 h-2 w-2 rounded-full bg-emerald-200 shadow-[0_0_12px_rgba(110,231,183,0.95)]" />}
          </button>
        </div>
      </section>

      {view === "productivity" ? (
        <ProductivityRecordSystem
          locale={locale}
          mode="hub"
          notifications={notifications}
          score={score}
          submissions={submissions}
          userId={userId}
        />
      ) : (
        <WellnessRecordSections
          initialSection={initialWellnessSection}
          penaltyHistory={penaltyHistory}
          rewardClaims={rewardClaims}
          submissions={submissions}
        />
      )}
    </div>
  );
}
