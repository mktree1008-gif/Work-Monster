import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuestionsFlow } from "@/components/questions-flow";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function CheckInPage() {
  const { bundle, strings } = await getViewerContext();
  const managerPreview = bundle.user.role === "manager";

  return (
    <UserPageShell activeTab="questions" labels={strings} subtitle="Full-screen quest mode" title="Daily Check-in Quest">
      <section className="-mx-4 min-h-[calc(100dvh-15rem)] bg-gradient-to-b from-indigo-50/70 to-transparent px-4 py-4 sm:mx-0 sm:rounded-3xl sm:border sm:border-indigo-100">
        <div className="mb-3">
          <Link className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700" href="/app/welcome">
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
        {managerPreview && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Manager preview mode: submission save is disabled.
          </div>
        )}
        <QuestionsFlow locale={bundle.user.locale} readOnly={managerPreview} />
      </section>
    </UserPageShell>
  );
}
