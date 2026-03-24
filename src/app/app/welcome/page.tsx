import Link from "next/link";
import { Zap } from "lucide-react";
import { UserPageShell } from "@/components/user-page-shell";
import { CharacterAlert } from "@/components/character-alert";
import { getManagerCue } from "@/lib/character-system";
import { getViewerContext } from "@/lib/view-model";

export default async function WelcomePage() {
  const { bundle, strings } = await getViewerContext();
  const displayName = (bundle.user.name ?? "").trim() || bundle.user.login_id;
  const managerCue = getManagerCue("submission_success", bundle.user.locale);

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
      <section className="card mb-4 overflow-hidden bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/90">Next step</p>
        <h2 className="mt-2 text-3xl font-black leading-tight">Welcome Work Monster!</h2>
        <p className="mt-2 text-sm text-white/90">Tap once and jump into your energy-packed check-in flow.</p>
        <Link className="btn btn-energetic mt-4 flex w-full items-center justify-center gap-2 bg-white/15" href="/app/questions">
          <Zap size={17} />
          Enter Main Dashboard
        </Link>
      </section>

      <section className="mb-4">
        <CharacterAlert role="manager" cue={managerCue} tone="success" />
      </section>

      <section className="card p-4">
        <p className="text-sm text-slate-600">Tip: momentum grows when you start quickly and keep your streak alive.</p>
      </section>
    </UserPageShell>
  );
}
