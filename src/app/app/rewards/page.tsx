import { claimRewardAction } from "@/lib/services/actions";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function RewardsPage() {
  const { bundle, strings } = await getViewerContext();
  const claims = new Map(bundle.rewardClaims.map((claim) => [claim.reward_id, claim]));

  return (
    <UserPageShell activeTab="rewards" labels={strings} subtitle="Collect and claim" title="Rewards">
      <section className="space-y-3">
        {bundle.rewards.map((reward) => {
          const claim = claims.get(reward.id);
          const locked = bundle.score.total_points < reward.required_points;
          const status = claim?.status === "claimed" ? "Claimed" : locked ? "Locked" : "Available";

          return (
            <article key={reward.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-black text-indigo-900">{reward.title}</h2>
                  <p className="text-sm text-slate-500">{reward.description}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    status === "Claimed"
                      ? "bg-emerald-100 text-emerald-700"
                      : status === "Available"
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-600">Required points: {reward.required_points}</p>

              {status === "Available" && (
                <form action={claimRewardAction} className="mt-3">
                  <input name="reward_id" type="hidden" value={reward.id} />
                  <button className="btn btn-primary w-full" type="submit">
                    Claim now
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </section>
    </UserPageShell>
  );
}
