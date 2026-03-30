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
import { SubmissionReviewForm } from "@/components/submission-review-form";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { getSession } from "@/lib/session";
import {
  acknowledgeManagerRewardAlertsAction,
  acknowledgeNotificationsAction,
  createAnnouncementAction,
  createRewardAction,
  deleteRewardAction,
  logoutAction,
  updateRewardAction,
  updateRulesAction
} from "@/lib/services/actions";
import { getManagerOverview } from "@/lib/services/game-service";

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

  const analyticsRange = params.analytics_range === "month" ? "month" : "week";
  const requestedAnalyticsUserId = typeof params.analytics_user === "string" ? params.analytics_user : "";
  const selectedAnalyticsUser =
    analyticsUsers.find((item) => item.id === requestedAnalyticsUserId) ?? analyticsUsers[0] ?? null;

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
          <section className="card mb-4 p-4" id="announcement-broadcast">
            <h2 className="text-xl font-black text-indigo-900">Notification broadcast</h2>
            <p className="mt-1 text-sm text-slate-600">
              Send a message/photo to all users. It will appear in each user&apos;s bell notifications.
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
              <input className="input" name="title" placeholder="Announcement title (optional)" />
              <textarea className="input h-24 resize-none" name="message" placeholder="Announcement message" required />
              <input className="input" name="image_url" placeholder="Image URL (optional)" type="url" />
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Or upload photo (max 700KB)</span>
                <input accept="image/*" className="input cursor-pointer" name="image_file" type="file" />
              </label>
              <button className="btn btn-primary w-full" type="submit">
                Announce
              </button>
            </form>
            <div className="mt-3 space-y-2">
              {data.announcements.map((item) => (
                <article key={item.id} className="rounded-xl bg-slate-100 p-3 text-sm">
                  <p className="font-bold text-indigo-900">{item.title}</p>
                  <p className="text-slate-700">{item.message}</p>
                </article>
              ))}
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

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Date</p>
                      <p className="text-sm font-semibold text-slate-800">{submission.date}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Suggested score</p>
                      <p className={`text-sm font-semibold ${suggestedPoints < 0 ? "text-rose-700" : "text-indigo-900"}`}>
                        {suggestedPoints > 0 ? `+${suggestedPoints}` : suggestedPoints} pts
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Mood / Feeling</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {submission.mood} / {submission.feeling || "-"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Productive / Calories</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {submission.productive ? "Yes" : "No"} / {submission.calories}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Check-in answers</p>
                      <div className="mt-1 grid gap-1 text-sm text-slate-700">
                        <p><span className="font-semibold text-slate-900">Focus:</span> {submission.custom_answers.focus || "-"}</p>
                        <p><span className="font-semibold text-slate-900">Blocker:</span> {submission.custom_answers.blocker || "-"}</p>
                        <p><span className="font-semibold text-slate-900">Win:</span> {submission.custom_answers.win || "-"}</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
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

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Attachment</p>
                      {submission.file_url ? (
                        <a className="mt-1 inline-flex rounded-lg bg-indigo-100 px-2 py-1 text-sm font-semibold text-indigo-700" href={submission.file_url} rel="noreferrer" target="_blank">
                          Open attachment
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-slate-600">No attachment uploaded.</p>
                      )}
                    </div>
                  </div>

                  <SubmissionReviewForm
                    defaultPoints={suggestedPoints}
                    mood={submission.mood}
                    productive={submission.productive}
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
