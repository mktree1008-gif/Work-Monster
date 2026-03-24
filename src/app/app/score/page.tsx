import { AlertTriangle, Flame, Sparkles } from "lucide-react";
import { UserPageShell } from "@/components/user-page-shell";
import { computeNextReward } from "@/lib/logic/scoring";
import { getViewerContext } from "@/lib/view-model";

export default async function ScorePage() {
  const { bundle, strings } = await getViewerContext();
  const nextReward = computeNextReward(bundle.score.total_points, bundle.rewards);
  const openEvents = bundle.penaltyHistory.filter((event) => event.recovered_at === undefined);
  const managerRewardUnlocked = openEvents.some((event) => event.manager_reward_unlocked);

  return (
    <UserPageShell activeTab="score" labels={strings} subtitle="Game HUD" title="Score">
      <section className="grid grid-cols-2 gap-3">
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current points</p>
          <p className="mt-1 text-4xl font-black text-indigo-900">{bundle.score.total_points}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Lifetime points</p>
          <p className="mt-1 text-4xl font-black text-indigo-900">{bundle.score.lifetime_points}</p>
        </article>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <article className="card p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Flame size={18} />
            <p className="text-xs uppercase tracking-[0.2em]">Streak</p>
          </div>
          <p className="mt-1 text-3xl font-black text-indigo-900">{bundle.score.current_streak}</p>
        </article>
        <article className="card p-4">
          <div className="flex items-center gap-2 text-indigo-500">
            <Sparkles size={18} />
            <p className="text-xs uppercase tracking-[0.2em]">Multiplier</p>
          </div>
          <p className="mt-1 text-3xl font-black text-indigo-900">x{bundle.score.multiplier_value.toFixed(1)}</p>
        </article>
      </section>

      <section className="card mt-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Next reward</p>
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
        </div>

        <p className="mt-2 text-sm font-semibold text-slate-600">
          {bundle.score.penalty_active ? "Penalty Active" : "Penalty inactive"}
        </p>
        <p className="text-sm text-slate-500">Negative balance: {bundle.score.negative_balance}</p>
        <p className="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{bundle.rules.penalty_description}</p>
        <p className="mt-2 text-sm text-emerald-700">You can recover by earning points.</p>
        {managerRewardUnlocked && (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
            Manager reward unlocked
          </p>
        )}
      </section>
    </UserPageShell>
  );
}
