"use client";

import { useMemo, useState } from "react";
import type { Locale, Submission } from "@/lib/types";

type Props = {
  submissions: Submission[];
  locale: Locale;
  focusSubmissionId?: string;
};

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${iso}T12:00:00.000Z`));
}

function statusLabel(status: Submission["status"], locale: Locale): string {
  if (locale === "ko") {
    if (status === "approved") return "승인됨";
    if (status === "rejected") return "반려됨";
    if (status === "needs_revision") return "수정 필요";
    if (status === "draft") return "임시 저장";
    if (status === "in_review") return "검토 중";
    return "검토 대기";
  }
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "needs_revision") return "needs revision";
  if (status === "draft") return "draft";
  if (status === "in_review") return "in review";
  return "submitted";
}

function statusTone(status: Submission["status"]): string {
  if (status === "approved") return "text-emerald-700";
  if (status === "rejected") return "text-rose-700";
  if (status === "needs_revision") return "text-amber-700";
  if (status === "draft") return "text-slate-600";
  if (status === "in_review") return "text-blue-700";
  return "text-amber-700";
}

export function RecordSubmissionHistory({ submissions, locale, focusSubmissionId }: Props) {
  const [activeId, setActiveId] = useState<string | null>(focusSubmissionId ?? null);

  const active = useMemo(
    () => (activeId ? submissions.find((item) => item.id === activeId) ?? null : null),
    [activeId, submissions]
  );

  return (
    <section className="card mt-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submission history</p>
        <p className="text-xs font-semibold text-slate-500">
          {locale === "ko" ? `최근 ${submissions.length}개` : `Recent ${submissions.length}`}
        </p>
      </div>

      <ul className="mt-3 space-y-2">
        {submissions.map((item) => (
          <li id={`submission-${item.id}`} key={item.id}>
            <button
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-slate-100 active:scale-[0.99]"
              onClick={() => setActiveId(item.id)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-indigo-900">{formatDate(item.date, locale)}</p>
                <p className={`text-sm font-bold ${statusTone(item.status)}`}>
                  {statusLabel(item.status, locale)} • {item.points_awarded > 0 ? `+${item.points_awarded}` : item.points_awarded} pts
                </p>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-slate-600">
                {locale === "ko" ? "요약" : "Summary"}: {item.productive ? (locale === "ko" ? "생산적" : "Productive") : (locale === "ko" ? "비생산적" : "Non-productive")}
                {" • "}
                {item.mood || "-"}
                {" • "}
                {item.custom_answers.focus || "-"}
              </p>
            </button>
          </li>
        ))}

        {submissions.length === 0 && (
          <li className="rounded-xl bg-slate-100 p-3 text-sm text-slate-500">
            {locale === "ko" ? "아직 제출 기록이 없습니다." : "No submissions yet."}
          </li>
        )}
      </ul>

      {active && (
        <div className="fixed inset-0 z-[79] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="card w-full max-w-sm p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  {locale === "ko" ? "Submission detail" : "Submission detail"}
                </p>
                <h3 className="text-lg font-black text-indigo-900">{formatDate(active.date, locale)}</h3>
                <p className={`text-sm font-bold ${statusTone(active.status)}`}>
                  {statusLabel(active.status, locale)} • {active.points_awarded > 0 ? `+${active.points_awarded}` : active.points_awarded} pts
                </p>
              </div>
              <button className="btn btn-muted px-3 py-2 text-sm" onClick={() => setActiveId(null)} type="button">
                {locale === "ko" ? "닫기" : "Close"}
              </button>
            </div>

            <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1 text-sm">
              <article className="rounded-xl bg-slate-100 p-3 text-slate-700">
                <p>• Mood: {active.mood || "-"}</p>
                <p>• Feeling: {active.feeling || "-"}</p>
                <p>• Productive: {active.productive ? (locale === "ko" ? "Yes" : "Yes") : "No"}</p>
                <p>• Calories: {active.calories}</p>
                <p>• Focus: {active.custom_answers.focus || "-"}</p>
                <p>• Blocker: {active.custom_answers.blocker || "-"}</p>
                <p>• Win: {active.custom_answers.win || "-"}</p>
              </article>

              <article className="rounded-xl bg-slate-100 p-3 text-slate-700">
                <p className="font-semibold text-indigo-900">{locale === "ko" ? "Task log" : "Task log"}</p>
                {active.task_list.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {active.task_list.map((task, index) => (
                      <li key={`${task}-${index}`}>• {task}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-500">-</p>
                )}
              </article>

              <article className="rounded-xl bg-slate-100 p-3 text-slate-700">
                <p>• Manager note: {active.manager_note?.trim() || "-"}</p>
                {(active.bonus_points_awarded ?? 0) > 0 && (
                  <p className="mt-1 font-semibold text-amber-700">
                    🎁 Bonus +{active.bonus_points_awarded}
                    {active.bonus_message?.trim() ? ` • ${active.bonus_message}` : ""}
                  </p>
                )}
                {active.file_url?.trim() ? (
                  <a
                    className="mt-2 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800"
                    href={active.file_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {locale === "ko" ? "첨부 링크 열기" : "Open attached link"}
                  </a>
                ) : null}
              </article>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
