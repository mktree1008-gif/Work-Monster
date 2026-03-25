import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlanDayBoard } from "@/components/plan-day-board";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function PlanPage() {
  const { bundle, strings } = await getViewerContext();

  return (
    <UserPageShell
      activeTab="questions"
      labels={strings}
      subtitle={bundle.user.locale === "ko" ? "아침 계획 모드" : "Morning planning mode"}
      title={bundle.user.locale === "ko" ? "Plan Your Day" : "Plan Your Day"}
    >
      <section className="mb-3">
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700" href="/app/welcome">
          <ArrowLeft size={16} />
          {bundle.user.locale === "ko" ? "Back to Home" : "Back to Home"}
        </Link>
      </section>
      <PlanDayBoard locale={bundle.user.locale} />
    </UserPageShell>
  );
}

