import { AlertTriangle, Flame, Sparkles } from "lucide-react";
import { CharacterAlert } from "@/components/character-alert";
import { CharacterToast } from "@/components/character-toast";
import { ScoreAchievementPopup } from "@/components/score-achievement-popup";
import { getManagerCue, getUserCue } from "@/lib/character-system";
import { UserPageShell } from "@/components/user-page-shell";
import { computeNextReward } from "@/lib/logic/scoring";
import { localizeRuleLongText } from "@/lib/rules-copy";
import { toISODate } from "@/lib/utils";
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

export default async function ScorePage() {
  const { bundle, strings } = await getViewerContext();
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
          <p className={`mt-1 text-4xl font-black ${currentPointsTextClass}`}>{bundle.score.total_points}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">⭐ Lifetime points</p>
          <p className="mt-1 text-4xl font-black text-indigo-900">{bundle.score.lifetime_points}</p>
        </article>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <article className="card p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Flame size={18} />
            <p className="text-xs uppercase tracking-[0.2em]">🔥 Streak</p>
          </div>
          <p className="mt-1 text-3xl font-black text-indigo-900">{bundle.score.current_streak}</p>
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
          <p className="mt-1 text-3xl font-black text-indigo-900">x{bundle.score.multiplier_value.toFixed(1)}</p>
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
