"use client";

import { useMemo, useState } from "react";

export type RecordPointEvent = {
  id: string;
  action: "login" | "checkin_submit" | "manager_review";
  created_at: string;
  date: string;
  delta: number;
  title: string;
  detail: string;
  manager_message?: string;
};

export type RecordPointDay = {
  date: string;
  day: number;
  monthKey: string;
  monthLabel: string;
  delta: number;
  events: RecordPointEvent[];
  managerMessages: string[];
};

type Props = {
  days: RecordPointDay[];
  locale: "en" | "ko";
};

type MonthOption = {
  key: string;
  label: string;
};

function pointsText(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function pointsTone(delta: number): string {
  if (delta > 0) return "text-emerald-700";
  if (delta < 0) return "text-rose-700";
  return "text-slate-500";
}

function pointsCellTone(delta: number): string {
  if (delta > 0) return "bg-emerald-50";
  if (delta < 0) return "bg-rose-50";
  return "bg-slate-100";
}

function toDateUTC(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

function weekdayIndexMondayFirst(dateISO: string): number {
  const weekday = toDateUTC(dateISO).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

function formatDateHeading(dateISO: string, locale: "en" | "ko"): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC"
  }).format(toDateUTC(dateISO));
}

function formatTimeLabel(createdAtISO: string, locale: "en" | "ko"): string {
  const parsed = new Date(createdAtISO);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

export function RecordPointsCalendar({ days, locale }: Props) {
  const monthOptions = useMemo<MonthOption[]>(() => {
    const map = new Map<string, string>();
    for (const day of days) {
      if (!map.has(day.monthKey)) {
        map.set(day.monthKey, day.monthLabel);
      }
    }
    return [...map.entries()].map(([key, label]) => ({ key, label }));
  }, [days]);

  const fallbackMonth = monthOptions[monthOptions.length - 1]?.key ?? "";
  const [selectedMonth, setSelectedMonth] = useState(fallbackMonth);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const selectedMonthDays = useMemo(() => {
    const found = days.filter((day) => day.monthKey === selectedMonth);
    return found;
  }, [days, selectedMonth]);

  const monthCells = useMemo(() => {
    if (selectedMonthDays.length === 0) {
      return [] as Array<RecordPointDay | null>;
    }
    const leading = weekdayIndexMondayFirst(selectedMonthDays[0].date);
    const cells: Array<RecordPointDay | null> = Array.from({ length: leading }, () => null);
    for (const day of selectedMonthDays) {
      cells.push(day);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [selectedMonthDays]);

  const activeDay = activeDate ? days.find((day) => day.date === activeDate) ?? null : null;
  const weekdays = locale === "ko" ? ["월", "화", "수", "목", "금", "토", "일"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="mt-2">
      <p className="text-sm text-slate-600">
        {locale === "ko"
          ? "초록 = 획득 포인트, 빨강 = 차감 포인트. 날짜를 누르면 상세 히스토리를 볼 수 있어요."
          : "Green = earned points, Red = lost points. Tap a date to open detailed history."}
      </p>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {monthOptions.map((option) => (
          <button
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              option.key === selectedMonth ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
            key={option.key}
            onClick={() => setSelectedMonth(option.key)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[10px] font-semibold text-slate-500">
        {weekdays.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {monthCells.map((cell, index) => {
          if (!cell) {
            return <div className="h-[52px] rounded-xl bg-transparent" key={`empty-${index}`} />;
          }
          return (
            <button
              className={`h-[52px] rounded-xl border border-slate-200 p-1 text-center transition active:scale-[0.98] ${pointsCellTone(cell.delta)}`}
              key={cell.date}
              onClick={() => setActiveDate(cell.date)}
              type="button"
            >
              <p className="text-[11px] font-bold text-slate-700">{cell.day}</p>
              <p className={`text-[10px] font-semibold ${pointsTone(cell.delta)}`}>{pointsText(cell.delta)}</p>
            </button>
          );
        })}
      </div>

      {activeDay && (
        <div className="fixed inset-0 z-[78] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="card w-full max-w-sm p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  {locale === "ko" ? "Daily point history" : "Daily point history"}
                </p>
                <h3 className="text-lg font-black text-indigo-900">{formatDateHeading(activeDay.date, locale)}</h3>
                <p className={`text-sm font-bold ${pointsTone(activeDay.delta)}`}>
                  {pointsText(activeDay.delta)} pts {locale === "ko" ? "합계" : "total"}
                </p>
              </div>
              <button
                className="btn btn-muted px-3 py-2 text-sm"
                onClick={() => setActiveDate(null)}
                type="button"
              >
                {locale === "ko" ? "닫기" : "Close"}
              </button>
            </div>

            <div className="max-h-[44dvh] space-y-2 overflow-y-auto pr-1">
              {activeDay.events.length > 0 ? (
                activeDay.events.map((event) => (
                  <article className="rounded-xl bg-slate-100 p-3 text-sm" key={event.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-800">{event.title}</p>
                      <p className={`shrink-0 font-bold ${pointsTone(event.delta)}`}>{pointsText(event.delta)} pts</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{event.detail}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{formatTimeLabel(event.created_at, locale)}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                  {locale === "ko" ? "이 날짜에는 포인트 변화가 없어요." : "No point events on this date."}
                </p>
              )}

              {activeDay.managerMessages.length > 0 && (
                <section className="rounded-xl bg-indigo-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">
                    {locale === "ko" ? "Manager message" : "Manager message"}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-indigo-900">
                    {activeDay.managerMessages.map((message, index) => (
                      <li key={`${message}-${index}`}>• {message}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

