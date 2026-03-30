import Link from "next/link";
import { ArrowLeft, CalendarClock, MailOpen, Sparkles } from "lucide-react";
import { MissionAddButton } from "@/components/mission-add-button";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

function extractBonusPoints(text: string): number {
  const matched = text.match(/([+-]?\d+)\s*(pts|point|points)/i);
  if (!matched) return 0;
  const value = Number(matched[1]);
  return Number.isFinite(value) ? value : 0;
}

function parseMissionMeta(message: string): { objective: string; startDate: string; dueDate: string; bonusPoints: number } {
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
    objective: objective || text || "No objective yet.",
    startDate: startMatch?.[1]?.trim() || "",
    dueDate: dueMatch?.[1]?.trim() || deadlineMatch?.[1]?.trim() || "Flexible",
    bonusPoints: bonusMatch ? Number(bonusMatch[1]) : 0
  };
}

export default async function MissionPage() {
  const { bundle, strings } = await getViewerContext();
  const isKo = bundle.user.locale === "ko";
  const mission = bundle.notifications.find(
    (item) =>
      item.kind === "announcement" &&
      (item.category === "mission" || ((item.deep_link ?? "").includes("/app/mission")) || /mission/i.test(item.title))
  );
  const missionTitle = mission?.title?.trim() ?? "";
  const parsedMeta = parseMissionMeta(mission?.message ?? "");
  const missionStartDate = mission?.mission_start_date?.trim() || parsedMeta.startDate;
  const missionDueDate = mission?.mission_due_date?.trim() || parsedMeta.dueDate;
  const missionMessage = parsedMeta.objective;
  const bonusPoints = mission
    ? (typeof mission.mission_bonus_points === "number" ? mission.mission_bonus_points : parsedMeta.bonusPoints)
      || extractBonusPoints(`${missionTitle} ${missionMessage}`)
    : 0;
  const hasMission = Boolean(mission);

  const objective = hasMission
    ? missionMessage
    : isKo
      ? "아직 활성 미션이 없습니다. 오늘은 스스로 계획해서 진행해보세요."
      : "No active mission yet. Enjoy building your own plan today.";
  const title = hasMission
    ? missionTitle
    : isKo
      ? "No mission yet"
      : "No mission yet";

  return (
    <UserPageShell
      activeTab="questions"
      labels={strings}
      subtitle={isKo ? "매니저 미션 확인" : "Manager quest details"}
      title={isKo ? "Mission from Manager" : "Mission from Manager"}
    >
      <section className="mb-3">
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700" href="/app/welcome">
          <ArrowLeft size={16} />
          {isKo ? "Back to Home" : "Back to Home"}
        </Link>
      </section>

      <article className="card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-amber-100 via-indigo-50 to-cyan-100 p-5">
          <div className="flex items-center gap-2 text-amber-700">
            <MailOpen size={16} />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">{hasMission ? "Quest Letter" : "Placeholder"}</p>
          </div>
          <h2 className="mt-1 text-2xl font-black text-indigo-900">{title}</h2>
          <p className="mt-2 rounded-2xl bg-white/75 p-3 text-sm text-slate-700">{objective}</p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/80 px-3 py-2 text-slate-600">
              <p className="font-bold uppercase tracking-[0.12em] text-slate-500">{isKo ? "상태" : "Status"}</p>
              <p className="mt-1 text-sm font-semibold text-indigo-900">{hasMission ? (mission?.is_new ? "New" : "In Progress") : "Calm"}</p>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 text-slate-600">
              <p className="inline-flex items-center gap-1 font-bold uppercase tracking-[0.12em] text-slate-500">
                <CalendarClock size={12} />
                {isKo ? "마감" : "Deadline"}
              </p>
              <p className="mt-1 text-sm font-semibold text-indigo-900">
                {hasMission ? missionDueDate : (isKo ? "유동적" : "Flexible")}
              </p>
            </div>
          </div>

          {hasMission ? (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-3 py-1 text-xs font-bold text-amber-900">
              <Sparkles size={12} />
              {bonusPoints > 0 ? `Bonus +${bonusPoints} pts` : isKo ? "보너스 포인트 설정 가능" : "Bonus points available"}
            </p>
          ) : null}
        </div>

        <div className="p-5">
          <MissionAddButton
            bonusPoints={bonusPoints}
            deadline={missionDueDate}
            locale={bundle.user.locale}
            missionId={mission?.source_id || mission?.id}
            objective={objective}
            startDate={missionStartDate}
            title={title}
          />
          <Link className="btn btn-muted mt-2 flex w-full items-center justify-center" href="/app/plan">
            {isKo ? "Plan 페이지 열기" : "Open Plan Your Day"}
          </Link>
        </div>
      </article>
    </UserPageShell>
  );
}
