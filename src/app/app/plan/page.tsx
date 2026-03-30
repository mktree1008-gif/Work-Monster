import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlanDayBoard } from "@/components/plan-day-board";
import { UserPageShell } from "@/components/user-page-shell";
import { computeNextReward } from "@/lib/logic/scoring";
import { getViewerContext } from "@/lib/view-model";

function parseMissionMeta(message: string): { objective: string; dueDate: string; startDate: string; bonus: number } {
  const text = message.trim();
  const startMatch = text.match(/Start:\s*([^•\n]+)/i);
  const dueMatch = text.match(/Due:\s*([^•\n]+)/i);
  const deadlineMatch = text.match(/Deadline:\s*([^•\n]+)/i);
  const bonusMatch = text.match(/Bonus:\s*\+?(\d+)/i);
  const objective = text
    .replace(/Start:\s*([^•\n]+)/gi, "")
    .replace(/Due:\s*([^•\n]+)/gi, "")
    .replace(/Deadline:\s*([^•\n]+)/gi, "")
    .replace(/Bonus:\s*\+?\d+\s*pts?/gi, "")
    .replace(/\s*•\s*/g, " ")
    .trim();

  return {
    objective: objective || text || "No mission objective yet.",
    dueDate: dueMatch?.[1]?.trim() || deadlineMatch?.[1]?.trim() || "",
    startDate: startMatch?.[1]?.trim() || "",
    bonus: bonusMatch ? Number(bonusMatch[1]) : 0
  };
}

export default async function PlanPage() {
  const { bundle, strings } = await getViewerContext();
  const nextReward = computeNextReward(bundle.score.total_points, bundle.rewards);
  const missionNotification =
    bundle.notifications.find(
      (item) =>
        item.kind === "announcement" &&
        (item.category === "mission" || ((item.deep_link ?? "").includes("/app/mission")) || /mission/i.test(item.title))
    ) ?? null;
  const missionMeta = parseMissionMeta(missionNotification?.message ?? "");
  const activeMission = missionNotification
    ? {
        id: missionNotification.source_id || missionNotification.id,
        title: missionNotification.title.trim() || "Mission",
        objective: missionMeta.objective,
        startDate: missionNotification.mission_start_date?.trim() || missionMeta.startDate || "",
        dueDate: missionNotification.mission_due_date?.trim() || missionMeta.dueDate || "",
        bonusPoints: typeof missionNotification.mission_bonus_points === "number"
          ? missionNotification.mission_bonus_points
          : missionMeta.bonus || 0
      }
    : null;

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
      <PlanDayBoard
        locale={bundle.user.locale}
        mission={activeMission}
        reward={{
          batteryPercent: Math.max(8, nextReward.progressPercent),
          nextRewardText: nextReward.reward
            ? `Next reward in ${nextReward.pointsRemaining} pts`
            : "All rewards unlocked"
        }}
        userId={bundle.user.id}
      />
    </UserPageShell>
  );
}
