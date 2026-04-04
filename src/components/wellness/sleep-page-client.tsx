"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MoonStar, Sparkles, Sun, TrendingUp, Verified } from "lucide-react";
import {
  getSleepLogs,
  getWellnessGoals,
  setWellnessStorageScope,
  SleepQuality,
  toHourMinuteLabel,
  todayLocalISO,
  upsertSleepLog,
  weeklyDates
} from "@/lib/wellness-storage";
import { BottomTabs } from "@/components/bottom-tabs";

type Labels = {
  questions: string;
  record: string;
  rewards: string;
  score: string;
  rules: string;
};

function qualityFromRecovery(recovery: number): SleepQuality {
  if (recovery >= 85) return "High Quality";
  if (recovery >= 70) return "Medium";
  return "Low";
}

export function SleepPageClient({ labels, userId }: { labels: Labels; userId: string }) {
  setWellnessStorageScope(userId);
  const [selectedDate, setSelectedDate] = useState(todayLocalISO());
  const [logs, setLogs] = useState<ReturnType<typeof getSleepLogs>>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLogs(getSleepLogs());
    setMounted(true);
  }, []);

  const goals = useMemo(
    () =>
      (mounted
        ? getWellnessGoals()
        : {
            calorie_goal: 2100,
            protein_goal: 120,
            fat_goal: 70,
            carb_goal: 250,
            water_goal: 8,
            movement_goal: 60,
            sleep_goal_minutes: 480
          }),
    [logs, mounted]
  );
  const todayLog = useMemo(() => logs.find((item) => item.date === selectedDate) ?? null, [logs, selectedDate]);
  const latest = todayLog ?? logs[0] ?? null;
  const weekDates = useMemo(() => weeklyDates(selectedDate), [selectedDate]);
  const weekly = useMemo(
    () =>
      weekDates.map((date) => ({
        date,
        minutes: logs.find((item) => item.date === date)?.total_sleep_minutes ?? 0,
        recovery: logs.find((item) => item.date === date)?.recovery_percent ?? 0
      })),
    [logs, weekDates]
  );
  const avgSleep = weekly.length > 0 ? Math.round(weekly.reduce((sum, row) => sum + row.minutes, 0) / weekly.length) : 0;
  const maxMinutes = Math.max(1, ...weekly.map((row) => row.minutes));
  const latestRecovery = latest?.recovery_percent ?? 0;
  const previousWeekRecovery = Math.round(
    weekly.slice(0, Math.max(1, weekly.length - 1)).reduce((sum, row) => sum + row.recovery, 0) / Math.max(1, weekly.length - 1)
  );
  const recoveryImprovement = latestRecovery - previousWeekRecovery;
  const recoveryGoalPercent = Math.max(0, Math.min(100, Math.round(((latest?.total_sleep_minutes ?? 0) / Math.max(1, goals.sleep_goal_minutes)) * 100)));

  function refresh() {
    setLogs(getSleepLogs());
  }

  function setBedtime() {
    const baseline = latest?.sleep_start ?? "23:00";
    const input = window.prompt("Set bedtime (HH:MM)", baseline)?.trim();
    if (!input) return;
    upsertSleepLog({
      ...(latest ?? {}),
      date: selectedDate,
      sleep_start: input,
      wake_time: latest?.wake_time ?? "07:00",
      total_sleep_minutes: latest?.total_sleep_minutes ?? 420,
      recovery_percent: latest?.recovery_percent ?? 72,
      sleep_quality: latest?.sleep_quality ?? "Medium",
      stages: latest?.stages
    });
    refresh();
  }

  function setWake() {
    const baseline = latest?.wake_time ?? "07:00";
    const input = window.prompt("Set wake up (HH:MM)", baseline)?.trim();
    if (!input) return;
    upsertSleepLog({
      ...(latest ?? {}),
      date: selectedDate,
      sleep_start: latest?.sleep_start ?? "23:00",
      wake_time: input,
      total_sleep_minutes: latest?.total_sleep_minutes ?? 420,
      recovery_percent: latest?.recovery_percent ?? 72,
      sleep_quality: latest?.sleep_quality ?? "Medium",
      stages: latest?.stages
    });
    refresh();
  }

  function addSleepEntry() {
    const minutes = Number(window.prompt("Total sleep minutes", String(latest?.total_sleep_minutes ?? 440)) ?? 440);
    const recovery = Number(window.prompt("Recovery %", String(latest?.recovery_percent ?? 82)) ?? 82);
    upsertSleepLog({
      date: selectedDate,
      sleep_start: latest?.sleep_start ?? "23:20",
      wake_time: latest?.wake_time ?? "07:10",
      total_sleep_minutes: Number.isFinite(minutes) ? minutes : 440,
      recovery_percent: Number.isFinite(recovery) ? recovery : 82,
      sleep_quality: qualityFromRecovery(Number.isFinite(recovery) ? recovery : 82),
      naps_minutes: latest?.naps_minutes ?? 0,
      wakeups: latest?.wakeups ?? 1,
      latency_minutes: latest?.latency_minutes ?? 15,
      mood_after_waking: latest?.mood_after_waking ?? "Fresh",
      late_caffeine: false,
      stages: latest?.stages
    });
    refresh();
  }

  const stages = latest?.stages ?? [
    { type: "REM", minutes: 85 },
    { type: "Light", minutes: 170 },
    { type: "Deep", minutes: 140 },
    { type: "Awake", minutes: 40 }
  ];
  const totalStageMinutes = Math.max(1, stages.reduce((sum, stage) => sum + stage.minutes, 0));
  const stageColor: Record<string, string> = {
    REM: "#7d9fff",
    Light: "#1f61db",
    Deep: "#1145b8",
    Awake: "#efb78f"
  };

  return (
    <section className="pb-32">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="rounded-full bg-white px-2 py-2 text-blue-600 shadow-sm" href="/app/welcome">
            ←
          </Link>
          <h1 className="text-2xl font-black text-blue-700">Sleep</h1>
        </div>
        <button
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600"
          onClick={() => setSelectedDate(todayLocalISO())}
          type="button"
        >
          Today
        </button>
      </header>

      <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1458d2] to-[#0f4ec8] p-6 text-white shadow-[0_20px_45px_rgba(20,72,210,0.24)]">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-100">Total Rest</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className="text-7xl font-black leading-none">{toHourMinuteLabel(latest?.total_sleep_minutes ?? 0)}</p>
          <span className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm font-bold">
            <Verified size={16} />
            {latest?.sleep_quality ?? "Medium"}
          </span>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xl font-bold">
            <span>Recovery</span>
            <span>{latest?.recovery_percent ?? 0}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#f3c399] transition-all duration-700" style={{ width: `${latest?.recovery_percent ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-blue-100">{recoveryGoalPercent}% of sleep target reached</p>
        </div>
      </article>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <button className="rounded-[1.7rem] bg-white p-5 text-left shadow-sm transition hover:scale-[1.01]" onClick={setBedtime} type="button">
          <span className="inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">
            <MoonStar size={20} />
          </span>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Set Bedtime</p>
          <p className="mt-1 text-4xl font-black text-slate-900">{latest?.sleep_start ?? "23:00"}</p>
        </button>
        <button className="rounded-[1.7rem] bg-white p-5 text-left shadow-sm transition hover:scale-[1.01]" onClick={setWake} type="button">
          <span className="inline-flex rounded-2xl bg-amber-50 p-3 text-amber-700">
            <Sun size={20} />
          </span>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Set Wake Up</p>
          <p className="mt-1 text-4xl font-black text-slate-900">{latest?.wake_time ?? "07:00"}</p>
        </button>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-700" />
          Insights
        </div>
        <article className="relative overflow-hidden rounded-[2rem] bg-slate-100 p-5">
          <div className="absolute -bottom-4 -right-4 text-slate-200">
            <Sparkles size={84} />
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
              <TrendingUp size={20} />
            </span>
            <p className="text-2xl leading-relaxed text-slate-800">
              Your sleep quality has improved by <span className="font-black text-blue-700">{recoveryImprovement > 0 ? `+${recoveryImprovement}` : recoveryImprovement}%</span> over last week.
            </p>
          </div>
        </article>
      </section>

      <section className="mt-6">
        <h3 className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Sleep Log</h3>
        <article className="mt-3 rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 rounded-full bg-blue-600" />
              <div>
                <p className="text-3xl font-black text-slate-900">Last night</p>
                <p className="text-sm text-slate-500">{selectedDate}</p>
              </div>
            </div>
            <p className="text-3xl font-black text-slate-700">{toHourMinuteLabel(latest?.total_sleep_minutes ?? 0)}</p>
          </div>
          <div className="mb-3 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>{latest?.sleep_start ?? "23:00"}</span>
            <span>03:30</span>
            <span>{latest?.wake_time ?? "07:00"}</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {stages.map((stage) => (
              <div
                key={`${stage.type}-${stage.minutes}`}
                style={{
                  width: `${Math.max(4, Math.round((stage.minutes / totalStageMinutes) * 100))}%`,
                  background: stageColor[stage.type]
                }}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-semibold text-slate-600">
            {stages.map((stage) => (
              <span className="inline-flex items-center gap-1" key={stage.type}>
                <span className="h-2 w-2 rounded-full" style={{ background: stageColor[stage.type] }} />
                {stage.type}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-8">
        <h3 className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Trends</h3>
        <article className="mt-3 rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-4xl font-black text-slate-900">Sleep Duration</p>
            <p className="text-lg font-bold text-blue-700">Avg {toHourMinuteLabel(avgSleep)}</p>
          </div>
          <div className="flex h-36 items-end gap-2">
            {weekly.map((row) => {
              const active = row.date === selectedDate;
              const height = Math.max(12, Math.round((row.minutes / maxMinutes) * 100));
              return (
                <button key={row.date} className="flex flex-1 flex-col items-center" onClick={() => setSelectedDate(row.date)} type="button">
                  <div className={`w-full rounded-t-xl ${active ? "bg-[#6f91ff]" : "bg-slate-200"}`} style={{ height: `${height}px` }}>
                    {active && (
                      <span className="relative -top-8 block text-center text-[11px] font-bold text-blue-700">
                        {toHourMinuteLabel(row.minutes)}
                      </span>
                    )}
                  </div>
                  <span className={`mt-2 text-xs font-bold ${active ? "text-blue-700" : "text-slate-500"}`}>
                    {new Date(`${row.date}T00:00:00.000Z`).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1)}
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="mt-4 rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-4xl font-black text-slate-900">Recovery Trend</p>
            <TrendingUp className="text-amber-700" size={20} />
          </div>
          <div className="relative h-28">
            <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 40">
              <path d="M0 32 Q 16 28, 33 36 T 66 20 T 100 12" fill="none" stroke="#8a4b03" strokeLinecap="round" strokeWidth="2.4" />
              <circle cx="100" cy="12" fill="#8a4b03" r="2.4" />
            </svg>
            <p className="absolute right-0 top-0 text-5xl font-black text-amber-700">{latestRecovery}%</p>
          </div>
        </article>
      </section>

      <button
        className="fixed bottom-28 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-xl transition hover:scale-105 active:scale-95"
        onClick={addSleepEntry}
        type="button"
      >
        +
      </button>
      <BottomTabs active="questions" labels={labels} />
    </section>
  );
}
