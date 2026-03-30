"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Cookie,
  Droplets,
  Lightbulb,
  Plus,
  Sandwich,
  ScanLine,
  Soup,
  UtensilsCrossed
} from "lucide-react";
import {
  addWaterCup,
  deleteFoodLog,
  duplicateFoodLog,
  getFoodLogs,
  getFoodSummary,
  getWellnessGoals,
  MealType,
  setWellnessGoals,
  setWaterByDate,
  todayLocalISO,
  upsertFoodLog,
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

const QUICK_PRESETS: Record<MealType, { title: string; calories: number; protein: number }> = {
  Breakfast: { title: "Healthy breakfast", calories: 360, protein: 20 },
  Lunch: { title: "Balanced lunch", calories: 520, protein: 32 },
  Dinner: { title: "Light dinner", calories: 620, protein: 36 },
  Snack: { title: "Quick snack", calories: 180, protein: 8 }
};

function mealIcon(type: MealType) {
  if (type === "Breakfast") return <UtensilsCrossed size={18} />;
  if (type === "Lunch") return <Sandwich size={18} />;
  if (type === "Dinner") return <Soup size={18} />;
  return <Cookie size={18} />;
}

export function FoodPageClient({ labels }: { labels: Labels }) {
  const [selectedDate, setSelectedDate] = useState(todayLocalISO());
  const [logs, setLogs] = useState<ReturnType<typeof getFoodLogs>>([]);
  const [mounted, setMounted] = useState(false);
  const [waterPulse, setWaterPulse] = useState(false);
  const [lastAddedMeal, setLastAddedMeal] = useState<MealType | "">("");

  useEffect(() => {
    setLogs(getFoodLogs());
    setMounted(true);
  }, []);

  const summary = useMemo(
    () =>
      mounted
        ? getFoodSummary(selectedDate)
        : { calories: 0, protein: 0, waterCups: 0, goal: 2100, remaining: 2100, percent: 0 },
    [logs, mounted, selectedDate]
  );
  const goals = useMemo(
    () => (mounted ? getWellnessGoals() : { calorie_goal: 2100, water_goal: 8, movement_goal: 60, sleep_goal_minutes: 480 }),
    [logs, mounted]
  );
  const todayLogs = useMemo(
    () =>
      logs
        .filter((item) => item.date === selectedDate)
        .sort((a, b) => (a.created_at > b.created_at ? -1 : 1)),
    [logs, selectedDate]
  );
  const week = useMemo(() => weeklyDates(selectedDate), [selectedDate]);
  const weeklyCalories = useMemo(
    () =>
      week.map((date) => ({
        date,
        total: logs.filter((item) => item.date === date).reduce((sum, item) => sum + item.calories, 0)
      })),
    [logs, week]
  );
  const maxWeekly = Math.max(1, ...weeklyCalories.map((item) => item.total));

  const smartInsight = useMemo(() => {
    if (summary.protein >= 80) {
      return "You're hitting your protein goal today! Keep it up to support your muscle recovery.";
    }
    if (summary.waterCups < Math.max(1, Math.round(goals.water_goal * 0.6))) {
      return "You're under your water target. Add one cup between sessions to stay focused.";
    }
    if (summary.calories > goals.calorie_goal) {
      return "Daily calories are above your target. Keep dinner lighter to recover balance.";
    }
    return "Great pacing today. Keep your current meal rhythm steady through evening.";
  }, [goals.calorie_goal, goals.water_goal, summary.calories, summary.protein, summary.waterCups]);

  function syncState() {
    setLogs(getFoodLogs());
  }

  function quickAdd(meal: MealType) {
    const preset = QUICK_PRESETS[meal];
    upsertFoodLog({
      date: selectedDate,
      meal_type: meal,
      food_name: preset.title,
      calories: preset.calories,
      protein: preset.protein,
      water: 0,
      note: "Quick log",
      appetite_level: "Normal",
      balanced_meal_rating: 4,
      overeating: false
    });
    setLastAddedMeal(meal);
    setTimeout(() => setLastAddedMeal(""), 450);
    syncState();
  }

  function editEntry(id: string) {
    const found = logs.find((item) => item.id === id);
    if (!found) return;
    const foodName = window.prompt("Food name", found.food_name)?.trim();
    if (!foodName) return;
    const calories = Number(window.prompt("Calories", String(found.calories)) ?? found.calories);
    const protein = Number(window.prompt("Protein (g)", String(found.protein)) ?? found.protein);
    const note = window.prompt("Note", found.note ?? "") ?? found.note;

    upsertFoodLog({
      ...found,
      food_name: foodName,
      calories: Number.isFinite(calories) ? calories : found.calories,
      protein: Number.isFinite(protein) ? protein : found.protein,
      note
    });
    syncState();
  }

  function addWater() {
    addWaterCup(selectedDate);
    setWaterPulse(true);
    setTimeout(() => setWaterPulse(false), 400);
    syncState();
  }

  function resetWaterGoal() {
    const next = Number(window.prompt("Set daily water goal (cups)", String(goals.water_goal)) ?? goals.water_goal);
    if (!Number.isFinite(next)) return;
    setWellnessGoals({ water_goal: Math.max(1, Math.round(next)) });
    if (summary.waterCups > Math.max(1, Math.round(next))) {
      setWaterByDate(selectedDate, Math.max(1, Math.round(next)));
    }
    syncState();
  }

  function updateCalorieGoal() {
    const next = Number(window.prompt("Set daily calorie goal", String(goals.calorie_goal)) ?? goals.calorie_goal);
    if (!Number.isFinite(next)) return;
    setWellnessGoals({ calorie_goal: Math.max(1000, Math.round(next)) });
    syncState();
  }

  function removeEntry(id: string) {
    deleteFoodLog(id);
    syncState();
  }

  function cloneEntry(id: string) {
    duplicateFoodLog(id);
    syncState();
  }

  return (
    <section className="pb-32">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="rounded-full bg-white px-2 py-2 text-blue-600 shadow-sm" href="/app/welcome">
            ←
          </Link>
          <h1 className="text-2xl font-black text-slate-900">Food</h1>
        </div>
        <button
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600"
          onClick={() => setSelectedDate(todayLocalISO())}
          type="button"
        >
          Today
        </button>
      </header>

      <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0f57d8] to-[#1849c7] p-6 text-white shadow-[0_20px_45px_rgba(10,80,200,0.24)]">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm text-blue-100">Daily Progress</p>
        <div className="mt-1 flex items-end gap-2">
          <p className="text-5xl font-black leading-none">{summary.calories.toLocaleString()}</p>
          <p className="pb-1 text-2xl text-blue-100">/ {goals.calorie_goal.toLocaleString()} kcal</p>
        </div>

        <div className="mt-5 flex gap-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100">Protein</p>
            <p className="text-3xl font-black">{summary.protein}g</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100">Water</p>
            <p className="text-3xl font-black">
              {summary.waterCups}/{goals.water_goal}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="h-3 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-[#f3c399] transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, summary.percent))}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.08em] text-blue-100">
            <span>Remaining: {summary.remaining.toLocaleString()} kcal</span>
            <span>{summary.percent}% of daily goal</span>
          </div>
          <button
            className="mt-3 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold"
            onClick={updateCalorieGoal}
            type="button"
          >
            Edit daily goal
          </button>
        </div>
      </article>

      <article className="mt-4 rounded-3xl border-l-4 border-amber-700 bg-[#f5e4d8] p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-700 p-2 text-white">
            <Lightbulb size={15} />
          </div>
          <div>
            <p className="text-sm font-black text-amber-900">Smart Insight</p>
            <p className="text-sm text-amber-800">{smartInsight}</p>
          </div>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="px-1 text-2xl font-black text-slate-900">Quick Log</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["Breakfast", "Lunch", "Dinner", "Snack"] as MealType[]).map((meal) => (
            <button
              key={meal}
              className={`rounded-[1.8rem] bg-white p-5 text-left shadow-sm transition ${
                lastAddedMeal === meal ? "scale-[0.98] ring-2 ring-blue-400" : ""
              }`}
              onClick={() => quickAdd(meal)}
              type="button"
            >
              <div className="mb-3 inline-flex rounded-2xl bg-slate-100 p-3 text-blue-600">{mealIcon(meal)}</div>
              <p className="text-lg font-bold text-slate-900">{meal}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-3xl font-black text-slate-900">Today&apos;s Log</h2>
          <button className="text-sm font-bold text-blue-700" onClick={syncState} type="button">
            View All
          </button>
        </div>
        <div className="space-y-3">
          {todayLogs.map((entry) => (
            <div className="rounded-3xl bg-white p-3 shadow-sm" key={entry.id}>
              <button className="flex w-full items-center gap-3 text-left" onClick={() => editEntry(entry.id)} type="button">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-blue-600">
                  {mealIcon(entry.meal_type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-black text-slate-900">{entry.meal_type}</p>
                  <p className="truncate text-sm text-slate-500">{entry.food_name}</p>
                </div>
                <p className="text-lg font-black text-blue-700">{entry.calories} kcal</p>
                <ChevronRight className="text-slate-400" size={16} />
              </button>
              <div className="mt-2 flex items-center gap-2">
                <button className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600" onClick={() => cloneEntry(entry.id)} type="button">
                  Duplicate
                </button>
                <button className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600" onClick={() => removeEntry(entry.id)} type="button">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {todayLogs.length === 0 && <p className="rounded-3xl bg-white p-4 text-sm text-slate-500">No logs for this day yet.</p>}
        </div>
      </section>

      <section className="mt-7 grid grid-cols-1 gap-4">
        <article className="rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">Weekly Calories</h3>
            <span className="text-blue-600">↗</span>
          </div>
          <div className="flex h-28 items-end gap-2">
            {weeklyCalories.map((item) => {
              const active = item.date === selectedDate;
              const height = Math.max(10, Math.round((item.total / maxWeekly) * 100));
              return (
                <button
                  key={item.date}
                  className="group flex flex-1 flex-col items-center"
                  onClick={() => setSelectedDate(item.date)}
                  type="button"
                >
                  <div className="w-full rounded-full bg-slate-100">
                    <div
                      className={`w-full rounded-full transition-all ${active ? "bg-blue-600" : "bg-[#b6c8ea] group-hover:bg-[#9cb4e3]"}`}
                      style={{ height: `${height}px` }}
                    />
                  </div>
                  <span className={`mt-2 text-[10px] font-bold ${active ? "text-blue-600" : "text-slate-500"}`}>
                    {new Date(`${item.date}T00:00:00.000Z`).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">Water Intake</h3>
            <button className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600" onClick={resetWaterGoal} type="button">
              Goal {goals.water_goal}
            </button>
          </div>
          <div className={`grid grid-cols-8 gap-2 transition ${waterPulse ? "scale-[1.01]" : ""}`}>
            {Array.from({ length: goals.water_goal }, (_, index) => index + 1).map((cup) => {
              const done = cup <= summary.waterCups;
              return (
                <button
                  key={cup}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                    done ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}
                  onClick={() => setWaterByDate(selectedDate, cup)}
                  type="button"
                >
                  <Droplets size={14} />
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {summary.waterCups} of {goals.water_goal} cups achieved today
          </p>
          <button className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={addWater} type="button">
            + Add one cup
          </button>
        </article>
      </section>

      <button
        className="fixed bottom-28 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-white shadow-xl transition hover:scale-105 active:scale-95"
        onClick={() => quickAdd("Snack")}
        type="button"
      >
        <ScanLine size={20} />
      </button>
      <button
        className="fixed bottom-[11.5rem] right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:scale-105 active:scale-95"
        onClick={() => quickAdd("Lunch")}
        type="button"
      >
        <Plus size={18} />
      </button>
      <BottomTabs active="questions" labels={labels} />
    </section>
  );
}
