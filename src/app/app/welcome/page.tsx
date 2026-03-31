import { CharacterAlert } from "@/components/character-alert";
import { InactivityPenaltyPopup } from "@/components/inactivity-penalty-popup";
import { LoginBonusPopup } from "@/components/login-bonus-popup";
import { QuestionsSaveCelebration } from "@/components/questions-save-celebration";
import { WelcomeDashboardClient } from "@/components/wellness/welcome-dashboard-client";
import { computeNextReward } from "@/lib/logic/scoring";
import { getViewerContext } from "@/lib/view-model";
import { headers } from "next/headers";
import { toISODate, toISODateInTimeZone } from "@/lib/utils";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
    dueDate: dueMatch?.[1]?.trim() || deadlineMatch?.[1]?.trim() || "Flexible deadline",
    startDate: startMatch?.[1]?.trim() || "",
    bonus: bonusMatch ? Number(bonusMatch[1]) : 0
  };
}

function parseMissedDaysFromPenaltyMessage(message: string): number {
  const text = message.toLowerCase();
  const enMatched = text.match(/(\d+)\s+inactive day/);
  if (enMatched) return Number(enMatched[1]) || 0;
  const koMatched = message.match(/(\d+)\s*일\s*미로그인/);
  if (koMatched) return Number(koMatched[1]) || 0;
  return 0;
}

export default async function WelcomePage({ searchParams }: Props) {
  const { bundle, strings } = await getViewerContext();
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const saved = params.saved === "1";
  const updated = params.updated === "1";
  const already = params.already === "1";
  const loginBonus = params.login_bonus === "1";
  const loginPointsRaw = typeof params.login_points === "string" ? Number(params.login_points) : 0;
  const loginPoints = Number.isFinite(loginPointsRaw) ? Math.max(0, Math.round(loginPointsRaw)) : 0;
  const submissionPointsRaw = typeof params.submission_points === "string" ? Number(params.submission_points) : 0;
  const submissionPointsAwarded = Number.isFinite(submissionPointsRaw) ? submissionPointsRaw : 0;

  const requestHeaders = await headers();
  const requestTimeZone = (requestHeaders.get("x-vercel-ip-timezone") ?? "").trim();
  const today = (() => {
    if (!requestTimeZone) return toISODate(new Date());
    try {
      return toISODateInTimeZone(requestTimeZone, new Date());
    } catch {
      return toISODate(new Date());
    }
  })();
  const todaySubmission = bundle.submissions.find((item) => item.date === today) ?? null;
  const normalizedStatus = todaySubmission?.status ?? "";
  const checkinState = !todaySubmission
    ? "none"
    : normalizedStatus === "pending"
      ? "submitted"
      : normalizedStatus === "draft"
        ? "draft"
        : normalizedStatus === "submitted"
          ? "submitted"
          : normalizedStatus === "in_review"
            ? "in_review"
            : normalizedStatus === "approved"
              ? "approved"
              : normalizedStatus === "rejected"
                ? "rejected"
                : normalizedStatus === "needs_revision"
                  ? "needs_revision"
                  : "none";

  const missionNotification =
    bundle.notifications.find(
      (item) =>
        item.kind === "announcement" &&
        (item.category === "mission" || ((item.deep_link ?? "").includes("/app/mission")) || /mission/i.test(item.title))
    ) ?? null;
  const missionMeta = parseMissionMeta(missionNotification?.message ?? "");
  const missionDueDate = missionNotification?.mission_due_date?.trim() || missionMeta.dueDate;
  const missionStartDate = missionNotification?.mission_start_date?.trim() || missionMeta.startDate;
  const missionBonus = typeof missionNotification?.mission_bonus_points === "number"
    ? missionNotification.mission_bonus_points
    : missionMeta.bonus;
  const mission = {
    id: missionNotification?.source_id || missionNotification?.id || "",
    hasMission: Boolean(missionNotification),
    isNew: Boolean(missionNotification?.is_new),
    title: missionNotification?.title?.trim() || "No mission yet",
    objective: missionNotification ? missionMeta.objective : "No mission yet - enjoy planning your own day.",
    startDate: missionNotification ? missionStartDate : "",
    deadline: missionNotification ? missionDueDate : "Flexible deadline",
    bonusPoints: missionNotification ? missionBonus : 0,
    statusLabel: missionNotification
      ? checkinState === "approved"
        ? "Completed"
        : checkinState === "submitted" || checkinState === "in_review"
          ? "In progress"
          : checkinState === "needs_revision"
            ? "Needs revision"
            : checkinState === "rejected"
              ? "Rejected"
              : checkinState === "draft"
                ? "Draft saved"
                : missionNotification.is_new
                  ? "New mission"
                  : "Accepted"
      : "No mission yet"
  };

  const nextReward = computeNextReward(bundle.score.total_points, bundle.rewards);
  const inactivityPenaltyNotification = bundle.notifications.find((item) => {
    if (!item.is_new) return false;
    if ((item.review_points ?? 0) >= 0) return false;
    const text = `${item.title} ${item.message}`.toLowerCase();
    return text.includes("inactive") || text.includes("미로그인");
  }) ?? null;
  const inactivityPenaltyMissedDays = inactivityPenaltyNotification
    ? parseMissedDaysFromPenaltyMessage(inactivityPenaltyNotification.message)
    : 0;

  return (
    <>
      {inactivityPenaltyNotification && (
        <InactivityPenaltyPopup
          locale={bundle.user.locale}
          message={inactivityPenaltyNotification.message}
          missedDays={inactivityPenaltyMissedDays}
          notificationId={inactivityPenaltyNotification.id}
          openOnMount
          points={inactivityPenaltyNotification.review_points ?? 0}
        />
      )}
      <QuestionsSaveCelebration
        openOnMount={saved}
        pointsAwarded={submissionPointsAwarded}
        updatedMode={updated}
      />
      <LoginBonusPopup
        openOnMount={loginBonus && loginPoints > 0}
        points={loginPoints}
      />
      {already && (
        <section className="mb-4">
          <CharacterAlert
            compact
            cue={{
              spriteName: "manager_curious",
              expression: "wide-eyes",
              emoji: "🗓️",
              title: "Today's check-in is already submitted",
              message: "If you edit while pending, your latest pending version will be reviewed."
            }}
            role="manager"
            tone="warning"
          />
        </section>
      )}
      <WelcomeDashboardClient
        checkinState={checkinState}
        labels={strings}
        mission={mission}
        reward={{
          batteryPercent: Math.max(8, nextReward.progressPercent),
          nextRewardText: nextReward.reward
            ? `Next Reward in ${nextReward.pointsRemaining} pts`
            : "All rewards unlocked"
        }}
        score={{
          totalPoints: bundle.score.total_points,
          streak: bundle.score.current_streak,
          lifetimePoints: bundle.score.lifetime_points,
          multiplierActive: bundle.score.multiplier_active,
          multiplierValue: bundle.score.multiplier_value,
          inRisk: bundle.score.total_points < 0
        }}
      />
    </>
  );
}
