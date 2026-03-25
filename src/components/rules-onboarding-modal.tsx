"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CharacterAlert } from "@/components/character-alert";
import { CharacterToast } from "@/components/character-toast";
import { getManagerCue } from "@/lib/character-system";
import { localizeRuleChangelogItem } from "@/lib/rules-copy";
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const updatedItems = useMemo(
    () => changelog.filter((item) => item.version > lastSeenVersion),
    [changelog, lastSeenVersion]
  );
  const localizedUpdatedItems = useMemo(
    () => updatedItems.map((item) => localizeRuleChangelogItem(item, locale)),
    [updatedItems, locale]
  );
  const latestUpdatedItem = localizedUpdatedItems[0] ?? null;
  const isFirstVersionView = ruleVersion <= 1;
  const updatedCardTitle = isFirstVersionView
    ? "Initial Work Monster Rules"
    : latestUpdatedItem?.title ?? `Rule changes in v${ruleVersion}`;
  const updatedCardDescription = isFirstVersionView
    ? "Points, streaks, multipliers, rewards, and Risk Zone are now active."
    : latestUpdatedItem?.description ?? "Manager updated the latest game rules.";
  const managerCue = getManagerCue("rules_encouraging", locale);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[75] bg-slate-950/40 p-4">
      <CharacterToast cue={managerCue} durationMs={2400} openOnMount={openOnLoad} role="manager" tone="success" />
      <div className="container-mobile card mt-12 max-h-[80dvh] overflow-y-auto p-5">
        <button
          className="mb-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
              return;
            }
            setOpen(false);
          }}
          type="button"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-500">Rule Update</p>
        <h2 className="display-cute mt-2 text-3xl text-indigo-900">Version {ruleVersion}</h2>
        <p className="mt-2 text-sm text-slate-500">Last updated {new Date(lastUpdated).toLocaleString()}</p>
        <Link className="mt-3 block" href="/app/rules">
          <CharacterAlert role="manager" cue={managerCue} compact />
        </Link>

        <div className="mt-4 space-y-3">
          <button
            className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-left transition hover:bg-indigo-100"
            onClick={() => setDetailsOpen(true)}
            type="button"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
              Updated V{ruleVersion}
            </p>
            <h3 className="mt-1 text-lg font-bold text-indigo-900">{updatedCardTitle}</h3>
            <p className="text-sm text-indigo-800/80">{updatedCardDescription}</p>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn btn-muted w-full" onClick={() => setOpen(false)} type="button">
            Close
          </button>
          <form
            action={acknowledgeRulesAction}
            onSubmit={() => {
              setOpen(false);
            }}
          >
            <button className="btn btn-primary w-full" type="submit">
              I understand
            </button>
          </form>
        </div>
      </div>

      {detailsOpen && (
        <div className="fixed inset-0 z-[76] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="container-mobile card anim-pop p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
              Updated V{ruleVersion}
            </p>
            <h3 className="mt-1 text-2xl font-black text-indigo-900">
              {isFirstVersionView ? "Initial Work Monster Rules" : `What changed in v${ruleVersion}`}
            </h3>

            {isFirstVersionView ? (
              <div className="mt-3 space-y-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
                <p>• Points system is active.</p>
                <p>• Streak and multiplier rules are active.</p>
                <p>• Rewards and Risk Zone logic are active.</p>
                <p>• Manager review updates your score.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
                <p>
                  {latestUpdatedItem?.description ?? "Manager updated the latest rules compared to the previous version."}
                </p>
                {latestUpdatedItem?.sections?.length ? (
                  <div>
                    <p className="font-semibold">Changed sections:</p>
                    <ul className="ml-4 list-disc">
                      {latestUpdatedItem.sections.map((section) => (
                        <li key={section}>{section}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}

            <button className="btn btn-primary mt-4 w-full" onClick={() => setDetailsOpen(false)} type="button">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
