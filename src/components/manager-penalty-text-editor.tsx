"use client";

import { useState } from "react";

type Props = {
  initialRules: string[];
};

function createEmptyRule(): string {
  return "";
}

export function ManagerPenaltyTextEditor({ initialRules }: Props) {
  const [rules, setRules] = useState<string[]>(() => (initialRules.length > 0 ? initialRules : [createEmptyRule()]));

  function updateRule(index: number, value: string) {
    setRules((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  }

  function removeRule(index: number) {
    setRules((prev) => {
      const next = prev.filter((_item, idx) => idx !== index);
      return next.length > 0 ? next : [createEmptyRule()];
    });
  }

  function addRule() {
    setRules((prev) => [...prev, createEmptyRule()]);
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
        {rules.map((rule, idx) => (
          <div key={`penalty-text-rule-${idx}`} className="grid grid-cols-12 gap-2">
            <input
              className="input col-span-10"
              name={`penalty_text_rule_${idx}`}
              onChange={(event) => updateRule(idx, event.target.value)}
              placeholder="Example: Phone in the locked box"
              value={rule}
            />
            <button
              className="btn btn-muted col-span-2 h-full px-2 text-xs text-rose-700"
              onClick={() => removeRule(idx)}
              type="button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn-muted w-full text-sm" onClick={addRule} type="button">
        + Add penalty text rule
      </button>
      <p className="text-[11px] text-slate-500">
        Tip: these lines are shown to users in Rules and Tutorial. Keep each line short and action-based.
      </p>
    </div>
  );
}
