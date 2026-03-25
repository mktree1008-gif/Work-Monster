import Link from "next/link";
import { Rocket, Sparkles } from "lucide-react";
import { CharacterAlert } from "@/components/character-alert";
import { CharacterToast } from "@/components/character-toast";
import { ChibiAvatar } from "@/components/chibi-avatar";
import { QuestionsSaveCelebration } from "@/components/questions-save-celebration";
import { getManagerCue, getUserCue } from "@/lib/character-system";
import { UserPageShell } from "@/components/user-page-shell";
import { computeNextReward } from "@/lib/logic/scoring";
import { getViewerContext } from "@/lib/view-model";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuestionsPage({ searchParams }: Props) {
  const { bundle, strings } = await getViewerContext();
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const saved = params.saved === "1";
  const updated = params.updated === "1";
  const managerPreview = bundle.user.role === "manager";
  const nextReward = computeNextReward(bundle.score.total_points, bundle.rewards);
  const firstReward = bundle.rewards[0] ?? null;
  const firstRewardRemaining = firstReward ? Math.max(0, firstReward.required_points - bundle.score.total_points) : 0;
  const latestSubmission = bundle.submissions[0];
  const displayName = (bundle.user.name ?? "").trim() || bundle.user.login_id;
  const pendingSubmission = latestSubmission?.status === "pending";
  const pendingCue = getManagerCue("upload_saved_pending", bundle.user.locale);
  const successCue = getManagerCue("submission_success", bundle.user.locale);
  const milestoneUnlocked =
    bundle.score.current_streak >= bundle.rules.streak_days ||
    bundle.score.multiplier_active ||
    bundle.rewardClaims.some((claim) => claim.status === "claimed");
  const milestoneCue = getUserCue("milestone_jump", bundle.user.locale);
  const tiredCue = getUserCue("major_penalty_sad", bundle.user.locale);

  return (
    <UserPageShell
      activeTab="questions"
      labels={strings}
      subtitle="How was your day?"
      title={
        <>
          <span className="block text-balance leading-[1.06]">Hello, Work Monster!</span>
          <span className="block break-keep text-balance leading-[1.06] font-extrabold text-cyan-600">{displayName}</span>
        </>
      }
    >
      <QuestionsSaveCelebration openOnMount={saved} updatedMode={updated} />
      <CharacterToast cue={pendingCue} openOnMount={saved || pendingSubmission} role="manager" />
      <CharacterToast cue={tiredCue} openOnMount={saved && !latestSubmission?.productive} role="user" tone="warning" />

      {saved && (
        <section className="mb-4">
          <CharacterAlert
            cue={{
              emoji: "🎉",
              expression: "clap",
              spriteName: "manager_approving",
              title: "Saved Successfully",
              message: "Your check-in is now pending manager approval."
            }}
            role="manager"
            tone="success"
          />
        </section>
      )}

      <section className="card anim-pop mb-4 overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-indigo-900 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100/90">Current Momentum</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-5xl font-black leading-none">{bundle.score.total_points.toLocaleString()}</p>
          <p className="mb-1 text-3xl font-bold text-blue-100">pts</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          {bundle.score.multiplier_active ? (
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-extrabold text-amber-950">
              <Rocket size={14} />
              {bundle.score.multiplier_value.toFixed(1)}x Multiplier Active
            </p>
          ) : (
            <p className="text-sm text-blue-100/90">
              Rocket multiplier unlocks at {bundle.rules.multiplier_trigger_days}-day streak.
            </p>
          )}
          <div className="anim-pulse-soft flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <Sparkles size={18} />
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-100/90">
          Lifetime {bundle.score.lifetime_points.toLocaleString()} pts • Streak {bundle.score.current_streak} days
        </p>
      </section>

      <section className="card anim-pop anim-delayed mb-4 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Next reward</p>
        <p className="mt-1 text-lg font-bold text-indigo-900">
          {nextReward.reward ? `${nextReward.reward.title} in ${nextReward.pointsRemaining} pts` : "All rewards unlocked"}
        </p>
        {firstReward && (
          <p className="mt-1 text-xs text-slate-500">
            First reward ({firstReward.title}): {firstRewardRemaining} pts left
          </p>
        )}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${nextReward.progressPercent}%` }} />
        </div>
      </section>

      <section className="card mb-4 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Live Character Motion</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center gap-1">
            <ChibiAvatar emotion="encouraging" role="manager" size={48} />
            <p className="text-[10px] font-semibold text-slate-500">Manager</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ChibiAvatar emotion="alert" role="manager" size={48} />
            <p className="text-[10px] font-semibold text-slate-500">Alert</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ChibiAvatar emotion="approval" role="user" size={48} />
            <p className="text-[10px] font-semibold text-slate-500">User</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ChibiAvatar emotion="excited" role="user" size={48} />
            <p className="text-[10px] font-semibold text-slate-500">Excited</p>
          </div>
        </div>
      </section>

      <section className="card anim-pop mb-4 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Start today</p>
        <h2 className="mt-1 text-2xl font-black text-indigo-900">Begin Daily Check-in</h2>
        <p className="mt-1 text-sm text-slate-600">
          Move to the full-screen quest to answer A/B/C + custom input with live emoji reactions.
        </p>
        {managerPreview ? (
          <button
            className="btn btn-muted mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 opacity-70"
            disabled
            type="button"
          >
            <Sparkles size={17} />
            Manager preview: check-in disabled
          </button>
        ) : (
          <Link className="btn btn-energetic mt-4 flex w-full items-center justify-center gap-2" href="/app/questions/check-in">
            <Sparkles size={17} />
            Begin Daily Check-in
          </Link>
        )}
      </section>

      {milestoneUnlocked && (
        <section className="mt-4">
          <CharacterAlert role="user" cue={milestoneCue} tone="success" />
        </section>
      )}

      {latestSubmission && (
        <section className="card mt-4 p-5">
          <p className="text-sm font-semibold text-slate-500">Latest submission</p>
          <p className="mt-1 font-bold text-indigo-900">{latestSubmission.status.toUpperCase()}</p>
          <p className="text-xs text-slate-500">Date: {latestSubmission.date}</p>
          <p className="text-sm text-slate-600">
            {latestSubmission.status === "pending"
              ? `${bundle.rules.success_message} Waiting for manager review. Points update only after manager approval.`
              : latestSubmission.manager_note ?? "No manager note yet."}
          </p>
          {pendingSubmission && <div className="mt-3"><CharacterAlert role="manager" cue={pendingCue} compact tone="warning" /></div>}
          {!pendingSubmission && (
            <div className="mt-3">
              <CharacterAlert role="manager" cue={{ ...successCue, message: bundle.rules.success_message }} compact tone="success" />
            </div>
          )}
        </section>
      )}
    </UserPageShell>
  );
}
