"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ProductivityRecordSystem } from "@/components/record/productivity-record-system";
import { RecordPointsCalendar, type RecordPointDay } from "@/components/record-points-calendar";
import { RecordSubmissionHistory } from "@/components/record-submission-history";
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
  recordCalendarDays: RecordPointDay[];
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
  recordCalendarDays,
  initialWellnessSection,
  focusSubmissionId
}: Props) {
  const [view, setView] = useState<ViewMode>(initialWellnessSection || focusSubmissionId ? "wellness" : "productivity");

  const recentSubmissions = useMemo(() => submissions.slice(0, 6), [submissions]);

  return (
    <div className="space-y-4">
      <section className="card p-1.5">
        <div className="grid grid-cols-2 gap-1">
          <button
            className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
              view === "productivity" ? "bg-blue-700 text-white shadow-sm" : "bg-transparent text-slate-600"
            }`}
            onClick={() => setView("productivity")}
            type="button"
          >
            {locale === "ko" ? "Productivity" : "Productivity"}
          </button>
          <button
            className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
              view === "wellness" ? "bg-blue-700 text-white shadow-sm" : "bg-transparent text-slate-600"
            }`}
            onClick={() => setView("wellness")}
            type="button"
          >
            Wellness
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
        <>
          <section className="card p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-indigo-600" size={18} />
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Points calendar</p>
            </div>
            <RecordPointsCalendar days={recordCalendarDays} locale={locale} />
          </section>
          <RecordSubmissionHistory
            focusSubmissionId={focusSubmissionId}
            locale={locale}
            submissions={recentSubmissions}
          />
          <WellnessRecordSections
            initialSection={initialWellnessSection}
            penaltyHistory={penaltyHistory}
            rewardClaims={rewardClaims}
            submissions={submissions}
          />
        </>
      )}
    </div>
  );
}
