import { AlertTriangle, Flame, Sparkles } from "lucide-react";
import { CharacterAlert } from "@/components/character-alert";
import { CharacterToast } from "@/components/character-toast";
import { RecordPointsCalendar, type RecordPointDay, type RecordPointEvent } from "@/components/record-points-calendar";
import { ScoreAchievementPopup } from "@/components/score-achievement-popup";
import { getManagerCue, getUserCue } from "@/lib/character-system";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { UserPageShell } from "@/components/user-page-shell";
import { computeNextReward } from "@/lib/logic/scoring";
import { localizeRuleLongText } from "@/lib/rules-copy";
import { isISODateString, toISODate } from "@/lib/utils";
import { getViewerContext } from "@/lib/view-model";

type DailyLine = {
  title: string;
  message: string;
  emoji: string;
};

function pickDailyLine(lines: DailyLine[], seedSource: string): DailyLine {
  const seed = [...seedSource].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return lines[seed % lines.length];
}

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

export default async function ScorePage() {
  const { bundle, strings } = await getViewerContext();
  const repo = getGameRepository();
  const logs = await repo.listAuditLogs(2000);
  const nextReward = computeNextReward(bundle.score.total_points, bundle.rewards);
  const openEvents = bundle.penaltyHistory.filter((event) => event.recovered_at === undefined);
  const managerRewardUnlocked = openEvents.some((event) => event.manager_reward_unlocked);
  const baseUserScoreCue = getUserCue(bundle.score.total_points < 0 ? "score_nervous" : "score_confident", bundle.user.locale);
  const isKo = bundle.user.locale === "ko";
  const positiveLines: DailyLine[] = isKo
    ? [
        { title: "🌟 오늘도 상승 무드!", message: "작은 승리가 모이면 큰 도약이 돼요. 지금 페이스 최고예요.", emoji: "✨" },
        { title: "😺 리듬이 아주 좋아요", message: "포인트가 플러스예요. 오늘 한 번 더 쌓아보면 더 멀리 가요.", emoji: "💚" },
        { title: "🔥 좋은 흐름 유지 중", message: "지금처럼만 가면 다음 리워드까지 금방 도착해요.", emoji: "🎯" }
      ]
    : [
        { title: "🌟 You are on a roll!", message: "Small wins stack into big momentum. Keep this flow going.", emoji: "✨" },
        { title: "😺 Solid rhythm today", message: "Your points are positive. One more win will push you further.", emoji: "💚" },
        { title: "🔥 Momentum is strong", message: "At this pace, your next reward is closer than it looks.", emoji: "🎯" }
      ];
  const negativeLines: DailyLine[] = isKo
    ? [
        { title: "😈 리커버리 모드 ON", message: "지금은 잠깐 흔들린 구간이에요. 다음 승인 1회로 흐름을 되돌릴 수 있어요.", emoji: "⚠️" },
        { title: "😤 다시 올라갈 타이밍", message: "오늘 체크인 하나가 분위기를 바꿔요. 천천히 회복해봐요.", emoji: "🧡" },
        { title: "🫤 괜찮아요, 아직 게임 중!", message: "점수는 언제든 회복 가능해요. 다음 기록에서 다시 시작해요.", emoji: "🔧" }
      ]
    : [
        { title: "😈 Recovery mode ON", message: "This is a dip, not the end. One approved check-in can turn it around.", emoji: "⚠️" },
        { title: "😤 Time to bounce back", message: "A single check-in today can shift your momentum upward.", emoji: "🧡" },
        { title: "🫤 Still in the game", message: "Your score can recover anytime. Restart with your next entry.", emoji: "🔧" }
      ];
  const dailyLine = bundle.score.total_points < 0
    ? pickDailyLine(negativeLines, `${bundle.user.id}-${toISODate()}-neg`)
    : pickDailyLine(positiveLines, `${bundle.user.id}-${toISODate()}-pos`);
  const userScoreCue = {
    ...baseUserScoreCue,
    title: dailyLine.title,
    message: dailyLine.message,
    emoji: dailyLine.emoji
  };
  const penaltyCue = getManagerCue("penalty_zone_wink", bundle.user.locale);
  const milestoneUnlocked =
    bundle.score.current_streak >= bundle.rules.streak_days ||
    bundle.score.multiplier_active ||
    bundle.rewardClaims.some((claim) => claim.status === "claimed");
  const milestoneCue = getUserCue("milestone_jump", bundle.user.locale);
  const majorPenalty = bundle.score.total_points <= -10 || openEvents.some((event) => event.threshold <= -10);
  const majorPenaltyCue = getUserCue("major_penalty_sad", bundle.user.locale);
  const localizedPenaltyDescription = localizeRuleLongText(bundle.rules.penalty_description, bundle.user.locale);
  const currentPointsToneClass =
    bundle.score.total_points > 0
      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-100"
      : bundle.score.total_points < 0
        ? "border-rose-200 bg-gradient-to-br from-rose-50 to-red-100"
        : "border-slate-200 bg-white";
  const currentPointsTextClass =
    bundle.score.total_points > 0
      ? "text-emerald-700"
      : bundle.score.total_points < 0
        ? "text-rose-700"
        : "text-indigo-900";
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
      continue;
    }
  }

  for (const submission of bundle.submissions) {
    if (
      submission.status === "pending"
      || submission.status === "submitted"
      || submission.status === "in_review"
      || submission.status === "draft"
      || reviewedByLog.has(submission.id)
    ) {
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

  return (
    <UserPageShell activeTab="score" labels={strings} subtitle="Game HUD" title="Score">
      <ScoreAchievementPopup
        currentStreak={bundle.score.current_streak}
        multiplierActive={bundle.score.multiplier_active}
        multiplierValue={bundle.score.multiplier_value}
        nextRewardProgress={nextReward.progressPercent}
        totalPoints={bundle.score.total_points}
      />
      <CharacterToast cue={penaltyCue} openOnMount={bundle.score.penalty_active} role="manager" tone="warning" />

      <section className="mb-4">
        <CharacterAlert cue={userScoreCue} role="user" showExpressionBadge={false} showSpriteName={false} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <article className={`card border p-4 ${currentPointsToneClass}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">💰 Current points</p>
          <p className={`mt-1 text-[clamp(1.55rem,7vw,2.2rem)] font-black ${currentPointsTextClass}`}>{bundle.score.total_points}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">⭐ Lifetime points</p>
          <p className="mt-1 text-[clamp(1.55rem,7vw,2.2rem)] font-black text-indigo-900">{bundle.score.lifetime_points}</p>
        </article>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <article className="card p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Flame size={18} />
            <p className="text-xs uppercase tracking-[0.2em]">🔥 Streak</p>
          </div>
          <p className="mt-1 text-[clamp(1.4rem,6.3vw,1.9rem)] font-black text-indigo-900">{bundle.score.current_streak}</p>
          {bundle.score.current_streak >= 7 && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
              🏃🔥 7-Day Streak
            </p>
          )}
        </article>
        <article className="card p-4">
          <div className="flex items-center gap-2 text-indigo-500">
            <Sparkles size={18} />
            <p className="text-xs uppercase tracking-[0.2em]">⭐ Multiplier</p>
          </div>
          <p className="mt-1 text-[clamp(1.4rem,6.3vw,1.9rem)] font-black text-indigo-900">x{bundle.score.multiplier_value.toFixed(1)}</p>
        </article>
      </section>

      <section className="card mt-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">🎁 Next reward</p>
        <p className="mt-1 text-lg font-bold text-indigo-900">
          {nextReward.reward ? `${nextReward.reward.title} in ${nextReward.pointsRemaining} pts` : "All unlocked"}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${nextReward.progressPercent}%` }} />
        </div>
      </section>

      <section className="card mt-4 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Points Calendar</p>
        <RecordPointsCalendar days={recordCalendarDays} locale={bundle.user.locale} />
      </section>

      <section className="card mt-4 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className={bundle.score.penalty_active ? "text-rose-600" : "text-emerald-600"} />
          <h2 className="text-lg font-black text-indigo-900">
            {bundle.score.penalty_active ? "Risk Zone Active" : "Safe Zone"}
          </h2>
          {bundle.score.penalty_active && (
            <span className="anim-pulse-soft rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
              WATCH OUT! Risk Level Active.
            </span>
          )}
        </div>

        <p className="mt-2 text-sm font-semibold text-slate-600">
          {bundle.score.penalty_active ? "Penalty Active" : "Penalty inactive"}
        </p>
        <p className="text-sm text-slate-500">Negative balance: {bundle.score.negative_balance}</p>
        <p className="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{localizedPenaltyDescription}</p>
        <p className="mt-2 text-sm text-emerald-700">You can recover by earning points.</p>
        {managerRewardUnlocked && (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
            Manager reward unlocked
          </p>
        )}
        {majorPenalty && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            <span className="relative inline-flex h-8 w-8 items-center justify-center">
              <span className="text-2xl">💰</span>
              <span className="absolute inset-0 flex items-center justify-center text-xl text-rose-600">⛔</span>
            </span>
            Major Penalty -10 PTS visual
          </div>
        )}
        {bundle.score.penalty_active && (
          <div className="mt-3">
            <CharacterAlert role="manager" cue={penaltyCue} compact tone="warning" />
          </div>
        )}
      </section>

      {milestoneUnlocked && (
        <section className="mt-4">
          <CharacterAlert role="user" cue={milestoneCue} tone="success" />
        </section>
      )}

      {majorPenalty && (
        <section className="mt-4">
          <CharacterAlert role="user" cue={majorPenaltyCue} tone="warning" />
        </section>
      )}

      {bundle.score.total_points >= 150 && (
        <section className="card mt-4 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Premium milestone</p>
          <p className="mt-1 text-lg font-black text-indigo-900">👑 Premium Reward Tier unlocked (150+ pts)</p>
          <p className="text-sm text-slate-600">Crown milestone active. Keep stacking approvals.</p>
        </section>
      )}
    </UserPageShell>
  );
}
