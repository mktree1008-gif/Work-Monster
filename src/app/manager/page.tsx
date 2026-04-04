import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { isManagerOwnerEmail } from "@/lib/constants";
import { ManagerClaimAlertsModal } from "@/components/manager-claim-alerts-modal";
import { ManagerPenaltyEditor } from "@/components/manager-penalty-editor";
import { ManagerPenaltyTextEditor } from "@/components/manager-penalty-text-editor";
import { ManagerReviewResultPopup } from "@/components/manager-review-result-popup";
import { ManagerRulesSavedPopup } from "@/components/manager-rules-saved-popup";
import { ManagerUserAnalytics } from "@/components/manager-user-analytics";
import { NotificationBell } from "@/components/notification-bell";
import { DateInputPicker } from "@/components/date-input-picker";
import { SubmissionReviewForm } from "@/components/submission-review-form";
import { findOptionLabel } from "@/lib/check-in-model";
import {
  buildAttachmentDownloadHref,
  buildLinkDownloadHref,
  describeAttachment,
  formatAttachmentSize
} from "@/lib/attachments";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { getSession } from "@/lib/session";
import {
  acknowledgeManagerRewardAlertsAction,
  acknowledgeNotificationsAction,
  applyInactivityPenaltyAction,
  assignMissionAction,
  createAnnouncementAction,
  createRewardAction,
  deleteMissionAction,
  deleteRewardAction,
  logoutAction,
  skipInactivityPenaltyAction,
  updateMissionAction,
  updateRewardAction,
  updateRulesAction
} from "@/lib/services/actions";
import { getManagerOverview } from "@/lib/services/game-service";
import { getMissionDueDate, parseMissionAnnouncement } from "@/lib/mission";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ManagerTab = "inbox" | "review" | "analytics" | "rules" | "rewards" | "logs";

const MANAGER_TABS: Array<{ id: ManagerTab; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "review", label: "Review" },
  { id: "analytics", label: "User Analytics" },
  { id: "rules", label: "Rules" },
  { id: "rewards", label: "Rewards" },
  { id: "logs", label: "Logs" }
];

function pickManagerTab(
  value: string | undefined,
  opts: { hasFocusSubmission: boolean; hasOpenClaims: boolean }
): ManagerTab {
  if (opts.hasFocusSubmission) return "review";
  if (opts.hasOpenClaims) return "inbox";
  if (value === "inbox" || value === "review" || value === "analytics" || value === "rules" || value === "rewards" || value === "logs") {
    return value;
  }
  return "review";
}

