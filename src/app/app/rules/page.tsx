import { CharacterAlert } from "@/components/character-alert";
import { CharacterToast } from "@/components/character-toast";
import { getManagerCue } from "@/lib/character-system";
import { getLocalizedRuleLine, localizeRuleChangelogItem, localizeRuleLongText } from "@/lib/rules-copy";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function RulesPage() {
  const { bundle, strings } = await getViewerContext();
  const rules = bundle.rules;
  const locale = bundle.user.locale;
  const managerCue = getManagerCue("rules_encouraging", bundle.user.locale);
  const localizedRuleDescription = localizeRuleLongText(rules.rule_description_text, locale);
  const localizedRewardsBlurb = localizeRuleLongText(rules.rewards_blurb, locale);
  const localizedPenaltyDescription = localizeRuleLongText(rules.penalty_description, locale);
  const localizedManagerLogic = localizeRuleLongText(rules.manager_logic_text, locale);
  const localizedChangelog = rules.changelog.map((item) => localizeRuleChangelogItem(item, locale));

  return (
    <UserPageShell activeTab="rules" labels={strings} subtitle="Know the game mechanics" title="Rules">
      <CharacterToast cue={managerCue} durationMs={2000} openOnMount role="manager" tone="success" />
      <section className="mb-4">
        <CharacterAlert role="manager" cue={managerCue} />
      </section>

      <section className="card p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">rule_version</p>
        <p className="mt-1 text-3xl font-black text-indigo-900">v{rules.rule_version}</p>
        <p className="text-sm text-slate-500">last_updated: {new Date(rules.last_updated).toLocaleString()}</p>
      </section>

      <section className="mt-4 space-y-3">
        <article className="card p-4">
          <h2 className="font-black text-indigo-900">Rule summary</h2>
          <p className="text-sm text-slate-600">{localizedRuleDescription}</p>
        </article>

        <article className="card p-4">
          <h2 className="font-black text-indigo-900">💰 Points system</h2>
          <p className="text-sm text-slate-600">Check-in: +{rules.checkin_points}</p>
          <p className="text-sm text-slate-600">Submission approved: +{rules.submission_points}</p>
          <p className="text-sm text-slate-600">Productive bonus: +{rules.productive_points}</p>
          <p className="text-sm text-slate-600">Non-productive penalty: {rules.non_productive_penalty}</p>
        </article>

        <article className="card p-4">
          <h2 className="font-black text-indigo-900">🔥 Streak system</h2>
          <p className="text-sm text-slate-600">{getLocalizedRuleLine(locale, "streak_desc")}</p>
          <p className="text-sm text-slate-600">Current threshold target: {rules.streak_days} days.</p>
        </article>

        <article className="card p-4">
          <h2 className="font-black text-indigo-900">⭐ Multiplier rules</h2>
          <p className="text-sm text-slate-600">{getLocalizedRuleLine(locale, "multiplier_desc")}</p>
          <p className="text-sm text-slate-600">Trigger: {rules.multiplier_trigger_days} days, Value: x{rules.multiplier_value}</p>
        </article>

        <article className="card p-4">
          <h2 className="font-black text-indigo-900">🎁 Rewards</h2>
          <p className="text-sm text-slate-600">{localizedRewardsBlurb}</p>
        </article>

        <article className="card p-4">
          <h2 className="font-black text-indigo-900">Penalty rules (Risk Zone)</h2>
          <p className="text-sm text-slate-600">{localizedPenaltyDescription}</p>
          <p className="text-sm text-slate-600">penalty_thresholds: {rules.penalty_thresholds.join(", ")}</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {rules.penalty_rewards.map((reward) => (
              <li key={reward.threshold}>
                {reward.threshold}: {reward.label} ({reward.value})
              </li>
            ))}
          </ul>
        </article>

        <article className="card p-4">
          <h2 className="font-black text-indigo-900">Manager logic</h2>
          <p className="text-sm text-slate-600">{localizedManagerLogic}</p>
        </article>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-black text-indigo-900">Recently Updated</h2>
        <ul className="mt-2 space-y-2 text-sm text-slate-600">
          {localizedChangelog.map((item) => (
            <li key={`${item.version}-${item.updated_at}`} className="rounded-xl bg-slate-100 p-3">
              <p className="font-semibold text-indigo-900">
                v{item.version} - {item.title}
              </p>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </UserPageShell>
  );
}
