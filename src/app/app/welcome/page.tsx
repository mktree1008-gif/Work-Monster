import Link from "next/link";
import Image from "next/image";
import { Flame, Gift, Zap } from "lucide-react";
import { UserPageShell } from "@/components/user-page-shell";
import { CharacterAlert } from "@/components/character-alert";
import { CharacterCue, getManagerCue } from "@/lib/character-system";
import { computeNextReward } from "@/lib/logic/scoring";
import { getViewerContext } from "@/lib/view-model";

export default async function WelcomePage() {
  const { bundle, strings } = await getViewerContext();
  const displayName = (bundle.user.name ?? "").trim() || bundle.user.login_id;
  const latestReviewed = bundle.submissions
    .filter((item) => item.status === "approved" || item.status === "rejected")
    .sort((a, b) => {
      const left = a.reviewed_at ?? a.created_at;
      const right = b.reviewed_at ?? b.created_at;
      return left > right ? -1 : 1;
    })[0];
  const latestPoints = latestReviewed?.status === "approved" ? latestReviewed.points_awarded : 0;
  const isNegativeReview = latestPoints < 0;

  const managerCue: CharacterCue = isNegativeReview
    ? {
        title: bundle.user.locale === "ko" ? "천천히 회복해봐요" : "You can bounce back",
        message:
          bundle.user.locale === "ko"
            ? `이번 리뷰는 ${latestPoints} pts예요. 내일 승인으로 다시 올릴 수 있어요.`
            : `This review is ${latestPoints} pts. You can recover with your next approved check-in.`,
        expression: "nods",
        emoji: "💙",
        spriteName: "manager_encouraging"
      }
    : latestReviewed
      ? {
          ...getManagerCue("submission_success", bundle.user.locale),
          message:
            bundle.user.locale === "ko"
              ? `이번 리뷰 ${latestPoints > 0 ? `+${latestPoints}` : latestPoints} pts 반영 완료!`
              : `${latestPoints > 0 ? `+${latestPoints}` : latestPoints} pts confirmed by manager.`
        }
      : getManagerCue("submission_success", bundle.user.locale);
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
            <div className="rounded-xl bg-white/80 px-2 py-2.5 text-center text-indigo-900">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">Points</p>
              <p className="mt-1 text-[1.48rem] font-black leading-none">{currentPoints}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-indigo-700/80">pts</p>
            </div>
            <div className="rounded-xl bg-white/80 px-2 py-2.5 text-center text-indigo-900">
              <p className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">
                <Flame size={12.5} />
                Streak
              </p>
              <p className="mt-1 text-[1.35rem] font-black leading-none">{currentStreak}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-indigo-700/80">days</p>
            </div>
            <div className="rounded-xl bg-white/80 px-2 py-2.5 text-center text-indigo-900">
              <p className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">
                <Gift size={12.5} />
                Reward
              </p>
              <p className="mt-1 text-[1.2rem] font-black leading-none">
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
        <Link
          className="block transition-transform duration-150 active:scale-[0.99]"
          href={latestReviewed ? `/app/record?focus=${latestReviewed.id}` : "/app/record"}
        >
          <CharacterAlert role="manager" cue={managerCue} tone={isNegativeReview ? "warning" : "success"} />
          <p className={`mt-1 text-center text-xs font-semibold ${isNegativeReview ? "text-amber-700" : "text-emerald-700"}`}>
            {bundle.user.locale === "ko"
              ? "눌러서 점수/리뷰 내역 확인하기"
              : "Tap to open your score review history"}
          </p>
        </Link>
      </section>
    </UserPageShell>
  );
}
