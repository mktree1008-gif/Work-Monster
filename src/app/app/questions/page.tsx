import { Sparkles } from "lucide-react";
import { CharacterAlert } from "@/components/character-alert";
import { getManagerCue, getUserCue } from "@/lib/character-system";
import { QuestionsFlow } from "@/components/questions-flow";
import { UserPageShell } from "@/components/user-page-shell";
import { computeNextReward } from "@/lib/logic/scoring";
import { toISODate } from "@/lib/utils";
import { getViewerContext } from "@/lib/view-model";

export default async function QuestionsPage() {
  const { bundle, strings } = await getViewerContext();
  const nextReward = computeNextReward(bundle.score.total_points, bundle.rewards);
  const latestSubmission = bundle.submissions[0];
  const displayName = (bundle.user.name ?? "").trim() || bundle.user.login_id;
  const isTodaySubmission = latestSubmission?.date === toISODate();
  const pendingSubmission = latestSubmission?.status === "pending";
  const pendingCue = getManagerCue("upload_saved_pending", bundle.user.locale);
  const successCue = getManagerCue("submission_success", bundle.user.locale);
  const milestoneUnlocked =
    bundle.score.current_streak >= bundle.rules.streak_days ||
    bundle.score.multiplier_active ||
    bundle.rewardClaims.some((claim) => claim.status === "claimed");
  const milestoneCue = getUserCue("milestone_jump", bundle.user.locale);

  return (
    <UserPageShell
      activeTab="questions"
      labels={strings}
      subtitle="How was your day?"
      title={`${bundle.rules.greeting_message} ${displayName}!`}
    >
      <section className="card mb-4 flex items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Current status</p>
          <p className="mt-1 text-3xl font-black text-indigo-900">{bundle.score.total_points} pts</p>
          <p className="text-sm text-slate-500">Streak {bundle.score.current_streak} days</p>
        </div>
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-8 border-emerald-500/20 text-emerald-600">
          <Sparkles />
        </div>
      </section>

      <section className="card mb-4 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Next reward</p>
        <p className="mt-1 text-lg font-bold text-indigo-900">
          {nextReward.reward ? `${nextReward.reward.title} in ${nextReward.pointsRemaining} pts` : "All rewards unlocked"}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${nextReward.progressPercent}%` }} />
        </div>
      </section>

      {milestoneUnlocked && (
        <section className="mt-4">
          <CharacterAlert role="user" cue={milestoneCue} glasses={bundle.user.character_glasses ?? true} tone="success" />
        </section>
      )}

      <QuestionsFlow locale={bundle.user.locale} withGlasses={bundle.user.character_glasses ?? true} />

      {latestSubmission && (
        <section className="card mt-4 p-5">
          <p className="text-sm font-semibold text-slate-500">Latest submission</p>
          <p className="mt-1 font-bold text-indigo-900">{latestSubmission.status.toUpperCase()}</p>
          <p className="text-sm text-slate-600">
            {latestSubmission.status === "pending"
              ? `${bundle.rules.success_message} Waiting for manager review. Points update only after manager approval.`
              : latestSubmission.manager_note ?? "No manager note yet."}
          </p>
          {pendingSubmission && <div className="mt-3"><CharacterAlert role="manager" cue={pendingCue} compact tone="warning" /></div>}
          {isTodaySubmission && <div className="mt-3"><CharacterAlert role="manager" cue={{ ...successCue, message: bundle.rules.success_message }} compact tone="success" /></div>}
        </section>
      )}
    </UserPageShell>
  );
}
