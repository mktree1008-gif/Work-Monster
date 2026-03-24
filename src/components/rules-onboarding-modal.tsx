"use client";

import { useMemo, useState } from "react";
import { CharacterAlert } from "@/components/character-alert";
import { getManagerCue } from "@/lib/character-system";
import { getLocalizedRuleLine, localizeRuleChangelogItem } from "@/lib/rules-copy";
import { Locale, RuleChangeLogItem } from "@/lib/types";
import { acknowledgeRulesAction } from "@/lib/services/actions";

type Props = {
  openOnLoad: boolean;
  ruleVersion: number;
  lastUpdated: string;
  changelog: RuleChangeLogItem[];
  lastSeenVersion: number;
  locale: Locale;
};

export function RulesOnboardingModal({
  openOnLoad,
  ruleVersion,
  lastUpdated,
  changelog,
  lastSeenVersion,
  locale
}: Props) {
  const [open, setOpen] = useState(openOnLoad);
  const updatedItems = useMemo(
    () => changelog.filter((item) => item.version > lastSeenVersion),
    [changelog, lastSeenVersion]
  );
  const localizedUpdatedItems = useMemo(
    () => updatedItems.map((item) => localizeRuleChangelogItem(item, locale)),
    [updatedItems, locale]
  );
  const managerCue = getManagerCue("rules_encouraging", locale);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 p-4">
      <div className="container-mobile card mt-12 max-h-[80dvh] overflow-y-auto p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-500">Rule Update</p>
        <h2 className="display-cute mt-2 text-3xl text-indigo-900">Version {ruleVersion}</h2>
        <p className="mt-2 text-sm text-slate-500">Last updated {new Date(lastUpdated).toLocaleString()}</p>
        <div className="mt-3">
          <CharacterAlert role="manager" cue={managerCue} compact />
        </div>

        <div className="mt-4 space-y-3">
          {localizedUpdatedItems.map((item) => (
            <article key={item.version} className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                Updated v{item.version}
              </p>
              <h3 className="mt-1 text-lg font-bold text-indigo-900">{item.title}</h3>
              <p className="text-sm text-indigo-800/80">{item.description}</p>
            </article>
          ))}
        </div>

        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {getLocalizedRuleLine(locale, "recovery_banner")}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn btn-muted w-full" onClick={() => setOpen(false)} type="button">
            Close
          </button>
          <form action={acknowledgeRulesAction}>
            <button className="btn btn-primary w-full" type="submit">
              I understand
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
