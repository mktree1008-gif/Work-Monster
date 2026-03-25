import Link from "next/link";
import {
  BatteryFull,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Flame,
  Gift,
  Mail,
  MoonStar,
  Sparkles,
  Utensils,
  Zap
} from "lucide-react";
import { CharacterAlert } from "@/components/character-alert";
import { QuestionsSaveCelebration } from "@/components/questions-save-celebration";
import { LiveTimeChip } from "@/components/live-time-chip";
import { UserPageShell } from "@/components/user-page-shell";
import { computeNextReward } from "@/lib/logic/scoring";
import { getManagerCue } from "@/lib/character-system";
import { getViewerContext } from "@/lib/view-model";
import { toISODate } from "@/lib/utils";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseWorkoutMinutes(text: string): number {
  if (!text.trim()) return 0;
  const minuteMatch = text.match(/(\d+)\s*(min|mins|minutes|분)/i);
  if (!minuteMatch) return 0;
  const value = Number(minuteMatch[1]);
  return Number.isFinite(value) ? value : 0;
}
function parseRecoveryPercent(text: string): number {
  if (!text.trim()) return 0;
  const percentMatch = text.match(/(\d+)\s*%/);
  if (!percentMatch) return 0;
  const value = Number(percentMatch[1]);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function missionStatusLabel(params: {
  hasMission: boolean;
  isNew: boolean;
  pending: boolean;
  completed: boolean;
  locale: "en" | "ko";
}) {
  if (!params.hasMission) return params.locale === "ko" ? "No mission yet" : "No mission yet";
  if (params.completed) return params.locale === "ko" ? "Completed" : "Completed";
  if (params.pending) return params.locale === "ko" ? "In Progress" : "In Progress";
  if (params.isNew) return params.locale === "ko" ? "New" : "New";
  return params.locale === "ko" ? "Accepted" : "Accepted";
}

function missionDeadlineText(createdAt: string, locale: "en" | "ko") {
  const base = new Date(createdAt);
  const deadline = new Date(base);
  deadline.setDate(deadline.getDate() + 2);
  const leftDays = Math.max(
    0,
    Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  );
  const formatted = deadline.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric"
  });
  return locale === "ko" ? `${formatted} (${leftDays} days left)` : `${formatted} (${leftDays} days left)`;
}

