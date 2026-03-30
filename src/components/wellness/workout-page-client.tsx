"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Dumbbell,
  Flame,
  Footprints,
  Home,
  Plus,
  Sparkles,
  StretchHorizontal,
  TimerReset,
  Trees,
  Waves
} from "lucide-react";
import {
  deleteWorkoutLog,
  getWellnessGoals,
  getWorkoutLogs,
  todayLocalISO,
  upsertWorkoutLog,
  weeklyDates,
  WorkoutType
} from "@/lib/wellness-storage";
import { BottomTabs } from "@/components/bottom-tabs";

type Labels = {
  questions: string;
  record: string;
  rewards: string;
  score: string;
  rules: string;
};

const QUICK_TYPES: WorkoutType[] = ["Gym", "Walk", "Run", "Stretch", "Home", "Custom"];

function typeIcon(type: WorkoutType) {
  if (type === "Gym") return <Dumbbell size={18} />;
  if (type === "Walk") return <Trees size={18} />;
  if (type === "Run") return <Activity size={18} />;
  if (type === "Stretch") return <StretchHorizontal size={18} />;
  if (type === "Home") return <Home size={18} />;
  return <TimerReset size={18} />;
}

export function WorkoutPageClient({ labels }: { labels: Labels }) {
  const [selectedDate, setSelectedDate] = useState(todayLocalISO());
  const [logs, setLogs] = useState<ReturnType<typeof getWorkoutLogs>>([]);
  const [mounted, setMounted] = useState(false);
  const [glowType, setGlowType] = useState<WorkoutType | "">("");

  useEffect(() => {
    setLogs(getWorkoutLogs());
    setMounted(true);
  }, []);

  const todayLogs = useMemo(
    () => logs.filter((item) => item.date === selectedDate).sort((a, b) => (a.created_at > b.created_at ? -1 : 1)),
    [logs, selectedDate]
  );
  const goals = useMemo(
    () => (mounted ? getWellnessGoals() : { calorie_goal: 2100, water_goal: 8, movement_goal: 60, sleep_goal_minutes: 480 }),
    [mounted]
  );
  const summary = useMemo(() => {
    const minutes = todayLogs.reduce((sum, item) => sum + item.duration, 0);
    const calories = todayLogs.reduce((sum, item) => sum + item.calories_burned, 0);
    const steps = todayLogs.reduce((sum, item) => sum + item.steps, 0);
    const typeLabel = todayLogs.length > 0 ? [...new Set(todayLogs.map((item) => item.workout_type))].join(" & ") : "No workout yet";
    return {
      minutes,
      calories,
      steps,
      typeLabel,
      percent: Math.max(0, Math.min(100, Math.round((minutes / Math.max(1, goals.movement_goal)) * 100)))
    };
  }, [goals.movement_goal, todayLogs]);

  const weekDates = useMemo(() => weeklyDates(selectedDate), [selectedDate]);
  const weeklyMinutes = useMemo(
    () =>
      weekDates.map((date) => ({
        date,
        total: logs.filter((item) => item.date === date).reduce((sum, item) => sum + item.duration, 0)
      })),
    [logs, weekDates]
  );
  const maxWeekly = Math.max(1, ...weeklyMinutes.map((item) => item.total));
  const cardioMinutes = todayLogs.filter((item) => item.workout_type === "Run" || item.workout_type === "Walk").reduce((sum, item) => sum + item.duration, 0);
  const strengthMinutes = todayLogs.filter((item) => item.workout_type === "Gym" || item.workout_type === "Home").reduce((sum, item) => sum + item.duration, 0);
  const otherMinutes = Math.max(0, summary.minutes - cardioMinutes - strengthMinutes);
  const consistencyDays = weekDates.filter((date) => logs.some((item) => item.date === date)).length;
  const consistencyPercent = Math.max(0, Math.min(100, Math.round((consistencyDays / 5) * 100)));

  function refresh() {
    setLogs(getWorkoutLogs());
  }

  function quickAdd(type: WorkoutType) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const presets: Record<WorkoutType, { title: string; duration: number; calories: number; steps: number }> = {
      Gym: { title: "Gym Session", duration: 40, calories: 280, steps: 1500 },
      Walk: { title: "Outdoor Walk", duration: 25, calories: 120, steps: 3200 },
      Run: { title: "Morning Run", duration: 30, calories: 220, steps: 4200 },
      Stretch: { title: "Stretch Mobility", duration: 15, calories: 80, steps: 600 },
      Home: { title: "Home Workout", duration: 22, calories: 150, steps: 1200 },
      Custom: { title: "Custom Workout", duration: 20, calories: 110, steps: 1000 }
    };
    const preset = presets[type];
    upsertWorkoutLog({
      date: selectedDate,
      workout_type: type,
      title: preset.title,
      start_time: `${hh}:${mm}`,
      duration: preset.duration,
      calories_burned: preset.calories,
      steps: preset.steps,
      intensity: type === "Stretch" ? "low" : type === "Gym" || type === "Run" ? "high" : "medium",
      location: type === "Gym" ? "Gym" : type === "Home" ? "Home" : "Outdoor",
      fatigue: type === "Stretch" ? 1 : 2,
      note: "Quick start",
      mission_linked: type === "Run" || type === "Gym"
    });
    setGlowType(type);
    setTimeout(() => setGlowType(""), 450);
    refresh();
  }

  function addCustomWorkout() {
    const title = window.prompt("Workout title", "Custom Workout")?.trim();
    if (!title) return;
    const duration = Number(window.prompt("Duration (minutes)", "30") ?? 30);
    const calories = Number(window.prompt("Calories burned", "180") ?? 180);
    const steps = Number(window.prompt("Steps", "1800") ?? 1800);
    upsertWorkoutLog({
      date: selectedDate,
      workout_type: "Custom",
      title,
      start_time: "18:00",
      duration: Number.isFinite(duration) ? duration : 30,
      calories_burned: Number.isFinite(calories) ? calories : 180,
      steps: Number.isFinite(steps) ? steps : 1800,
      intensity: "medium",
      fatigue: 2,
      location: "Custom",
      mission_linked: false,
      note: ""
    });
    refresh();
  }

  function editWorkout(id: string) {
    const found = logs.find((item) => item.id === id);
    if (!found) return;
    const title = window.prompt("Workout title", found.title)?.trim();
    if (!title) return;
    const duration = Number(window.prompt("Duration", String(found.duration)) ?? found.duration);
    upsertWorkoutLog({
      ...found,
      title,
      duration: Number.isFinite(duration) ? duration : found.duration
    });
    refresh();
  }

  function removeWorkout(id: string) {
    deleteWorkoutLog(id);
    refresh();
  }

  const donutTotal = Math.max(1, cardioMinutes + strengthMinutes + otherMinutes);
  const cardioDash = Math.round((cardioMinutes / donutTotal) * 100);
  const strengthDash = Math.round((strengthMinutes / donutTotal) * 100);
  const otherDash = Math.max(0, 100 - cardioDash - strengthDash);

  return (
    <section className="pb-32">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="rounded-full bg-white px-2 py-2 text-blue-600 shadow-sm" href="/app/welcome">
            ←
          </Link>
          <h1 className="text-2xl font-black text-slate-900">Workout</h1>
        </div>
        <button
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600"
          onClick={() => setSelectedDate(todayLocalISO())}
          type="button"
        >
          {new Date(`${selectedDate}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </button>
      </header>

      <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0f57d8] to-[#4e4ae8] p-6 text-white shadow-[0_20px_45px_rgba(20,72,210,0.24)]">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-100">Daily Activity</p>
            <p className="mt-1 text-6xl font-black leading-none">
              {summary.minutes}
              <span className="ml-1 text-3xl font-semibold">min</span>
            </p>
            <p className="mt-2 text-sm text-blue-100">{summary.typeLabel}</p>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]">Live Session</span>
            <div className="mt-4 space-y-2 text-3xl font-black">
              <p className="inline-flex items-center gap-2">
                <Flame className="text-amber-300" size={16} />
                {summary.calories} kcal
              </p>
              <p className="inline-flex items-center gap-2">
                <Footprints className="text-blue-200" size={16} />
                {summary.steps.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="px-1 text-2xl font-black text-slate-900">Quick Start</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {QUICK_TYPES.map((type) => (
            <button
              key={type}
              className={`min-w-[5.5rem] rounded-[1.6rem] bg-white p-4 text-center shadow-sm transition ${
                glowType === type ? "scale-[0.97] ring-2 ring-blue-400" : ""
              }`}
              onClick={() => quickAdd(type)}
              type="button"
            >
              <div className="mx-auto inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">{typeIcon(type)}</div>
              <p className="mt-2 text-sm font-bold text-slate-800">{type}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4">
        <article className="rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-900">Workout Log</h3>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Today</span>
          </div>
          <div className="space-y-3">
            {todayLogs.map((item) => (
              <div className="rounded-2xl bg-slate-50 p-3" key={item.id}>
                <button className="flex w-full items-center gap-3 text-left" onClick={() => editWorkout(item.id)} type="button">
                  <div className="rounded-xl bg-blue-100 p-3 text-blue-700">{typeIcon(item.workout_type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-black text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500">{item.start_time}</p>
                  </div>
                  <p className="text-3xl font-black text-slate-600">{item.duration}m</p>
                </button>
                <button className="mt-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600" onClick={() => removeWorkout(item.id)} type="button">
                  Delete
                </button>
              </div>
            ))}
            {todayLogs.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">No workout logs yet.</p>}
          </div>
        </article>

        <article className="rounded-[2rem] border border-blue-200 bg-[#eaf0ff] p-5">
          <div className="mb-4 inline-flex rounded-full bg-white p-3 text-amber-700 shadow-sm">
            <Sparkles size={18} />
          </div>
          <h3 className="text-4xl font-black text-slate-900">Consistency is key!</h3>
          <p className="mt-3 text-lg text-slate-700">
            You&apos;ve worked out {consistencyDays} days this week. You&apos;re only {Math.max(0, 5 - consistencyDays)} day away from your weekly goal!
          </p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-700" style={{ width: `${consistencyPercent}%` }} />
          </div>
          <p className="mt-2 text-right text-xs font-black uppercase tracking-[0.15em] text-blue-700">{consistencyPercent}% complete</p>
        </article>
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-3xl font-black text-slate-900">Performance Trends</h2>
        <div className="mt-3 grid grid-cols-1 gap-4">
          <article className="rounded-[2rem] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Weekly Frequency</p>
            <div className="mt-4 flex h-36 items-end gap-3">
              {weeklyMinutes.map((item) => {
                const active = item.date === selectedDate;
                const height = Math.max(12, Math.round((item.total / maxWeekly) * 100));
                return (
                  <button key={item.date} className="flex flex-1 flex-col items-center" onClick={() => setSelectedDate(item.date)} type="button">
                    <div className={`w-full rounded-t-xl ${active ? "bg-blue-600 shadow-[0_0_12px_rgba(30,80,220,0.35)]" : "bg-slate-300"}`} style={{ height: `${height}px` }} />
                    <span className={`mt-2 text-xs font-bold ${active ? "text-blue-700" : "text-slate-500"}`}>
                      {new Date(`${item.date}T00:00:00.000Z`).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1)}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="rounded-[2rem] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Distribution</p>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-600" />Cardio {Math.round((cardioMinutes / donutTotal) * 100)}%</p>
                  <p className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-700" />Strength {Math.round((strengthMinutes / donutTotal) * 100)}%</p>
                  <p className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-300" />Other {Math.round((otherMinutes / donutTotal) * 100)}%</p>
                </div>
              </div>
              <div className="relative h-28 w-28">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <path d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" fill="none" stroke="#d9dde5" strokeWidth="4" />
                  <path d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" fill="none" stroke="#1657d5" strokeDasharray={`${cardioDash},100`} strokeLinecap="round" strokeWidth="4" />
                  <path d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" fill="none" stroke="#9a4f06" strokeDasharray={`${strengthDash},100`} strokeDashoffset={`-${cardioDash}`} strokeLinecap="round" strokeWidth="4" />
                  <path d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" fill="none" stroke="#7a9df8" strokeDasharray={`${otherDash},100`} strokeDashoffset={`-${cardioDash + strengthDash}`} strokeLinecap="round" strokeWidth="4" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-blue-700">
                  <Waves size={20} />
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <button
        className="fixed bottom-28 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-white shadow-xl transition hover:scale-105 active:scale-95"
        onClick={addCustomWorkout}
        type="button"
      >
        <Plus size={22} />
      </button>

      <BottomTabs active="questions" labels={labels} />
    </section>
  );
}
