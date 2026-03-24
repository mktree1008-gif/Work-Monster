import Link from "next/link";
import Image from "next/image";
import { Flame, Gift, Zap } from "lucide-react";
import { UserPageShell } from "@/components/user-page-shell";
import { CharacterAlert } from "@/components/character-alert";
import { getManagerCue } from "@/lib/character-system";
import { computeNextReward } from "@/lib/logic/scoring";
import { getViewerContext } from "@/lib/view-model";

export default async function WelcomePage() {
  const { bundle, strings } = await getViewerContext();
  const displayName = (bundle.user.name ?? "").trim() || bundle.user.login_id;
  const managerCue = getManagerCue("submission_success", bundle.user.locale);
  const nextReward = computeNextReward(bundle.score.total_points, bundle.rewards);
  const currentPoints = bundle.score.total_points;
  const currentStreak = bundle.score.current_streak;

  return (
    <UserPageShell
      activeTab="questions"
      labels={strings}
      subtitle="Bright start before your daily quest"
      title={
        <>
          <span className="block leading-[1.08]">Welcome, Work Monster!</span>
          <span className="mt-1 block text-[0.68em] font-semibold text-indigo-700">{displayName}</span>
        </>
      }
    >
      <section className="card anim-pop mb-4 overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-600 p-4 text-white">
          <div className="pointer-events-none absolute -right-14 -top-12 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-12 bottom-2 h-28 w-28 rounded-full bg-indigo-200/25 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/45 bg-white/70 shadow-lg">
              <Image
                alt="Manager character"
                fill
                priority
                sizes="96px"
                src="/images/login-hero.svg"
                style={{
                  objectFit: "cover",
                  objectPosition: "34% 32%",
                  transform: "scale(2.05)"
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/85">Quest Starter</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Manager mission guide is ready</h2>
              <p className="mt-1 text-sm text-white/90">Start check-in now and submit today&apos;s progress for review.</p>
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/80 p-2 text-indigo-900">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500">Points</p>
              <p className="mt-1 text-sm font-black">{currentPoints} pts</p>
            </div>
            <div className="rounded-xl bg-white/80 p-2 text-indigo-900">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500">
                <Flame size={12} />
                Streak
              </p>
              <p className="mt-1 text-sm font-black">{currentStreak} days</p>
            </div>
            <div className="rounded-xl bg-white/80 p-2 text-indigo-900">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500">
                <Gift size={12} />
                Reward
              </p>
              <p className="mt-1 text-sm font-black">
                {nextReward.reward ? `${nextReward.pointsRemaining} left` : "Unlocked"}
              </p>
            </div>
          </div>

          <Link
            className="btn btn-energetic relative mt-3 flex w-full items-center justify-center gap-2 bg-white/12 text-base"
            href="/app/questions"
          >
            <Zap size={17} />
            Enter Main Dashboard
          </Link>
        </div>

        <div className="bg-white px-4 py-3">
          <p className="text-sm text-slate-600">
            Tip: quick start today helps you protect streak and unlock the next reward faster.
          </p>
        </div>
      </section>

      <section className="anim-pop mb-4">
        <CharacterAlert role="manager" cue={managerCue} tone="success" />
      </section>
    </UserPageShell>
  );
}
