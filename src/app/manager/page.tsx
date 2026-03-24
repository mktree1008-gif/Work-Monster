import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { isManagerOwnerEmail } from "@/lib/constants";
import { ManagerClaimAlertsModal } from "@/components/manager-claim-alerts-modal";
import { ManagerReviewResultPopup } from "@/components/manager-review-result-popup";
import { SubmissionReviewForm } from "@/components/submission-review-form";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { getSession } from "@/lib/session";
import {
  acknowledgeManagerRewardAlertsAction,
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
    redirect("/app/questions");
  }
  if ((user.name ?? "").trim().length === 0) {
    redirect("/auth/nickname");
  }

  const data = await getManagerOverview();
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const reviewed = params.reviewed === "1";
  const approved = params.approved === "1";
  const reviewedPoints = Number(params.points ?? 0);
  const reviewedNote = typeof params.note === "string" ? params.note : "";
  const managerClaimAlerts = data.rewardClaimAlerts.map((item) => ({
    claimId: item.claim.id,
    userDisplay: item.userDisplay,
    rewardTitle: item.rewardTitle,
    rewardPoints: item.rewardPoints,
    claimedAt: item.claim.claimed_at
  }));

  return (
    <main className="container-mobile page-padding">
      <ManagerReviewResultPopup
        approved={approved}
        note={reviewedNote}
        openOnMount={reviewed}
        points={Number.isFinite(reviewedPoints) ? reviewedPoints : 0}
      />
      <ManagerClaimAlertsModal action={acknowledgeManagerRewardAlertsAction} alerts={managerClaimAlerts} />

      <header className="card mb-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manager Console</p>
        <h1 className="display-cute text-4xl font-extrabold text-indigo-900">{APP_NAME}</h1>
        <div className="mt-3 flex gap-2">
          <form action={logoutAction}>
            <button className="btn btn-primary text-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

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

      <section className="card mb-4 p-4">
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
        <h2 className="text-xl font-black text-indigo-900">Submission review</h2>
        <div className="mt-3 space-y-3">
          {data.pendingSubmissions.map((submission) => (
            <article key={submission.id} className="rounded-2xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{submission.user_id}</p>
              <p className="text-sm text-slate-700">Mood: {submission.mood}</p>
              <p className="text-sm text-slate-700">Productive: {submission.productive ? "Yes" : "No"}</p>
              <p className="text-sm text-slate-700">Tasks: {submission.task_list.join(", ") || "-"}</p>
              <p className="mt-1 text-xs text-slate-500">
                Suggested by rules:{" "}
                {submission.productive
                  ? data.rules.submission_points + data.rules.productive_points
                  : data.rules.non_productive_penalty}{" "}
                pts
              </p>
              <SubmissionReviewForm
                defaultPoints={
                  submission.productive
                    ? data.rules.submission_points + data.rules.productive_points
                    : data.rules.non_productive_penalty
                }
                mood={submission.mood}
                productive={submission.productive}
                submissionId={submission.id}
                taskSummary={submission.task_list.join(", ")}
              />
            </article>
          ))}
          {data.pendingSubmissions.length === 0 && <p className="text-sm text-slate-500">No pending submissions.</p>}
        </div>
      </section>

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
              Thresholds use negative values only. Example: -1, -5, -10
            </p>
            <div className="mt-2 space-y-2">
              <label className="text-xs font-semibold text-slate-600">
                Penalty description
                <textarea className="input mt-1 h-20 resize-none" defaultValue={data.rules.penalty_description} name="penalty_description" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Penalty thresholds (comma separated)
                <input className="input mt-1" defaultValue={data.rules.penalty_thresholds.join(",")} name="penalty_thresholds" placeholder="-1,-5,-10" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Penalty reward config (JSON)
                <textarea className="input mt-1 h-24 resize-none font-mono text-xs" defaultValue={JSON.stringify(data.rules.penalty_rewards)} name="penalty_rewards_json" />
              </label>
            </div>
          </article>

          <article className="rounded-2xl bg-indigo-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">5) Save update</p>
            <label className="mt-2 block text-xs font-semibold text-indigo-700">
              Changelog note (what changed)
              <input className="input mt-1 bg-white" name="note" placeholder="Example: lowered productive bonus from 4 to 3" />
            </label>
            <button className="btn btn-primary mt-3 w-full" type="submit">
              Save rules and bump version
            </button>
          </article>
        </form>
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
            <p className="font-bold text-indigo-900">{data.rules.penalty_thresholds.join(", ")}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Rewards</p>
            <p className="font-bold text-indigo-900">{data.rewards.length} cards</p>
          </div>
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
    </main>
  );
}
