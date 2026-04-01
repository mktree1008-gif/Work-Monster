"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
};

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function monthStartISO(input: Date): string {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function shiftMonthISO(monthISO: string, diff: number): string {
  const base = new Date(`${monthISO}T00:00:00.000Z`);
  if (!Number.isFinite(base.getTime())) return monthStartISO(new Date());
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + diff, 1)).toISOString().slice(0, 10);
}

function buildMonthCells(monthISO: string): Array<{ iso: string; day: number } | null> {
  const base = new Date(`${monthISO}T00:00:00.000Z`);
  if (!Number.isFinite(base.getTime())) return [];
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: Array<{ iso: string; day: number } | null> = [];

  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    cells.push({ iso, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthLabel(monthISO: string): string {
  const date = new Date(`${monthISO}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return monthISO;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function valueLabel(value: string): string {
  if (!isISODate(value)) return "Select date";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return "Select date";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function DateInputPicker({ name, label, defaultValue = "", required = false }: Props) {
  const initialValue = isISODate(defaultValue) ? defaultValue : "";
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [monthISO, setMonthISO] = useState(() =>
    monthStartISO(initialValue ? new Date(`${initialValue}T00:00:00.000Z`) : new Date())
  );
  const days = useMemo(() => buildMonthCells(monthISO), [monthISO]);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <label className="text-xs font-semibold text-slate-600">
      {label}
      <input name={name} type="hidden" value={value} />
      <button
        className="input mt-1 flex w-full items-center justify-between"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span className={`truncate whitespace-nowrap text-left ${value ? "text-slate-800" : "text-slate-400"}`}>
          {valueLabel(value)}
        </span>
        <CalendarClock className="shrink-0 text-blue-600" size={16} />
      </button>
      {required && !value && <span className="mt-1 block text-[11px] text-rose-600">Required</span>}

      {open && (
        <div className="mt-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700"
              onClick={() => setMonthISO((prev) => shiftMonthISO(prev, -1))}
              type="button"
            >
              <ChevronLeft size={15} />
            </button>
            <p className="text-sm font-black text-slate-800">{monthLabel(monthISO)}</p>
            <button
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700"
              onClick={() => setMonthISO((prev) => shiftMonthISO(prev, 1))}
              type="button"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((day) => (
              <span className="py-1 text-center text-[10px] font-black uppercase tracking-[0.08em] text-slate-500" key={day}>
                {day}
              </span>
            ))}
            {days.map((cell, index) => {
              if (!cell) return <span className="h-8 rounded-lg" key={`empty-${index}`} />;
              const active = cell.iso === value;
              return (
                <button
                  className={`h-8 rounded-lg text-xs font-bold ${active ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-blue-100"}`}
                  key={cell.iso}
                  onClick={() => {
                    setValue(cell.iso);
                    setOpen(false);
                  }}
                  type="button"
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600"
              onClick={() => setValue("")}
              type="button"
            >
              Clear
            </button>
            <button
              className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </label>
  );
}
