"use client";

import { useEffect, useMemo, useState } from "react";
import type { PenaltyEvent, RewardClaim, Submission } from "@/lib/types";
import {
  getFoodManualCaloriesByDate,
  getFoodLogs,
  getSleepLogs,
  getWellnessGoals,
  getWorkoutLogs,
  todayLocalISO,
  toHourMinuteLabel
} from "@/lib/wellness-storage";

type SectionKey =
  | "overview"
  | "food"
  | "workout"
  | "sleep"
  | "checklist"
  | "missions"
  | "rewards"
  | "penalties";

type Props = {
  initialSection?: string;
  submissions: Submission[];
  rewardClaims: RewardClaim[];
  penaltyHistory: PenaltyEvent[];
};

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "food", label: "Food" },
  { key: "workout", label: "Workout" },
  { key: "sleep", label: "Sleep" },
  { key: "checklist", label: "Checklist" },
  { key: "missions", label: "Missions" },
  { key: "rewards", label: "Rewards" },
  { key: "penalties", label: "Penalties" }
];

function shiftDate(baseISO: string, offset: number): string {
  const date = new Date(`${baseISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function rangeDates(days: number): string[] {
  const today = todayLocalISO();
  return Array.from({ length: days }, (_, index) => shiftDate(today, index - (days - 1)));
}

function normalizeSection(value?: string): SectionKey {
  if (!value) return "overview";
  const lowered = value.toLowerCase();
  const found = SECTIONS.find((item) => item.key === lowered);
  return found?.key ?? "overview";
}

function shortDate(iso: string): string {
  return iso.slice(5).replace("-", "/");
}

export function WellnessRecordSections({ initialSection, submissions, rewardClaims, penaltyHistory }: Props) {
  const [section, setSection] = useState<SectionKey>(normalizeSection(initialSection));
  const [days, setDays] = useState<7 | 30>(7);
  const [foodLogs, setFoodLogs] = useState<ReturnType<typeof getFoodLogs>>([]);
  const [workoutLogs, setWorkoutLogs] = useState<ReturnType<typeof getWorkoutLogs>>([]);
  const [sleepLogs, setSleepLogs] = useState<ReturnType<typeof getSleepLogs>>([]);
  const goals = useMemo(() => getWellnessGoals(), []);
  const dates = useMemo(() => rangeDates(days), [days]);

  useEffect(() => {
    setFoodLogs(getFoodLogs());
    setWorkoutLogs(getWorkoutLogs());
    setSleepLogs(getSleepLogs());
  }, []);

  const foodSeries = useMemo(
    () =>
      dates.map((date) => ({
        date,
        value:
          foodLogs.filter((item) => item.date === date).reduce((sum, item) => sum + item.calories, 0)
          + getFoodManualCaloriesByDate(date)
      })),
    [dates, foodLogs]
  );
  const workoutSeries = useMemo(
    () =>
      dates.map((date) => ({
        date,
        value: workoutLogs.filter((item) => item.date === date).reduce((sum, item) => sum + item.duration, 0)
      })),
    [dates, workoutLogs]
  );
  const sleepSeries = useMemo(
    () =>
      dates.map((date) => ({
        date,
        value: sleepLogs.find((item) => item.date === date)?.recovery_percent ?? 0
      })),
    [dates, sleepLogs]
  );
  const maxFood = Math.max(1, ...foodSeries.map((item) => item.value));
  const maxWorkout = Math.max(1, ...workoutSeries.map((item) => item.value));
  const avgRecovery = sleepSeries.length > 0 ? Math.round(sleepSeries.reduce((sum, item) => sum + item.value, 0) / sleepSeries.length) : 0;
  const avgFood = foodSeries.length > 0 ? Math.round(foodSeries.reduce((sum, item) => sum + item.value, 0) / foodSeries.length) : 0;
  const avgWorkout = workoutSeries.length > 0 ? Math.round(workoutSeries.reduce((sum, item) => sum + item.value, 0) / workoutSeries.length) : 0;
  const avgSleepMinutes = dates.length > 0
    ? Math.round(
      dates.reduce((sum, date) => sum + (sleepLogs.find((item) => item.date === date)?.total_sleep_minutes ?? 0), 0)
      / dates.length
    )
    : 0;
  const foodGoalPercent = Math.max(0, Math.min(140, Math.round((avgFood / Math.max(1, goals.calorie_goal)) * 100)));
  const movementGoalPercent = Math.max(0, Math.min(140, Math.round((avgWorkout / Math.max(1, goals.movement_goal)) * 100)));
  const sleepGoalPercent = Math.max(0, Math.min(140, Math.round((avgSleepMinutes / Math.max(1, goals.sleep_goal_minutes)) * 100)));
  const wellnessBalance = Math.round((foodGoalPercent + movementGoalPercent + avgRecovery) / 3);
  const wellnessBalanceClamped = Math.max(0, Math.min(100, wellnessBalance));
  const ringStyle = {
    background: `conic-gradient(#1d4ed8 0% ${wellnessBalanceClamped}%, #dbe5ff ${wellnessBalanceClamped}% 100%)`
  };

  const missionRows = submissions
    .map((item) => ({
      id: item.id,
      date: item.date,
      mission: (item.custom_answers.mission ?? "").trim(),
      status: item.status
    }))
    .filter((item) => item.mission.length > 0);

  const checklistRows = submissions
    .map((item) => ({
      id: item.id,
      date: item.date,
      taskCount: item.task_list.length,
      complete: item.productive
    }))
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 10);

  const cardioMinutes = workoutLogs
    .filter((item) => item.workout_type === "Run" || item.workout_type === "Walk")
    .reduce((sum, item) => sum + item.duration, 0);
  const strengthMinutes = workoutLogs
    .filter((item) => item.workout_type === "Gym" || item.workout_type === "Home")
    .reduce((sum, item) => sum + item.duration, 0);
  const otherMinutes = Math.max(0, workoutLogs.reduce((sum, item) => sum + item.duration, 0) - cardioMinutes - strengthMinutes);
  const workoutTotal = Math.max(1, cardioMinutes + strengthMinutes + otherMinutes);

  return (
    <section className="card mt-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-black text-indigo-900">Wellness Record</h2>
        <div className="rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-700">
          <button className={`rounded-full px-3 py-1 ${days === 7 ? "bg-white shadow-sm" : ""}`} onClick={() => setDays(7)} type="button">
            7D
          </button>
          <button className={`rounded-full px-3 py-1 ${days === 30 ? "bg-white shadow-sm" : ""}`} onClick={() => setDays(30)} type="button">
            30D
          </button>
        </div>
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              section === item.key ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setSection(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <div className="space-y-2.5">
          <article className="rounded-2xl bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 p-3.5 text-white shadow-[0_14px_28px_rgba(30,64,175,0.24)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-100">Wellness Balance</p>
              <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold">{days}D</span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="relative h-20 w-20 rounded-full p-2" style={ringStyle}>
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-center text-indigo-700">
                  <div>
                    <p className="text-xl font-black">{wellnessBalance}%</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em]">sync</p>
                  </div>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-1.5 text-[12px]">
                <div className="rounded-lg bg-white/15 px-2 py-1 font-semibold">🍽 Food {foodGoalPercent}%</div>
                <div className="rounded-lg bg-white/15 px-2 py-1 font-semibold">🏃 Move {movementGoalPercent}%</div>
                <div className="rounded-lg bg-white/15 px-2 py-1 font-semibold">😴 Sleep {sleepGoalPercent}%</div>
                <div className="rounded-lg bg-white/15 px-2 py-1 font-semibold">💙 Recovery {avgRecovery}%</div>
              </div>
            </div>
          </article>

          <div className="grid grid-cols-3 gap-1.5">
            <article className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">Food</p>
              <p className="mt-1 text-[1.75rem] font-black leading-none text-indigo-900">{avgFood}</p>
              <p className="mt-1 text-[10px] text-slate-500">kcal/day</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">Move</p>
              <p className="mt-1 text-[1.75rem] font-black leading-none text-indigo-900">{avgWorkout}</p>
              <p className="mt-1 text-[10px] text-slate-500">min/day</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">Recovery</p>
              <p className="mt-1 text-[1.75rem] font-black leading-none text-indigo-900">{avgRecovery}%</p>
              <p className="mt-1 text-[10px] text-slate-500">sleep</p>
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Wellness Insight</p>
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">{days}D</span>
            </div>

            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5 text-center">
              <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Recovery</p>
                <p className="mt-1 text-base font-black text-indigo-900">{avgRecovery}%</p>
              </div>
              <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Food</p>
                <p className="mt-1 text-base font-black text-indigo-900">{avgFood} kcal</p>
              </div>
              <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Move</p>
                <p className="mt-1 text-base font-black text-indigo-900">{avgWorkout} min</p>
              </div>
            </div>

            <p className="mt-2 text-center text-sm font-semibold leading-tight text-slate-700">
              {wellnessBalanceClamped >= 75
                ? "Great balance. Keep this rhythm."
                : wellnessBalanceClamped >= 55
                  ? "Solid baseline. One small habit can lift your trend."
                  : "Rebuild mode: prioritize sleep + one focused movement block."}
            </p>
          </article>
          <article className="rounded-xl bg-slate-50 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Daily Trend</p>
              <p className="text-[10px] font-semibold text-slate-500">{days} days</p>
            </div>
            <div className="mt-2 flex h-16 items-end gap-1">
              {dates.map((date) => {
                const food = foodSeries.find((item) => item.date === date)?.value ?? 0;
                const move = workoutSeries.find((item) => item.date === date)?.value ?? 0;
                const height = Math.max(8, Math.round((((food / Math.max(1, goals.calorie_goal)) + (move / Math.max(1, goals.movement_goal))) / 2) * 100));
                return (
                  <div className="flex flex-1 flex-col items-center" key={date}>
                    <div className="w-full rounded-full bg-slate-200">
                      <div className="w-full rounded-full bg-gradient-to-t from-indigo-500 to-cyan-400 transition-all" style={{ height: `${Math.min(100, height)}%` }} />
                    </div>
                    <span className="mt-1 text-[9px] text-slate-500">{shortDate(date)}</span>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      )}

      {section === "food" && (
        <article className="rounded-xl bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Food Calories</p>
            <p className="text-xs font-semibold text-slate-500">Goal {goals.calorie_goal} kcal/day</p>
          </div>
          <div className="mt-3 flex h-32 items-end gap-1">
            {foodSeries.map((item) => (
              <div className="flex flex-1 flex-col items-center" key={item.date}>
                <div className="w-full rounded-t-md bg-slate-200">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400"
                    style={{ height: `${Math.max(8, Math.round((item.value / maxFood) * 100))}%` }}
                  />
                </div>
                <span className="mt-1 text-[10px] text-slate-500">{item.date.slice(8)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-600">🍽 Average {avgFood} kcal/day • Target alignment {foodGoalPercent}%</p>
        </article>
      )}

      {section === "workout" && (
        <div className="space-y-3">
          <article className="rounded-xl bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Workout Duration</p>
              <p className="text-xs font-semibold text-slate-500">Goal {goals.movement_goal} min/day</p>
            </div>
            <div className="mt-3 flex h-28 items-end gap-1">
              {workoutSeries.map((item) => (
                <div className="flex flex-1 flex-col items-center" key={item.date}>
                  <div className="w-full rounded-t-md bg-slate-200">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-blue-400"
                      style={{ height: `${Math.max(8, Math.round((item.value / maxWorkout) * 100))}%` }}
                    />
                  </div>
                  <span className="mt-1 text-[10px] text-slate-500">{item.date.slice(8)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-600">🏃 Average {avgWorkout} min/day • Goal alignment {movementGoalPercent}%</p>
          </article>
          <article className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-bold text-slate-700">Distribution</p>
            <div className="mt-2 text-sm text-slate-600">
              Cardio {Math.round((cardioMinutes / workoutTotal) * 100)}% • Strength {Math.round((strengthMinutes / workoutTotal) * 100)}% • Other {Math.round((otherMinutes / workoutTotal) * 100)}%
            </div>
          </article>
        </div>
      )}

      {section === "sleep" && (
        <article className="rounded-xl bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Recovery Trend</p>
            <p className="text-xs font-semibold text-slate-500">{toHourMinuteLabel(avgSleepMinutes)} avg sleep</p>
          </div>
          <div className="mt-3 flex h-24 items-end gap-1">
            {sleepSeries.map((item) => (
              <div className="flex flex-1 flex-col items-center" key={item.date}>
                <div className="w-full rounded-t-md bg-slate-200">
                  <div className="w-full rounded-t-md bg-gradient-to-t from-cyan-600 to-sky-400" style={{ height: `${Math.max(8, item.value)}%` }} />
                </div>
                <span className="mt-1 text-[10px] text-slate-500">{item.date.slice(8)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-600">😴 Recovery {avgRecovery}% • Sleep goal alignment {sleepGoalPercent}%</p>
        </article>
      )}

      {section === "checklist" && (
        <div className="space-y-2">
          {checklistRows.map((row) => (
            <article className="rounded-xl bg-slate-50 p-3 text-sm" key={row.id}>
              <p className="font-semibold text-slate-800">{row.date}</p>
              <p className="text-slate-600">Checklist tasks: {row.taskCount}</p>
              <p className={row.complete ? "text-emerald-700" : "text-amber-700"}>{row.complete ? "Completed mode" : "Needs carry over"}</p>
            </article>
          ))}
          {checklistRows.length === 0 && <p className="text-sm text-slate-500">No checklist records yet.</p>}
        </div>
      )}

      {section === "missions" && (
        <div className="space-y-2">
          {missionRows.map((row) => (
            <article className="rounded-xl bg-slate-50 p-3 text-sm" key={row.id}>
              <p className="font-semibold text-slate-800">{row.date}</p>
              <p className="text-slate-600">{row.mission}</p>
              <p className="text-xs font-semibold text-indigo-700">{row.status}</p>
            </article>
          ))}
          {missionRows.length === 0 && <p className="text-sm text-slate-500">No mission answers found yet.</p>}
        </div>
      )}

      {section === "rewards" && (
        <div className="space-y-2">
          {rewardClaims.map((claim) => (
            <article className="rounded-xl bg-slate-50 p-3 text-sm" key={claim.id}>
              <p className="font-semibold text-slate-800">{claim.reward_id}</p>
              <p className="text-slate-600">{claim.status}</p>
              <p className="text-xs text-slate-500">{claim.claimed_at ?? claim.created_at}</p>
            </article>
          ))}
          {rewardClaims.length === 0 && <p className="text-sm text-slate-500">No reward history yet.</p>}
        </div>
      )}

      {section === "penalties" && (
        <div className="space-y-2">
          {penaltyHistory.map((event) => (
            <article className="rounded-xl bg-slate-50 p-3 text-sm" key={event.id}>
              <p className="font-semibold text-slate-800">{event.threshold} threshold</p>
              <p className="text-slate-600">{event.reward_label}</p>
              <p className="text-xs text-slate-500">{event.triggered_at}</p>
            </article>
          ))}
          {penaltyHistory.length === 0 && <p className="text-sm text-slate-500">No penalty history yet.</p>}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">
        Last {days}d • Sleep avg {toHourMinuteLabel(Math.round(sleepLogs.slice(0, 7).reduce((sum, item) => sum + item.total_sleep_minutes, 0) / Math.max(1, Math.min(7, sleepLogs.length))))}
      </div>
    </section>
  );
}