function extractDollarAmount(value: string): number {
  const matched = value.match(/-?\d+(?:\.\d+)?/);
  if (!matched) return 0;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function missionDaysLeft(dueDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const todayUTC = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).getTime();
  const dueUTC = new Date(`${dueDate}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(todayUTC) || !Number.isFinite(dueUTC)) return null;
  return Math.round((dueUTC - todayUTC) / 86_400_000);
}

function parseTokenList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export default async function ManagerPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || session.role !== "manager") {
    redirect("/auth/login");
  }

  const repo = getGameRepository();
  const user = await repo.getUser(session.uid);
  if (!user) {
    redirect("/auth/login");
  }
  if (!isManagerOwnerEmail(user.email)) {
    redirect("/app/welcome");
  }
  if ((user.name ?? "").trim().length === 0) {
    redirect("/auth/nickname");
  }

  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const focusedSubmissionId = typeof params.focus_submission === "string" ? params.focus_submission : "";
  const openClaimsRequested = params.open_claims === "1";
  const activeTab = pickManagerTab(
    typeof params.manager_tab === "string" ? params.manager_tab : undefined,
    { hasFocusSubmission: focusedSubmissionId.length > 0, hasOpenClaims: openClaimsRequested }
  );

  const data = await getManagerOverview(session.uid);
  const allUsers = await repo.listUsers();
  const userMap = new Map(allUsers.map((item) => [item.id, item]));

  const reviewed = params.reviewed === "1";
  const approved = params.approved === "1";
  const reviewedPoints = Number(params.points ?? 0);
  const reviewedBonus = Number(params.bonus ?? 0);
  const reviewedBonusMessage = typeof params.bonus_message === "string" ? params.bonus_message : "";
  const reviewedNote = typeof params.note === "string" ? params.note : "";
  const rulesSaved = params.rules_saved === "1";
  const penaltyNoticeSent = params.penalty_notice_sent === "1";
  const announced = params.announce === "1";
  const missionAssigned = params.mission_assigned === "1";
  const missionUpdated = params.mission_updated === "1";
  const missionDeleted = params.mission_deleted === "1";
  const missionAssignError = typeof params.assign_error === "string" ? params.assign_error : "";
  const inactivityApplied = params.inactivity_applied === "1";
  const inactivitySkipped = params.inactivity_skipped === "1";
  const inactivityError = typeof params.inactivity_error === "string" ? params.inactivity_error : "";
  const announceError = typeof params.announce_error === "string" ? params.announce_error : "";
  const rulesVersion = Number(params.version ?? data.rules.rule_version);
  const safeRulesVersion = Number.isFinite(rulesVersion) && rulesVersion > 0 ? Math.floor(rulesVersion) : data.rules.rule_version;

  const managerClaimAlerts = data.rewardClaimAlerts.map((item) => ({
    claimId: item.claim.id,
    userDisplay: item.userDisplay,
    rewardTitle: item.rewardTitle,
    rewardPoints: item.rewardPoints,
    claimedAt: item.claim.claimed_at
  }));

  const rewardByThreshold = new Map(data.rules.penalty_rewards.map((reward) => [reward.threshold, reward]));
  const thresholds = [...new Set([...data.rules.penalty_thresholds, ...data.rules.penalty_rewards.map((reward) => reward.threshold)])]
    .sort((a, b) => b - a);
  const penaltyRows = thresholds.map((threshold) => {
    const reward = Number.isFinite(threshold) ? rewardByThreshold.get(threshold) : undefined;
    return {
      threshold: Number.isFinite(threshold) ? String(threshold) : "",
      label: reward?.label ?? "Manager reward unlocked",
      value: reward?.value ?? "$0 equivalent"
    };
  });

  const orderedPendingSubmissions = [...data.pendingSubmissions].sort((a, b) => {
    if (focusedSubmissionId && a.id === focusedSubmissionId) return -1;
    if (focusedSubmissionId && b.id === focusedSubmissionId) return 1;
    return a.created_at > b.created_at ? -1 : 1;
  });

  const analyticsUsers = allUsers
    .filter((item) => item.role === "user")
    .map((item) => ({
      id: item.id,
      loginId: item.login_id,
      displayName: (item.name ?? "").trim() || item.login_id
    }));
  const userScores = await Promise.all(
    analyticsUsers.map(async (item) => ({
      user: item,
      score: await repo.getScore(item.id)
    }))
  );
  const negativeRows = userScores
    .map((item) => ({
      ...item,
      negativePoints: Math.max(0, item.score.total_points < 0 ? Math.abs(item.score.total_points) : item.score.negative_balance)
    }))
    .filter((item) => item.negativePoints > 0)
    .sort((a, b) => b.negativePoints - a.negativePoints);
  const claimableByUser = new Map<string, number>();
  for (const event of data.openPenaltyEvents) {
    const value = Math.max(0, extractDollarAmount(event.reward_value));
    if (value <= 0) continue;
    const prev = claimableByUser.get(event.user_id) ?? 0;
    claimableByUser.set(event.user_id, prev + value);
  }
  const claimableTotal = [...claimableByUser.values()].reduce((sum, value) => sum + value, 0);

  const analyticsRange = params.analytics_range === "month" ? "month" : "week";
  const requestedAnalyticsUserId = typeof params.analytics_user === "string" ? params.analytics_user : "";
  const selectedAnalyticsUser =
    analyticsUsers.find((item) => item.id === requestedAnalyticsUserId) ?? analyticsUsers[0] ?? null;

  const missionRows = data.announcements
    .map((item) => {
      const parsed = parseMissionAnnouncement(item.message ?? "");
      if (!parsed) return null;
      const assignedUser = userMap.get(parsed.target_user_id);
      const dueDate = getMissionDueDate(parsed);
      const leftDays = missionDaysLeft(dueDate);
      return {
        id: item.id,
        title: parsed.title,
        objective: parsed.objective,
        targetUserId: parsed.target_user_id,
        targetUserDisplay: (assignedUser?.name ?? "").trim() || assignedUser?.login_id || parsed.target_user_id,
        startDate: parsed.start_date?.trim() ?? "",
        dueDate,
        durationDays: parsed.duration_days ?? 0,
        bonusPoints: parsed.bonus_points ?? 0,
        createdAt: item.created_at,
        daysLeft: leftDays
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  const selectedAnalyticsSubmissions = selectedAnalyticsUser
    ? await repo.listSubmissionsByUser(selectedAnalyticsUser.id)
    : [];
  const selectedAnalyticsScore = selectedAnalyticsUser
    ? await repo.getScore(selectedAnalyticsUser.id)
    : null;

  return (
    <main className="container-mobile page-padding">
      <ManagerRulesSavedPopup openOnMount={rulesSaved} version={safeRulesVersion} />
      <ManagerReviewResultPopup
        approved={approved}
        bonusMessage={reviewedBonusMessage}
        bonusPoints={Number.isFinite(reviewedBonus) ? reviewedBonus : 0}
        note={reviewedNote}
        openOnMount={reviewed}
        points={Number.isFinite(reviewedPoints) ? reviewedPoints : 0}
      />
      <ManagerClaimAlertsModal action={acknowledgeManagerRewardAlertsAction} alerts={managerClaimAlerts} />

      <header className="card mb-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manager Console</p>
        <h1 className="display-cute text-4xl font-extrabold text-indigo-900">{APP_NAME}</h1>
        <div className="mt-3 flex items-center gap-2">
          <NotificationBell
            action={acknowledgeNotificationsAction}
            locale={user.locale}
            notifications={data.notifications}
            role="manager"
            unreadCount={data.unreadNotificationCount}
          />
          <Link className="btn btn-muted text-sm" href="/app/welcome">
            Open User Preview
          </Link>
          <form action={logoutAction}>
            <button className="btn btn-primary text-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>

        <nav className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-2">
          {MANAGER_TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                className={`rounded-xl px-2 py-2 text-center text-xs font-bold uppercase tracking-[0.08em] ${
                  active ? "bg-white text-indigo-900" : "text-slate-600"
                }`}
                href={`/manager?manager_tab=${tab.id}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {activeTab === "inbox" && (
        <>
          <section className="card mb-4 p-4" id="inactivity-penalty-inbox">
            <h2 className="text-xl font-black text-indigo-900">Inactive login penalty review</h2>
            <p className="mt-1 text-sm text-slate-600">
              Before applying points, review users who missed login days and approve/edit penalties.
            </p>
            {inactivityApplied && (
              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Inactivity penalty applied successfully.
              </p>
            )}
            {inactivitySkipped && (
              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Inactivity penalty skipped.
              </p>
            )}
            {inactivityError && (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {inactivityError}
              </p>
            )}
            {data.inactivityPenaltyAlerts.length > 0 ? (
              <div className="mt-3 space-y-3">
                {data.inactivityPenaltyAlerts.map((alert) => (
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={alert.targetId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-indigo-900">{alert.userDisplay}</p>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                        {alert.missedDays} day(s) inactive
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Last active baseline: {alert.baselineDate || "-"} • Login event: {alert.loginDate || "-"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      Suggested: {alert.suggestedPoints} pts ({alert.pointsPerDay}/day)
                    </p>

                    <form action={applyInactivityPenaltyAction} className="mt-3 space-y-2">
                      <input name="target_id" type="hidden" value={alert.targetId} />
                      <label className="block text-xs font-semibold text-slate-600">
                        Penalty points (editable)
                        <input className="input mt-1" defaultValue={alert.suggestedPoints} name="points" step={1} type="number" />
                      </label>
                      <input className="input" name="note" placeholder="Optional manager note" />
                      <button className="btn btn-primary w-full" type="submit">
                        Apply penalty
                      </button>
                    </form>

                    <form action={skipInactivityPenaltyAction} className="mt-2">
                      <input name="target_id" type="hidden" value={alert.targetId} />
                      <input className="input" name="note" placeholder="Optional skip reason" />
                      <button className="btn btn-muted mt-2 w-full text-slate-700" type="submit">
                        Skip for now
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                No pending inactive-login penalties.
              </p>
            )}
          </section>

          <section className="card mb-4 p-4" id="mission-assignment">
            <h2 className="text-xl font-black text-indigo-900">Mission assignment</h2>
            <p className="mt-1 text-sm text-slate-600">
              Create missions by user with date range, due date, and points. Accepted missions appear in user Home/Mission and can be added to checklist.
            </p>
            {missionAssigned && (
              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Mission assigned successfully.
              </p>
            )}
            {missionUpdated && (
              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Mission updated successfully.
              </p>
            )}
            {missionDeleted && (
              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Mission deleted successfully.
              </p>
            )}
            {missionAssignError && (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {missionAssignError}
              </p>
            )}
            <form action={assignMissionAction} className="mt-3 space-y-2">
              <label className="block text-xs font-semibold text-slate-600">
                Target user
                <select className="input mt-1" name="target_user_id" required>
                  <option value="">Select user</option>
                  {analyticsUsers.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.displayName} ({candidate.loginId})
                    </option>
                  ))}
                </select>
              </label>
              <input className="input" name="mission_title" placeholder="Mission title" required />
              <textarea className="input h-24 resize-none" name="mission_objective" placeholder="Objective" required />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <DateInputPicker label="Start date" name="start_date" />
                <DateInputPicker label="Due date" name="due_date" />
                <label className="text-xs font-semibold text-slate-600">
                  Duration (days)
                  <input className="input mt-1" min={0} name="duration_days" placeholder="Optional" step={1} type="number" />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Reward points
                  <input className="input mt-1" min={0} name="bonus_points" placeholder="Bonus points" step={1} type="number" />
                </label>
              </div>
              <button className="btn btn-primary w-full" type="submit">
                Save mission
              </button>
            </form>
            <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Mission preview</p>
              <p className="mt-1 font-semibold text-indigo-900">User / Objective / Start / Due / D-day / Reward points</p>
              <p className="text-slate-600">When user accepts mission, it can be auto-added to today checklist and shown with D-day on Home.</p>
            </div>
          </section>

          <section className="card mb-4 p-4" id="mission-management">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-black text-indigo-900">Manage assigned missions</h2>
              <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">
                {missionRows.length} active
              </span>
            </div>
            {missionRows.length > 0 ? (
              <div className="mt-3 space-y-3">
                {missionRows.map((row) => (
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={row.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-indigo-900">{row.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">User: {row.targetUserDisplay}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {row.bonusPoints > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            +{row.bonusPoints} pts
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          typeof row.daysLeft === "number" && row.daysLeft < 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {typeof row.daysLeft === "number"
                            ? row.daysLeft < 0
                              ? `D+${Math.abs(row.daysLeft)}`
                              : row.daysLeft === 0
                                ? "D-Day"
                                : `D-${row.daysLeft}`
                            : "Flexible"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{row.objective}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {row.startDate ? `Start ${row.startDate}` : "Start flexible"} • {row.dueDate ? `Due ${row.dueDate}` : "Due flexible"} •{" "}
                      {row.durationDays > 0 ? `${row.durationDays} days` : "No duration set"}
                    </p>

                    <form action={updateMissionAction} className="mt-3 space-y-2">
                      <input name="mission_announcement_id" type="hidden" value={row.id} />
                      <label className="block text-xs font-semibold text-slate-600">
                        Target user
                        <select className="input mt-1" defaultValue={row.targetUserId} name="target_user_id" required>
                          <option value="">Select user</option>
                          {analyticsUsers.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.displayName} ({candidate.loginId})
                            </option>
                          ))}
                        </select>
                      </label>
                      <input className="input" defaultValue={row.title} name="mission_title" placeholder="Mission title" required />
                      <textarea
                        className="input h-20 resize-none"
                        defaultValue={row.objective}
                        name="mission_objective"
                        placeholder="Objective"
                        required
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <DateInputPicker defaultValue={row.startDate} label="Start date" name="start_date" />
                        <DateInputPicker defaultValue={row.dueDate} label="Due date" name="due_date" />
                        <label className="text-xs font-semibold text-slate-600">
                          Duration (days)
                          <input
                            className="input mt-1"
                            defaultValue={row.durationDays > 0 ? row.durationDays : undefined}
                            min={0}
                            name="duration_days"
                            step={1}
                            type="number"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Reward points
                          <input className="input mt-1" defaultValue={row.bonusPoints} min={0} name="bonus_points" step={1} type="number" />
                        </label>
                      </div>
                      <button className="btn btn-primary w-full" type="submit">
                        Update mission
                      </button>
                    </form>

                    <form action={deleteMissionAction} className="mt-2">
                      <input name="mission_announcement_id" type="hidden" value={row.id} />
                      <button className="btn btn-muted w-full text-rose-700" type="submit">
                        Delete mission
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                No mission assignments yet.
              </p>
            )}
          </section>

          <section className="card mb-4 p-4" id="announcement-broadcast">
            <h2 className="text-xl font-black text-indigo-900">Notification broadcast</h2>
            <p className="mt-1 text-sm text-slate-600">
              Send announcement to all users or one selected user. Image attachment supports large files and user download.
            </p>
            {announced && (
              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Announcement sent successfully.
              </p>
            )}
            {announceError && (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {announceError}
              </p>
            )}
            <form action={createAnnouncementAction} className="mt-3 space-y-2" encType="multipart/form-data">
              <label className="block text-xs font-semibold text-slate-600">
                Target
                <select className="input mt-1" defaultValue="" name="target_user_id">
                  <option value="">All users (broadcast)</option>
                  {analyticsUsers.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.displayName} ({candidate.loginId})
                    </option>
                  ))}
                </select>
              </label>
              <input className="input" name="title" placeholder="Announcement title (optional)" />
              <textarea className="input h-24 resize-none" name="message" placeholder="Announcement message" required />
              <input className="input" name="image_url" placeholder="Image URL (optional)" type="url" />
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Or upload photo (max 50MB)</span>
                <input accept="image/*" className="input cursor-pointer" name="image_file" type="file" />
              </label>
              <button className="btn btn-primary w-full" type="submit">
                Announce
              </button>
            </form>
            <div className="mt-3 space-y-2">
              {data.announcements.map((item) => {
                const parsedMission = parseMissionAnnouncement(item.message ?? "");
                const preview = parsedMission
                  ? `${parsedMission.objective} • Due ${getMissionDueDate(parsedMission) || "Flexible"}${parsedMission.bonus_points > 0 ? ` • +${parsedMission.bonus_points} pts` : ""}`
                  : item.message;
                const targetDisplay = item.target_user_id && item.target_user_id !== "all"
                  ? (() => {
                      const target = userMap.get(item.target_user_id ?? "");
                      return (target?.name ?? "").trim() || target?.login_id || item.target_user_id;
                    })()
                  : "All users";
                return (
                  <article key={item.id} className="rounded-xl bg-slate-100 p-3 text-sm">
                    <p className="font-bold text-indigo-900">{item.title}</p>
                    {!parsedMission && <p className="text-xs font-semibold text-slate-500">Target: {targetDisplay}</p>}
                    <p className="text-slate-700">{preview}</p>
                    {item.image_url && !parsedMission && (
                      <div className="mt-2 space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={item.image_name || "Announcement image"} className="max-h-52 w-full rounded-xl object-cover" src={item.image_url} />
                        <div className="flex gap-1">
                          <a className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-700" href={item.image_url} rel="noreferrer" target="_blank">
                            Open image
                          </a>
                          <a
                            className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700"
                            download={item.image_name || "announcement-image"}
                            href={buildAttachmentDownloadHref(item.image_url, item.image_name || "announcement-image")}
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {data.announcements.length === 0 && (
                <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">No announcements yet.</p>
              )}
            </div>
          </section>

          <section className="card mb-4 p-4" id="reward-claim-inbox">
            <h2 className="text-xl font-black text-indigo-900">Reward claim inbox</h2>
            <p className="mt-1 text-sm text-slate-600">When users claim rewards, requests appear here and as login popup.</p>
            {data.rewardClaimAlerts.length > 0 ? (
              <>
                <ul className="mt-3 space-y-2">
                  {data.rewardClaimAlerts.map((item) => (
                    <li key={item.claim.id} className="rounded-xl bg-indigo-50 p-3 text-sm">
                      <p className="font-semibold text-indigo-900">{item.userDisplay}</p>
                      <p className="text-indigo-700">
                        🎁 {item.rewardTitle} ({item.rewardPoints} pts)
                      </p>
                    </li>
                  ))}
                </ul>
                <form action={acknowledgeManagerRewardAlertsAction} className="mt-3">
                  <input name="claim_ids" type="hidden" value={managerClaimAlerts.map((item) => item.claimId).join(",")} />
                  <button className="btn btn-primary w-full" type="submit">
                    Mark reward claim alerts as done
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">No pending reward-claim requests.</p>
            )}
          </section>

          <section className="card mb-4 p-4">
            <h2 className="text-xl font-black text-indigo-900">Manager priorities</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Review inactive-login penalty candidates and approve/edit points.</li>
              <li>Review daily check-ins and assign points/comments.</li>
              <li>Update rules/rewards and tune game balance.</li>
              <li>Handle user reward-claim requests from popup to-do alerts.</li>
            </ol>
            <p className="mt-2 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-700">
              Manager account is restricted to one owner only. Non-owner manager access is blocked.
            </p>
          </section>
        </>
      )}

      {activeTab === "review" && (
        <section className="card mb-4 p-4" id="submission-review">
          <h2 className="text-xl font-black text-indigo-900">Submission review</h2>
          <p className="mt-1 text-sm text-slate-600">
            Clicked from notification? The targeted submission appears first with highlight.
          </p>
          <p className="mt-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
            Submission base points are auto-added when user saves check-in. Review score here is manager-only adjustment.
          </p>
          <div className="mt-3 space-y-3">
            {orderedPendingSubmissions.map((submission) => {
              const pendingUser = userMap.get(submission.user_id);
              const displayName = (pendingUser?.name ?? "").trim() || pendingUser?.login_id || submission.user_id;
              const isFocused = focusedSubmissionId.length > 0 && submission.id === focusedSubmissionId;
              const suggestedPoints = submission.productive
                ? data.rules.productive_points
                : data.rules.non_productive_penalty;
              const taskCount = submission.task_list.length;
              const answers = submission.custom_answers ?? {};
              const answer = (key: string) => String(answers[key] ?? "").trim();
              const q1Label = findOptionLabel("q1", answer("q1")) || answer("q1") || "-";
              const q2Label = findOptionLabel("q2", answer("q2")) || answer("q2") || "-";
              const q3Label = findOptionLabel("q3", answer("q3")) || answer("q3") || "-";
              const q4Label = findOptionLabel("q4", answer("q4")) || answer("q4") || "-";
              const q5Label = findOptionLabel("q5", answer("q5")) || answer("q5") || submission.mood || "-";
              const q7Label = findOptionLabel("q7", answer("q7")) || answer("q7") || "-";
              const q8Label = findOptionLabel("q8", answer("q8")) || answer("q8") || "-";
              const q9Label = findOptionLabel("q9", answer("q9")) || answer("q9") || "-";
              const rawBlockers = dedupe([
                ...parseTokenList(answer("q6")),
                ...parseTokenList(answer("blocker")),
                ...parseTokenList(submission.primary_productivity_factor ?? "")
              ]);
              const blockerLabels = rawBlockers
                .map((value) => findOptionLabel("q6", value) || value)
                .filter((item) => item.trim().length > 0);
              const blockerMain = blockerLabels.length > 0 ? blockerLabels.join(", ") : "-";
              const blockerOther = answer("blocker_other") || (submission.primary_productivity_factor_note ?? "").trim();
              const quickTag = answer("quick_tag") || "-";
              const managerQuick = answer("manager_quick_message") || (submission.tomorrow_improvement_focus ?? "").trim() || "-";
              const workNote = answer("work_note") || (submission.completed_work_summary ?? "").trim() || answer("win");
              const managerMessage = answer("manager_message") || (submission.tomorrow_improvement_note ?? "").trim();
              const hasWorkNote = workNote.trim().length > 0 && workNote.trim() !== "-";
              const selfScoreRaw = Number(answer("q10"));
              const selfScore = Number.isFinite(selfScoreRaw)
                ? Math.max(1, Math.min(10, Math.round(selfScoreRaw)))
                : null;
              const selfScoreBand = selfScore === null
                ? "No self-rating"
                : selfScore >= 9
                  ? "Excellent confidence"
                  : selfScore >= 7
                    ? "Solid day"
                    : selfScore >= 5
                      ? "Mixed but meaningful"
                      : "Recovery needed";
              const selfScoreToneClass = selfScore === null
                ? "bg-slate-100 text-slate-700"
                : selfScore >= 8
                  ? "bg-emerald-100 text-emerald-700"
                  : selfScore >= 6
                    ? "bg-blue-100 text-blue-700"
                    : selfScore >= 4
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700";
              const previewRaw = Number(submission.performance_score_preview);
              const checkInPreviewScore = Number.isFinite(previewRaw)
                ? Math.max(0, Math.min(100, Math.round(previewRaw)))
                : null;
              const evidenceFileTokens = dedupe([
                ...(submission.evidence_files ?? []),
                ...parseTokenList(answer("evidence_files"))
              ]);
              const evidenceFiles = evidenceFileTokens.map((token) => describeAttachment(token));
              const evidenceLinks = dedupe([
                ...(submission.evidence_links ?? []),
                ...parseTokenList(answer("evidence_links")),
                ...parseTokenList(submission.file_url ?? "")
              ]);
              const attachmentCount = evidenceFiles.length + evidenceLinks.length;
              return (
                <article
                  className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${isFocused ? "ring-2 ring-indigo-400" : ""}`}
                  id={`submission-${submission.id}`}
                  key={submission.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending review</p>
                      <p className="mt-1 text-lg font-black text-indigo-900">{displayName}</p>
                      <p className="text-xs text-slate-500">ID: {submission.user_id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isFocused && (
                        <span className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-700">
                          From notification
                        </span>
                      )}
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700">
                        Pending
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-cyan-500 p-4 text-white shadow-[0_16px_34px_rgba(79,70,229,0.35)]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-100">Main review signal</p>
                    <div className="mt-1 flex items-end justify-between gap-3">
                      <p className="text-4xl font-black leading-none tabular-nums">
                        {selfScore ?? "-"}
                        <span className="ml-1 text-xl text-indigo-100">/10</span>
                      </p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selfScoreToneClass}`}>
                        {selfScoreBand}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-indigo-100">
                      User self-rating should be the primary anchor for manager point adjustments.
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Date</p>
                      <p className="text-sm font-semibold text-slate-800">{submission.date}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Suggested score</p>
                      <p className={`text-sm font-semibold ${suggestedPoints < 0 ? "text-rose-700" : "text-indigo-900"}`}>
                        {suggestedPoints > 0 ? `+${suggestedPoints}` : suggestedPoints} pts
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Preview score</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {checkInPreviewScore ?? 0}/100
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Productive / Calories</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {submission.productive ? "Yes" : "No"} / {submission.calories}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Daily check-in answers</p>
                      <div className="mt-1 grid gap-1 text-sm text-slate-700">
                        <p><span className="font-semibold text-slate-900">Plan completion (Q1):</span> {q1Label}</p>
                        <p><span className="font-semibold text-slate-900">Main task (Q2):</span> {q2Label}</p>
                        <p><span className="font-semibold text-slate-900">Plan flow (Q3):</span> {q3Label}</p>
                        <p><span className="font-semibold text-slate-900">Focus (Q4):</span> {q4Label}</p>
                        <p><span className="font-semibold text-slate-900">Productivity (Q5):</span> {q5Label}</p>
                        <p><span className="font-semibold text-slate-900">Blocker (Q6):</span> {blockerMain}</p>
                        {blockerOther && <p><span className="font-semibold text-slate-900">Blocker note:</span> {blockerOther}</p>}
                        <p><span className="font-semibold text-slate-900">Sleep (Q7):</span> {q7Label}</p>
                        <p><span className="font-semibold text-slate-900">Activity (Q8):</span> {q8Label}</p>
                        <p><span className="font-semibold text-slate-900">Calorie control (Q9):</span> {q9Label}</p>
                        <p><span className="font-semibold text-slate-900">Mood / Feeling:</span> {submission.mood} / {submission.feeling || "-"}</p>
                        <p><span className="font-semibold text-slate-900">Quick tag:</span> {quickTag}</p>
                        <p><span className="font-semibold text-slate-900">Quick manager msg:</span> {managerQuick}</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Left messages from user</p>
                      <div className="mt-2 space-y-2">
                        <div
                          className={`rounded-lg p-2.5 ring-1 ${
                            hasWorkNote
                              ? "bg-gradient-to-br from-amber-50 to-orange-50 ring-amber-300 shadow-sm"
                              : "bg-white ring-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">What did you work on today?</p>
                            {hasWorkNote && (
                              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-900">
                                User note
                              </span>
                            )}
                          </div>
                          <p className={`mt-1 text-sm whitespace-pre-wrap ${hasWorkNote ? "font-medium text-slate-800" : "text-slate-700"}`}>
                            {workNote || "-"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white p-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Message to manager</p>
                          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{managerMessage || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Task list ({taskCount})</p>
                      {taskCount > 0 ? (
                        <ul className="mt-1 flex flex-wrap gap-1">
                          {submission.task_list.map((task, idx) => (
                            <li className="rounded-full bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200" key={`${submission.id}-${idx}`}>
                              {task}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-slate-600">No task summary submitted.</p>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Attachments</p>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          {attachmentCount} item(s)
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2">
                        <div className="rounded-lg bg-white p-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Files / images</p>
                          {evidenceFiles.length > 0 ? (
                            <ul className="mt-1 space-y-2">
                              {evidenceFiles.map((item, idx) => (
                                <li className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200" key={`${submission.id}-file-${idx}`}>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="min-w-0 truncate text-xs font-semibold text-slate-800">{item.name}</p>
                                    <div className="flex items-center gap-1">
                                      {item.url && (
                                        <a
                                          className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700"
                                          href={item.url}
                                          rel="noreferrer"
                                          target="_blank"
                                        >
                                          Open
                                        </a>
                                      )}
                                      {item.url && (
                                        <a
                                          className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700"
                                          download={item.name}
                                          href={buildAttachmentDownloadHref(item.url, item.name)}
                                        >
                                          Download
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  {item.size > 0 && <p className="mt-1 text-[10px] text-slate-500">{formatAttachmentSize(item.size)}</p>}
                                  {item.kind === "image" && item.url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img alt={item.name} className="mt-2 h-28 w-full rounded-lg object-cover" src={item.url} />
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-slate-600">No file/image attachment.</p>
                          )}
                        </div>
                        <div className="rounded-lg bg-white p-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Links</p>
                          {evidenceLinks.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {evidenceLinks.map((url, idx) => (
                                <li className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200" key={`${submission.id}-link-${idx}`}>
                                  <a className="block truncate text-sm font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2" href={url} rel="noreferrer" target="_blank">
                                    {url}
                                  </a>
                                  <div className="mt-1 flex items-center gap-1">
                                    <a
                                      className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700"
                                      href={url}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      Open
                                    </a>
                                    <a
                                      className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700"
                                      download={`link-${idx + 1}.txt`}
                                      href={buildLinkDownloadHref(url)}
                                    >
                                      Download link
                                    </a>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-slate-600">No link attachment.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <SubmissionReviewForm
                    attachmentCount={attachmentCount}
                    checkInPreviewScore={checkInPreviewScore}
                    defaultPoints={suggestedPoints}
                    mood={submission.mood}
                    productive={submission.productive}
                    selfScore={selfScore}
                    submissionId={submission.id}
                    taskSummary={submission.task_list.join(", ")}
                  />
                </article>
              );
            })}
            {orderedPendingSubmissions.length === 0 && <p className="text-sm text-slate-500">No pending submissions.</p>}
          </div>
        </section>
      )}

      {activeTab === "analytics" && (
        <ManagerUserAnalytics
          auditLogs={data.auditLogs}
          score={selectedAnalyticsScore}
          selectedRange={analyticsRange}
          selectedUserId={selectedAnalyticsUser?.id ?? ""}
          submissions={selectedAnalyticsSubmissions}
          users={analyticsUsers}
        />
      )}

      {activeTab === "rules" && (
        <>
          <section className="card mb-4 p-4">
            <h2 className="text-xl font-black text-indigo-900">Rule management</h2>
            <p className="mt-1 text-sm text-slate-600">
              Edit each section below. Numbers are applied immediately after save, and rule version is updated with changelog note.
            </p>
            <form action={updateRulesAction} className="mt-3 space-y-3">
              <article className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">1) Points setup</p>
                <p className="mt-1 text-xs text-slate-500">How many points users gain/lose when manager approves submissions.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Check-in base points
                    <input className="input mt-1" defaultValue={data.rules.checkin_points} name="checkin_points" type="number" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Submission base points
                    <input className="input mt-1" defaultValue={data.rules.submission_points} name="submission_points" type="number" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Productive bonus points
                    <input className="input mt-1" defaultValue={data.rules.productive_points} name="productive_points" type="number" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Non-productive penalty
                    <input className="input mt-1" defaultValue={data.rules.non_productive_penalty} name="non_productive_penalty" type="number" />
                  </label>
                  <label className="col-span-2 rounded-xl bg-white p-2 text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-2">
                      <input
                        defaultChecked={Boolean(data.rules.inactivity_penalty_enabled)}
                        name="inactivity_penalty_enabled"
                        type="checkbox"
                      />
                      Enable inactive-login penalty workflow
                    </span>
                  </label>
                  <label className="col-span-2 text-xs font-semibold text-slate-600">
                    Inactive-login penalty per missed day
                    <input
                      className="input mt-1"
                      defaultValue={data.rules.inactivity_penalty_points_per_day}
                      name="inactivity_penalty_points_per_day"
                      type="number"
                    />
                  </label>
                </div>
              </article>

              <article className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">2) Streak & Multiplier</p>
                <p className="mt-1 text-xs text-slate-500">Define when streak starts rewarding and when multiplier activates.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Streak milestone days
                    <input className="input mt-1" defaultValue={data.rules.streak_days} name="streak_days" type="number" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Multiplier trigger days
                    <input className="input mt-1" defaultValue={data.rules.multiplier_trigger_days} name="multiplier_trigger_days" type="number" />
                  </label>
                  <label className="col-span-2 text-xs font-semibold text-slate-600">
                    Multiplier value (e.g. 1.5, 2.0)
                    <input className="input mt-1" defaultValue={data.rules.multiplier_value} name="multiplier_value" step="0.1" type="number" />
                  </label>
                </div>
              </article>

              <article className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">3) App messages</p>
                <p className="mt-1 text-xs text-slate-500">Messages shown to user on home/success/rules pages.</p>
                <div className="mt-2 space-y-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Greeting message
                    <input className="input mt-1" defaultValue={data.rules.greeting_message} name="greeting_message" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Success message
                    <input className="input mt-1" defaultValue={data.rules.success_message} name="success_message" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Rules description text
                    <textarea className="input mt-1 h-20 resize-none" defaultValue={data.rules.rule_description_text} name="rule_description_text" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Manager logic text
                    <textarea className="input mt-1 h-20 resize-none" defaultValue={data.rules.manager_logic_text} name="manager_logic_text" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Rewards description text
                    <textarea className="input mt-1 h-20 resize-none" defaultValue={data.rules.rewards_blurb} name="rewards_blurb" />
                  </label>
                </div>
              </article>

              <article className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">4) Penalty (Risk Zone)</p>
                <p className="mt-1 text-xs text-slate-500">
                  Add / edit / delete each penalty row individually.
                </p>
                <div className="mt-2 space-y-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Penalty description
                    <textarea className="input mt-1 h-20 resize-none" defaultValue={data.rules.penalty_description} name="penalty_description" />
                  </label>
                  <article className="rounded-xl border border-slate-200 bg-indigo-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Text penalty rules</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Add/edit/delete penalty actions such as &quot;Phone in the locked box&quot; or &quot;Laptop in the office&quot;.
                    </p>
                    <div className="mt-2">
                      <ManagerPenaltyTextEditor initialRules={data.rules.penalty_action_rules ?? []} />
                    </div>
                  </article>
                  <ManagerPenaltyEditor initialRows={penaltyRows} />
                  <article className="rounded-xl border border-slate-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Penalty notice popup (optional)</p>
                    <p className="mt-1 text-xs text-amber-800">
                      If filled, this exact message is sent to all users as a bell popup announcement right after save.
                      If left empty, a default penalty update notice is auto-sent whenever penalty text rules change.
                    </p>
                    <textarea
                      className="input mt-2 h-20 resize-none bg-white"
                      name="penalty_notice"
                      placeholder="Example: New penalty rule active today: Phone in the locked box after 11PM."
                    />
                  </article>
                </div>
              </article>

              <article className="rounded-2xl bg-indigo-50 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">5) Save update</p>
                <label className="mt-2 block text-xs font-semibold text-indigo-700">
                  Changelog note (what changed)
                  <input className="input mt-1 bg-white" name="note" placeholder="Example: lowered productive bonus from 4 to 3" />
                </label>
                <label className="mt-2 block text-xs font-semibold text-indigo-700">
                  Manual rule version (optional)
                  <input
                    className="input mt-1 bg-white"
                    min={1}
                    name="target_rule_version"
                    placeholder="Leave blank to auto bump"
                    type="number"
                  />
                </label>
                <button className="btn btn-primary mt-3 w-full" type="submit">
                  Save rules and bump version
                </button>
                {penaltyNoticeSent && (
                  <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    Penalty notice popup sent to users.
                  </p>
                )}
                {announceError && (
                  <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {announceError}
                  </p>
                )}
                <button className="btn btn-muted mt-2 w-full" name="reset_version_to_one" type="submit" value="1">
                  Reset version label to 1 (keep content)
                </button>
              </article>
            </form>
          </section>

          <section className="card mb-4 p-4">
            <h2 className="text-xl font-black text-indigo-900">User view preview</h2>
            <p className="mt-1 text-sm text-slate-600">
              These values are exactly what users will see after manager edits.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-100 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Rule version</p>
                <p className="font-bold text-indigo-900">v{data.rules.rule_version}</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Multiplier</p>
                <p className="font-bold text-indigo-900">
                  {data.rules.multiplier_trigger_days} days / x{data.rules.multiplier_value}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Penalty thresholds</p>
                <p className="font-bold text-indigo-900">
                  {data.rules.penalty_thresholds.length > 0 ? data.rules.penalty_thresholds.join(", ") : "None"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Penalty text rules</p>
                <p className="font-bold text-indigo-900">
                  {(data.rules.penalty_action_rules ?? []).length > 0
                    ? `${(data.rules.penalty_action_rules ?? []).length} active`
                    : "None"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Inactive-login penalty</p>
                <p className="font-bold text-indigo-900">
                  {data.rules.inactivity_penalty_enabled
                    ? `${data.rules.inactivity_penalty_points_per_day} pts / missed day`
                    : "Disabled"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Rewards</p>
                <p className="font-bold text-indigo-900">{data.rewards.length} cards</p>
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === "rewards" && (
        <>
          <section className="card mb-4 p-4">
            <h2 className="text-xl font-black text-indigo-900">Penalty / Balance</h2>
            <p className="mt-1 text-sm text-slate-600">
              Monitor negative points and total claimable dollar balance unlocked by penalty rules.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Open penalty events</p>
                <p className="text-lg font-black text-indigo-900">{data.openPenaltyEvents.length}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Claimable balance</p>
                <p className="text-lg font-black text-emerald-800">${claimableTotal.toFixed(0)}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {negativeRows.length > 0 ? (
                negativeRows.map((row) => (
                  <article key={row.user.id} className="rounded-xl bg-slate-100 p-3 text-sm">
                    <p className="font-semibold text-indigo-900">{row.user.displayName}</p>
                    <p className="text-slate-700">Negative points: {row.negativePoints}</p>
                    <p className="text-slate-600">
                      Claimable: ${(claimableByUser.get(row.user.id) ?? 0).toFixed(0)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                  No users are currently in negative points.
                </p>
              )}
            </div>
          </section>

          <section className="card mb-4 p-4">
            <h2 className="text-xl font-black text-indigo-900">Penalty rewards</h2>
            <div className="mt-3 space-y-2">
              {data.openPenaltyEvents.map((event) => (
                <article key={event.id} className="rounded-xl bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-800">
                    {event.user_id} at {event.threshold} ({event.reward_value})
                  </p>
                  <p className="text-xs text-amber-700">{event.reward_label}</p>
                  {event.manager_reward_unlocked && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-700">
                      Claim action is disabled in manager mode to keep this console review-only.
                    </div>
                  )}
                </article>
              ))}
              {data.openPenaltyEvents.length === 0 && (
                <p className="text-sm text-slate-500">No active penalty rewards to claim.</p>
              )}
            </div>
          </section>

          <section className="card mb-4 p-4">
            <h2 className="text-xl font-black text-indigo-900">Reward management</h2>
            <p className="mt-1 text-sm text-slate-600">Add, edit, and delete reward cards shown to users.</p>
            <div className="mt-3 space-y-3">
              {data.rewards.map((reward) => (
                <article key={reward.id} className="rounded-2xl bg-slate-100 p-3">
                  <form action={updateRewardAction} className="space-y-2">
                    <input name="reward_id" type="hidden" value={reward.id} />
                    <input className="input" defaultValue={reward.title} name="title" placeholder="Reward title" required />
                    <input
                      className="input"
                      defaultValue={reward.description}
                      name="description"
                      placeholder="Reward description"
                      required
                    />
                    <input
                      className="input"
                      defaultValue={reward.required_points}
                      min={1}
                      name="required_points"
                      placeholder="Required points"
                      type="number"
                      required
                    />
                    <button className="btn btn-primary w-full" type="submit">
                      Save reward changes
                    </button>
                  </form>
                  <form action={deleteRewardAction} className="mt-2">
                    <input name="reward_id" type="hidden" value={reward.id} />
                    <button className="btn btn-muted w-full text-rose-700" type="submit">
                      Delete reward
                    </button>
                  </form>
                </article>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="text-base font-bold text-indigo-900">Add new reward</h3>
              <form action={createRewardAction} className="mt-2 space-y-2">
                <input className="input" name="title" placeholder="Reward title" required />
                <input className="input" name="description" placeholder="Reward description" required />
                <input className="input" min={1} name="required_points" placeholder="Required points" type="number" required />
                <button className="btn btn-primary w-full" type="submit">
                  Add reward
                </button>
              </form>
            </div>
          </section>
        </>
      )}

      {activeTab === "logs" && (
        <section className="card p-4">
          <h2 className="text-xl font-black text-indigo-900">Audit logs</h2>
          <ul className="mt-3 space-y-2">
            {data.auditLogs.map((log) => (
              <li key={log.id} className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                <p className="font-semibold">{log.action}</p>
                <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</p>
              </li>
            ))}
            {data.auditLogs.length === 0 && <li className="text-sm text-slate-500">No logs yet.</li>}
          </ul>
        </section>
      )}
    </main>
  );
}
