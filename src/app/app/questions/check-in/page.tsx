import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChibiAvatar } from "@/components/chibi-avatar";
import { getUserCue } from "@/lib/character-system";
import { QuestionsFlow } from "@/components/questions-flow";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function CheckInPage() {
  const { bundle, strings } = await getViewerContext();
  const determinedCue = getUserCue("questions_determined", bundle.user.locale);

  return (
    <UserPageShell activeTab="questions" labels={strings} subtitle="Full-screen quest mode" title="Daily Check-in Quest">
      <section className="-mx-4 min-h-[calc(100dvh-15rem)] bg-gradient-to-b from-indigo-50/70 to-transparent px-4 py-4 sm:mx-0 sm:rounded-3xl sm:border sm:border-indigo-100">
        <div className="mb-3">
          <Link className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700" href="/app/questions">
            <ArrowLeft size={16} />
            Back to Questions Home
          </Link>
        </div>
        <article className="card mb-3 overflow-hidden p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-3">
            <ChibiAvatar emotion="encouraging" role="user" size={58} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">{determinedCue.spriteName}</p>
              <h2 className="text-lg font-black text-indigo-900">{determinedCue.title}</h2>
              <p className="text-sm text-indigo-700">{determinedCue.message}</p>
            </div>
          </div>
        </article>
        <QuestionsFlow locale={bundle.user.locale} />
      </section>
    </UserPageShell>
  );
}
