import { CalendarDays } from "lucide-react";
import { RecordPointsCalendar } from "@/components/record-points-calendar";
import type { RecordPointDay, RecordPointEvent } from "@/components/record-points-calendar";
import { RecordSubmissionHistory } from "@/components/record-submission-history";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { UserPageShell } from "@/components/user-page-shell";
import { formatDateLabel, isISODateString, toISODate } from "@/lib/utils";
import { getViewerContext } from "@/lib/view-model";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function shiftISODate(baseISO: string, offsetDays: number): string {
  const date = new Date(`${baseISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function toSafePoints(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function extractISODate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return isISODateString(normalized) ? normalized : null;
}

function toMonthLabel(dateISO: string, locale: "en" | "ko"): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${dateISO}T12:00:00.000Z`));
}

function buildReviewDetail(
  points: number,
  basePoints: number,
  bonusPoints: number,
  locale: "en" | "ko"
): string {
  if (bonusPoints > 0) {
    if (locale === "ko") {
      return `기본 ${basePoints > 0 ? `+${basePoints}` : basePoints} + 보너스 +${bonusPoints}`;
    }
    return `Base ${basePoints > 0 ? `+${basePoints}` : basePoints} + bonus +${bonusPoints}`;
  }

  if (locale === "ko") {
    return `최종 반영 ${points > 0 ? `+${points}` : points} pts`;
  }
  return `Applied ${points > 0 ? `+${points}` : points} pts`;
}

