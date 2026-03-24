"use client";

import { useState } from "react";

type PenaltyRow = {
  threshold: string;
  label: string;
  value: string;
};

type Props = {
  initialRows: PenaltyRow[];
};

function createEmptyRow(): PenaltyRow {
  return {
    threshold: "",
    label: "Manager reward unlocked",
    value: "$0 equivalent"
  };
}

export function ManagerPenaltyEditor({ initialRows }: Props) {
  const [rows, setRows] = useState<PenaltyRow[]>(() => (initialRows.length > 0 ? initialRows : [createEmptyRow()]));

  function updateRow(index: number, patch: Partial<PenaltyRow>) {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => {
      const next = prev.filter((_row, idx) => idx !== index);
      return next.length > 0 ? next : [createEmptyRow()];
    });
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <div className="grid grid-cols-12 gap-2 px-1 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          <p className="col-span-3">Threshold</p>
          <p className="col-span-4">Reward Label</p>
          <p className="col-span-3">Reward Value</p>
          <p className="col-span-2">Action</p>
        </div>
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={`penalty-row-${idx}`} className="grid grid-cols-12 gap-2">
              <input
                className="input col-span-3"
                name={`penalty_item_threshold_${idx}`}
                onChange={(event) => updateRow(idx, { threshold: event.target.value })}
                placeholder="-5"
                type="number"
                value={row.threshold}
              />
              <input
                className="input col-span-4"
                name={`penalty_item_label_${idx}`}
                onChange={(event) => updateRow(idx, { label: event.target.value })}
                placeholder="Manager reward unlocked"
                value={row.label}
              />
              <input
                className="input col-span-3"
                name={`penalty_item_value_${idx}`}
                onChange={(event) => updateRow(idx, { value: event.target.value })}
                placeholder="$200 equivalent"
                value={row.value}
              />
              <button
                className="btn btn-muted col-span-2 h-full px-2 text-xs text-rose-700"
                onClick={() => removeRow(idx)}
                type="button"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
      <button className="btn btn-muted w-full text-sm" onClick={addRow} type="button">
        + Add penalty row
      </button>
      <p className="text-[11px] text-slate-500">
        Tip: set negative thresholds (e.g. -1, -5, -10). Delete rows to remove specific penalty rules.
      </p>
    </div>
  );
}
