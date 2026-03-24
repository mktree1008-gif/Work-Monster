import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { getSession } from "@/lib/session";
import {
  claimPenaltyRewardAction,
  createRewardAction,
  logoutAction,
  reviewSubmissionAction,
  updateRulesAction
} from "@/lib/services/actions";
import { getManagerOverview } from "@/lib/services/game-service";

export default async function ManagerPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") {
    redirect("/auth/login");
  }

  const repo = getGameRepository();
  const user = await repo.getUser(session.uid);
  if (!user) {
    redirect("/auth/login");
  }
  if ((user.name ?? "").trim().length === 0) {
    redirect("/auth/nickname");
  }

  const data = await getManagerOverview();

  return (
    <main className="container-mobile page-padding">
      <header className="card mb-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manager Console</p>
        <h1 className="display-cute text-4xl font-extrabold text-indigo-900">{APP_NAME}</h1>
        <div className="mt-3 flex gap-2">
          <Link className="btn btn-muted text-sm" href="/app/questions">
            Open user app
          </Link>
          <form action={logoutAction}>
            <button className="btn btn-primary text-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

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
              <form action={reviewSubmissionAction} className="mt-3 grid grid-cols-2 gap-2">
                <input name="submission_id" type="hidden" value={submission.id} />
                <input className="input col-span-2" name="note" placeholder="Optional note" />
                <input
                  className="input"
                  defaultValue={
                    submission.productive
                      ? data.rules.submission_points + data.rules.productive_points
                      : data.rules.non_productive_penalty
                  }
                  name="points"
                  type="number"
                />
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <button className="btn btn-primary w-full" name="approved" type="submit" value="true">
                    Give Points
                  </button>
                  <button className="btn btn-muted w-full" name="approved" type="submit" value="false">
                    No
                  </button>
                </div>
              </form>
            </article>
          ))}
          {data.pendingSubmissions.length === 0 && <p className="text-sm text-slate-500">No pending submissions.</p>}
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="text-xl font-black text-indigo-900">Rule management</h2>
        <form action={updateRulesAction} className="mt-3 space-y-2">
          <input className="input" defaultValue={data.rules.checkin_points} name="checkin_points" type="number" />
          <input className="input" defaultValue={data.rules.submission_points} name="submission_points" type="number" />
          <input className="input" defaultValue={data.rules.productive_points} name="productive_points" type="number" />
          <input
            className="input"
            defaultValue={data.rules.non_productive_penalty}
            name="non_productive_penalty"
            type="number"
          />
          <input className="input" defaultValue={data.rules.streak_days} name="streak_days" type="number" />
          <input
            className="input"
            defaultValue={data.rules.multiplier_trigger_days}
            name="multiplier_trigger_days"
            type="number"
          />
          <input
            className="input"
            defaultValue={data.rules.multiplier_value}
            name="multiplier_value"
            step="0.1"
            type="number"
          />
          <input className="input" defaultValue={data.rules.greeting_message} name="greeting_message" />
          <input className="input" defaultValue={data.rules.success_message} name="success_message" />
          <textarea className="input h-20 resize-none" defaultValue={data.rules.rule_description_text} name="rule_description_text" />
          <textarea className="input h-20 resize-none" defaultValue={data.rules.manager_logic_text} name="manager_logic_text" />
          <textarea className="input h-20 resize-none" defaultValue={data.rules.penalty_description} name="penalty_description" />
          <input
            className="input"
            defaultValue={data.rules.penalty_thresholds.join(",")}
            name="penalty_thresholds"
            placeholder="-1,-5,-10"
          />
          <textarea
            className="input h-24 resize-none font-mono text-xs"
            defaultValue={JSON.stringify(data.rules.penalty_rewards)}
            name="penalty_rewards_json"
          />
          <textarea className="input h-20 resize-none" defaultValue={data.rules.rewards_blurb} name="rewards_blurb" />
          <input className="input" name="note" placeholder="Change note for changelog" />
          <button className="btn btn-primary w-full" type="submit">
            Save rules and bump version
          </button>
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
                <form action={claimPenaltyRewardAction} className="mt-2">
                  <input name="event_id" type="hidden" value={event.id} />
                  <button className="btn btn-primary w-full text-sm" type="submit">
                    Claim manager reward
                  </button>
                </form>
              )}
            </article>
          ))}
          {data.openPenaltyEvents.length === 0 && (
            <p className="text-sm text-slate-500">No active penalty rewards to claim.</p>
          )}
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="text-xl font-black text-indigo-900">Create reward</h2>
        <form action={createRewardAction} className="mt-3 space-y-2">
          <input className="input" name="title" placeholder="Reward title" required />
          <input className="input" name="description" placeholder="Reward description" required />
          <input className="input" min={1} name="required_points" placeholder="Required points" type="number" />
          <button className="btn btn-primary w-full" type="submit">
            Add reward
          </button>
        </form>
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