export default async function WelcomePage({ searchParams }: Props) {
  const { bundle, strings } = await getViewerContext();
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const saved = params.saved === "1";
  const updated = params.updated === "1";
  const already = params.already === "1";
  const submissionPointsRaw = typeof params.submission_points === "string" ? Number(params.submission_points) : 0;
  const submissionPointsAwarded = Number.isFinite(submissionPointsRaw) ? submissionPointsRaw : 0;

  const locale = bundle.user.locale;
  const isKo = locale === "ko";
  const managerPreview = bundle.user.role === "manager";
  const displayName = (bundle.user.name ?? "").trim() || bundle.user.login_id;

  const todayISO = toISODate(new Date());
  const todaySubmission = bundle.submissions.find((item) => item.date === todayISO) ?? bundle.submissions[0];
  const latestSubmission = bundle.submissions[0];
  const hasSubmittedToday = Boolean(todaySubmission && todaySubmission.date === todayISO);
  const pendingToday = hasSubmittedToday && todaySubmission?.status === "pending";
  const reviewedToday =
    hasSubmittedToday && (todaySubmission?.status === "approved" || todaySubmission?.status === "rejected");

  const missionNotification = bundle.notifications.find((item) => item.kind === "announcement");
  const hasMission = Boolean(missionNotification);
  const missionStatus = missionStatusLabel({
    hasMission,
    isNew: Boolean(missionNotification?.is_new),
    pending: pendingToday,
    completed: reviewedToday,
    locale
  });

  const missionTitle = missionNotification?.title?.trim() || (isKo ? "No mission yet" : "No mission yet");
  const missionObjective = missionNotification?.message?.trim() ||
    (isKo ? "No mission yet — enjoy planning your own day." : "No mission yet — enjoy planning your own day.");
  const missionDeadline = missionNotification
    ? missionDeadlineText(missionNotification.created_at, locale)
    : (isKo ? "Flexible deadline" : "Flexible deadline");

  const foodCalories = Math.max(0, todaySubmission?.calories ?? 0);
  const workoutMinutes = parseWorkoutMinutes(
    `${todaySubmission?.custom_answers?.win ?? ""} ${todaySubmission?.custom_answers?.focus ?? ""} ${todaySubmission?.custom_answers?.blocker ?? ""}`
  );
  const recoveryFromText = parseRecoveryPercent(
    `${todaySubmission?.custom_answers?.focus ?? ""} ${todaySubmission?.custom_answers?.win ?? ""} ${todaySubmission?.feeling ?? ""}`
  );
  const sleepRecovery =
    recoveryFromText > 0
      ? recoveryFromText
      : todaySubmission
        ? todaySubmission.productive
          ? 82
          : 64
        : 0;

  const nextReward = computeNextReward(bundle.score.total_points, bundle.rewards);
  const firstReward = bundle.rewards[0] ?? null;
  const firstRewardRemaining = firstReward ? Math.max(0, firstReward.required_points - bundle.score.total_points) : 0;
  const batteryProgress = Math.max(8, Math.min(100, nextReward.progressPercent));

  const managerGuideCue = getManagerCue("submission_success", locale);
  const submissionStatusLabel = todaySubmission?.status ?? "pending";
  const statusTone =
    submissionStatusLabel === "approved" ? "success" : submissionStatusLabel === "rejected" ? "warning" : "default";

  return (
    <UserPageShell
      activeTab="questions"
      labels={strings}
      subtitle={isKo ? "How was your day?" : "How was your day?"}
      title={
        <>
          <span className="block text-balance leading-[1.08]">Hello Ashton!</span>
          <span className="mt-1 block text-balance text-[0.7em] font-semibold text-indigo-700">{displayName}</span>
        </>
      }
    >
      <QuestionsSaveCelebration
        openOnMount={saved}
        pointsAwarded={submissionPointsAwarded}
        updatedMode={updated}
      />

      {already && (
        <section className="mb-4">
          <CharacterAlert
            compact
            cue={{
              spriteName: "manager_curious",
              expression: "wide-eyes",
              emoji: "🗓️",
              title: isKo ? "오늘 체크인은 이미 제출됐어요" : "Today's check-in is already submitted",
              message: isKo
                ? "이미 제출된 내용을 수정하면 최신 pending 버전으로 매니저에게 전달됩니다."
                : "If you edit while pending, only your latest pending version is shown to manager."
            }}
            role="manager"
            tone="warning"
          />
        </section>
      )}

      <section className="mb-3 flex items-center justify-between">
        <LiveTimeChip locale={locale} />
        <p className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
          <BellRing size={14} />
          {bundle.unread_notification_count > 0
            ? `${bundle.unread_notification_count} new`
            : isKo
              ? "No new"
              : "No new"}
        </p>
      </section>

      <section className="card anim-pop mb-4 overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Plan Your Day</p>
            <h2 className="mt-1 text-[1.75rem] font-black leading-tight text-indigo-900">Start Planning</h2>
            <p className="mt-1 text-sm text-slate-600">
              {todaySubmission?.task_list?.length
                ? `${todaySubmission.task_list.length} items drafted for today`
                : "Set top priorities and build your checklist."}
            </p>
            <Link className="btn btn-energetic mt-3 inline-flex items-center gap-2" href="/app/plan">
              <ClipboardList size={16} />
              {isKo ? "Start Planning" : "Start Planning"}
            </Link>
          </div>
          <div className="relative mt-1 h-24 w-24 shrink-0 rounded-2xl bg-gradient-to-br from-amber-100 via-indigo-100 to-cyan-100 p-3">
            <Mail className={hasMission ? "anim-bounce-soft text-amber-500" : "text-indigo-300"} size={30} />
            <Sparkles className="absolute right-2 top-2 text-amber-400" size={16} />
          </div>
        </div>
      </section>

      <section className="card mb-4 overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Mission from Manager</p>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
              hasMission
                ? missionNotification?.is_new
                  ? "bg-amber-100 text-amber-700"
                  : "bg-indigo-100 text-indigo-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {missionStatus}
          </span>
        </div>
        <p className="mt-2 text-lg font-black text-indigo-900">{missionTitle}</p>
        <p className="mt-1 text-sm text-slate-700">{missionObjective}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
          <CalendarClock size={12} />
          Deadline: {missionDeadline}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link className="btn btn-muted flex items-center justify-center" href="/app/mission">
            {isKo ? "Open mission" : "Open mission"}
          </Link>
          <Link className="btn btn-primary flex items-center justify-center gap-2" href="/app/plan">
            <Zap size={15} />
            {isKo ? "Add mission to plan" : "Add mission to plan"}
          </Link>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-3 gap-2">
        <Link className="card p-3" href="/app/record?section=food">
          <p className="inline-flex items-center gap-1 text-sm font-bold text-indigo-900">
            <Utensils className="text-amber-500" size={15} />
            Food
          </p>
          <p className="mt-2 text-xl font-black text-indigo-900">{foodCalories.toLocaleString()}</p>
          <p className="text-xs text-slate-500">cal logged</p>
        </Link>
        <Link className="card p-3" href="/app/record?section=workout">
          <p className="inline-flex items-center gap-1 text-sm font-bold text-indigo-900">
            <Zap className="text-violet-500" size={15} />
            Workout
          </p>
          <p className="mt-2 text-xl font-black text-indigo-900">{workoutMinutes}</p>
          <p className="text-xs text-slate-500">mins logged</p>
        </Link>
        <Link className="card p-3" href="/app/record?section=sleep">
          <p className="inline-flex items-center gap-1 text-sm font-bold text-indigo-900">
            <MoonStar className="text-cyan-500" size={15} />
            Sleep
          </p>
          <p className="mt-2 text-xl font-black text-indigo-900">{sleepRecovery}</p>
          <p className="text-xs text-slate-500">% recovery</p>
        </Link>
      </section>

      <section className="card anim-pop mb-4 overflow-hidden p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Current Momentum</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-5xl font-black leading-none text-indigo-900">{bundle.score.total_points}</p>
            <p className="mt-1 text-sm text-slate-600">
              {bundle.score.current_streak}-day streak • Lifetime {bundle.score.lifetime_points} pts
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
              bundle.score.total_points < 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {bundle.score.total_points < 0 ? strings.riskZone : "Safe Zone"}
          </span>
        </div>

        <div className="mt-3 rounded-2xl bg-slate-100 p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1">
              <BatteryFull size={14} />
              Reward battery
            </span>
            <span>{batteryProgress}%</span>
          </div>
          <div className="mt-2 h-9 overflow-hidden rounded-full border border-indigo-200 bg-white px-1 py-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-400 transition-all duration-700"
              style={{ width: `${batteryProgress}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-semibold text-indigo-900">
            {nextReward.reward ? `Next Reward ${nextReward.reward.title} in ${nextReward.pointsRemaining} pts` : "All rewards unlocked"}
          </p>
          {firstReward && (
            <p className="text-xs text-slate-500">
              {firstReward.title}: {firstRewardRemaining} pts left
            </p>
          )}
          {bundle.score.multiplier_active && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
              <Flame size={12} />
              {bundle.score.multiplier_value.toFixed(1)}x multiplier active
            </p>
          )}
        </div>
      </section>

      <section className="card mb-4 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Daily Check-In</p>
        <p className="mt-2 text-lg font-black text-indigo-900">How was your day? 🙂 😌 😊 😄</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li>✓ Did you complete your checklist?</li>
          <li>✓ How was your food/calorie intake?</li>
          <li>✓ Did you get some exercise?</li>
          <li>✓ Did you get enough sleep?</li>
        </ul>

        {todaySubmission && (
          <div className="mt-3">
            <CharacterAlert
              compact
              cue={{
                ...managerGuideCue,
                title: submissionStatusLabel === "approved"
                  ? "Manager approved your latest check-in"
                  : submissionStatusLabel === "rejected"
                    ? "Manager reviewed your latest check-in"
                    : "Today's check-in is pending review",
                message:
                  submissionStatusLabel === "approved"
                    ? `+${todaySubmission.points_awarded} pts confirmed.`
                    : submissionStatusLabel === "rejected"
                      ? `${todaySubmission.points_awarded} pts. Keep going tomorrow.`
                      : "You can still edit before manager review."
              }}
              role="manager"
              tone={statusTone}
            />
          </div>
        )}

        {managerPreview ? (
          <button className="btn btn-muted mt-4 w-full cursor-not-allowed opacity-70" disabled type="button">
            Manager preview: user check-in disabled
          </button>
        ) : (
          <Link className="btn btn-primary mt-4 flex w-full items-center justify-center gap-2" href="/app/questions/check-in">
            <CheckCircle2 size={16} />
            {pendingToday ? "Edit pending check-in" : reviewedToday ? "View today's review" : "Start Check-In"}
          </Link>
        )}
      </section>

      {latestSubmission && (
        <section className="card mb-4 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Daily summary snapshot</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Checklist</p>
              <p className="mt-1 font-bold text-indigo-900">{latestSubmission.task_list.length} tasks</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Mission</p>
              <p className="mt-1 font-bold text-indigo-900">{hasMission ? missionStatus : "Self-led day"}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Health logs</p>
              <p className="mt-1 font-bold text-indigo-900">
                {foodCalories} cal / {workoutMinutes} min / {sleepRecovery}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Review status</p>
              <p className="mt-1 font-bold text-indigo-900">{latestSubmission.status.toUpperCase()}</p>
            </div>
          </div>
          <Link className="btn btn-muted mt-3 w-full" href="/app/record">
            Open full record
          </Link>
        </section>
      )}

      <section className="mb-2 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800">
        <p className="inline-flex items-center gap-2 font-semibold">
          <Gift size={15} />
          {isKo
            ? "관리당하는 느낌보다, 매일 함께 성장하는 게임 같은 리듬을 목표로 디자인되었습니다."
            : "Built to feel like supportive growth with game rhythm, not harsh surveillance."}
        </p>
      </section>
    </UserPageShell>
  );
}