export default async function RecordPage({ searchParams }: Props) {
  const { bundle, strings } = await getViewerContext();
  const repo = getGameRepository();
  const logs = await repo.listAuditLogs(2000);
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const focusSubmissionId = typeof params.focus === "string" ? params.focus : "";
  const isKo = bundle.user.locale === "ko";
  const latestSubmissionByDate = new Map<string, (typeof bundle.submissions)[number]>();
  for (const submission of bundle.submissions) {
    if (!latestSubmissionByDate.has(submission.date)) {
      latestSubmissionByDate.set(submission.date, submission);
    }
  }
  const productivityBars = [...latestSubmissionByDate.values()]
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(-7);

  const approved = productivityBars.filter((item) => item.status === "approved");
  const avgCalories =
    productivityBars.length > 0
      ? Math.round(productivityBars.reduce((sum, item) => sum + item.calories, 0) / productivityBars.length)
      : 0;
  const todayISO = toISODate();
  const submissionById = new Map(bundle.submissions.map((submission) => [submission.id, submission]));
  const submissionIdSet = new Set(bundle.submissions.map((submission) => submission.id));
  const pointEvents: RecordPointEvent[] = [];
  const reviewedByLog = new Set<string>();

  for (const log of logs) {
    if (log.action === "login.base_points_awarded" && log.actor_user_id === bundle.user.id) {
      const points = toSafePoints(log.details.points);
      const eventDate = extractISODate(log.details.date) ?? extractISODate(log.created_at.slice(0, 10)) ?? todayISO;
      pointEvents.push({
        id: log.id,
        action: "login",
        created_at: log.created_at,
        date: eventDate,
        delta: points,
        title: isKo ? "로그인 베이스 포인트" : "Daily login base points",
        detail: isKo
          ? `${points > 0 ? `+${points}` : points} pts가 로그인 보상으로 반영되었습니다.`
          : `${points > 0 ? `+${points}` : points} pts applied from daily login.`
      });
      continue;
    }

    if (log.action === "submission.base_points_awarded" && log.actor_user_id === bundle.user.id) {
      const points = toSafePoints(log.details.points);
      const fromSubmission = submissionById.get(log.target_id)?.date;
      const eventDate = extractISODate(log.details.date) ?? fromSubmission ?? todayISO;
      pointEvents.push({
        id: log.id,
        action: "checkin_submit",
        created_at: log.created_at,
        date: eventDate,
        delta: points,
        title: isKo ? "체크인 제출 베이스 포인트" : "Check-in submit base points",
        detail: isKo
          ? `${points > 0 ? `+${points}` : points} pts가 제출 보상으로 반영되었습니다.`
          : `${points > 0 ? `+${points}` : points} pts applied after check-in submit.`
      });
      continue;
    }

    if (log.action === "submission.reviewed" && submissionIdSet.has(log.target_id)) {
      reviewedByLog.add(log.target_id);
      const linkedSubmission = submissionById.get(log.target_id);
      const eventDate = linkedSubmission?.date ?? todayISO;
      const points = toSafePoints(log.details.points);
      const basePoints = toSafePoints(log.details.base_points);
      const bonusPoints = toSafePoints(log.details.bonus_points);
      const note = String(log.details.note ?? "").trim();
      const bonusMessage = String(log.details.bonus_message ?? "").trim();
      const managerMessage = [note, bonusMessage].filter((item) => item.length > 0).join(" • ");
      let title = isKo ? "매니저 리뷰 반영" : "Manager review applied";
      if (points > 0) {
        title = isKo ? "매니저가 점수를 지급했어요" : "Manager awarded points";
      } else if (points < 0) {
        title = isKo ? "매니저가 감점 점수를 반영했어요" : "Manager applied deduction";
      }
      pointEvents.push({
        id: log.id,
        action: "manager_review",
        created_at: log.created_at,
        date: eventDate,
        delta: points,
        title,
        detail: buildReviewDetail(points, basePoints, bonusPoints, bundle.user.locale),
        manager_message: managerMessage || undefined
      });
    }
  }

  for (const submission of bundle.submissions) {
    if (submission.status === "pending" || reviewedByLog.has(submission.id)) {
      continue;
    }
    const managerMessage = [submission.manager_note?.trim() ?? "", submission.bonus_message?.trim() ?? ""]
      .filter((item) => item.length > 0)
      .join(" • ");
    pointEvents.push({
      id: `fallback-review-${submission.id}`,
      action: "manager_review",
      created_at: submission.reviewed_at ?? submission.created_at,
      date: submission.date,
      delta: submission.points_awarded,
      title: isKo ? "매니저 리뷰 반영" : "Manager review applied",
      detail: buildReviewDetail(
        submission.points_awarded,
        submission.base_points_awarded ?? submission.points_awarded,
        submission.bonus_points_awarded ?? 0,
        bundle.user.locale
      ),
      manager_message: managerMessage || undefined
    });
  }

  const eventDates = pointEvents.map((event) => event.date).filter((date) => isISODateString(date));
  const submissionDates = bundle.submissions.map((submission) => submission.date).filter((date) => isISODateString(date));
  const rangeSource = [...eventDates, ...submissionDates, todayISO];
  const sortedRange = [...rangeSource].sort((a, b) => (a > b ? 1 : -1));
  const calendarEndDate = sortedRange.at(-1) ?? todayISO;
  const calendarDays = Array.from({ length: 56 }, (_, index) => shiftISODate(calendarEndDate, index - 55));

  const eventsByDate = new Map<string, RecordPointEvent[]>();
  for (const event of pointEvents) {
    const found = eventsByDate.get(event.date) ?? [];
    found.push(event);
    eventsByDate.set(event.date, found);
  }
  for (const [date, events] of eventsByDate) {
    events.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    eventsByDate.set(date, events);
  }

  const recordCalendarDays: RecordPointDay[] = calendarDays.map((date) => {
    const events = eventsByDate.get(date) ?? [];
    const delta = events.reduce((sum, event) => sum + event.delta, 0);
    const managerMessages = [...new Set(events.map((event) => event.manager_message).filter((item): item is string => Boolean(item)))];
    return {
      date,
      day: Number(date.slice(8, 10)),
      monthKey: date.slice(0, 7),
      monthLabel: toMonthLabel(date, bundle.user.locale),
      delta,
      events,
      managerMessages
    };
  });

  const baseRecentSubmissions = bundle.submissions.slice(0, 5);
  const focusedSubmission = focusSubmissionId
    ? bundle.submissions.find((submission) => submission.id === focusSubmissionId) ?? null
    : null;
  const recentSubmissions =
    focusedSubmission && !baseRecentSubmissions.some((submission) => submission.id === focusedSubmission.id)
      ? [focusedSubmission, ...baseRecentSubmissions].slice(0, 5)
      : baseRecentSubmissions;

  return (
    <UserPageShell activeTab="record" labels={strings} subtitle="Your momentum map" title="Record">
      <section className="grid grid-cols-2 gap-3">
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">💰 Avg calories</p>
          <p className="mt-2 text-3xl font-black text-indigo-900">{avgCalories}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">🔥 Approved this week</p>
          <p className="mt-2 text-3xl font-black text-indigo-900">{approved.length}</p>
        </article>
      </section>

      <section className="card mt-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Productivity bars</p>
        <div className="mt-3 flex items-end gap-2">
          {productivityBars.map((item) => (
            <div key={item.id} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-xl ${item.productive ? "bg-emerald-500" : "bg-amber-400"}`}
                style={{ height: `${item.productive ? 80 : 45}px` }}
              />
              <span className="text-[10px] text-slate-500">{formatDateLabel(item.date)}</span>
            </div>
          ))}
          {productivityBars.length === 0 && <p className="text-sm text-slate-500">No check-in history yet.</p>}
        </div>
      </section>

      <section className="card mt-4 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-indigo-600" size={18} />
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Points calendar</p>
        </div>
        <RecordPointsCalendar days={recordCalendarDays} locale={bundle.user.locale} />
      </section>

      <RecordSubmissionHistory
        focusSubmissionId={focusSubmissionId}
        locale={bundle.user.locale}
        submissions={recentSubmissions}
      />
    </UserPageShell>
  );
}
