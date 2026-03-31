"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Droplets,
  Minus,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import {
  deleteFoodLog,
  duplicateFoodLog,
  FoodLog,
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
import {
  estimateNutritionFromReference,
  estimateNutritionFromText,
  FoodReference,
  searchFoodReferences
} from "@/lib/food-ai";
import { BottomTabs } from "@/components/bottom-tabs";

type Labels = {
  questions: string;
  record: string;
  rewards: string;
  score: string;
  rules: string;
};

type DraftForm = {
  id?: string;
  meal_type: MealType;
  food_name: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  ingredients: string[];
  note: string;
};

const MEAL_ORDER: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const MEAL_META: Record<MealType, { emoji: string; subtitle: string; accent: string }> = {
  Breakfast: {
    emoji: "🍳",
    subtitle: "Fuel your morning",
    accent: "from-amber-500 to-orange-500"
  },
  Lunch: {
    emoji: "🥗",
    subtitle: "Steady daytime energy",
    accent: "from-emerald-500 to-teal-500"
  },
  Dinner: {
    emoji: "🍲",
    subtitle: "Recovery meal",
    accent: "from-indigo-500 to-blue-500"
  },
  Snack: {
    emoji: "🍪",
    subtitle: "Quick refuel",
    accent: "from-fuchsia-500 to-pink-500"
  }
};

const WATER_ML_PER_CUP = 250;
const MAX_WATER_CUPS_UI = 20;

function clampPositive(value: number, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function toDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
}

function emptyDraft(meal: MealType = "Lunch"): DraftForm {
  return {
    meal_type: meal,
    food_name: "",
    grams: 180,
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    ingredients: [],
    note: ""
  };
}

function parseNumeric(input: string, fallback: number) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function FoodPageClient({ labels }: { labels: Labels }) {
  const [selectedDate, setSelectedDate] = useState(todayLocalISO());
  const [logs, setLogs] = useState<ReturnType<typeof getFoodLogs>>([]);
  const [mounted, setMounted] = useState(false);

  const [waterPulse, setWaterPulse] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReference, setSelectedReference] = useState<FoodReference | null>(null);
  const [autoEstimate, setAutoEstimate] = useState(true);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft());
  const [expandedMeals, setExpandedMeals] = useState<Record<MealType, boolean>>({
    Breakfast: true,
    Lunch: true,
    Dinner: false,
    Snack: false
  });

  useEffect(() => {
    setLogs(getFoodLogs());
    setMounted(true);
  }, []);

  const goals = mounted
    ? getWellnessGoals()
    : { calorie_goal: 2100, water_goal: 8, movement_goal: 60, sleep_goal_minutes: 480 };

  const summary = mounted
    ? getFoodSummary(selectedDate)
    : {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        waterCups: 0,
        goal: 2100,
        remaining: 2100,
        percent: 0
      };

  const waterUnit = goals.water_unit === "ml" ? "ml" : "cups";
  const waterGoalCups = useMemo(() => {
    const goalFromCups = Math.max(1, Math.round(goals.water_goal ?? 8));
    const goalFromMl = Math.max(
      1,
      Math.round((goals.water_goal_ml ?? goalFromCups * WATER_ML_PER_CUP) / WATER_ML_PER_CUP)
    );
    return waterUnit === "ml" ? goalFromMl : goalFromCups;
  }, [goals.water_goal, goals.water_goal_ml, waterUnit]);
  const waterGoalMl = useMemo(
    () => Math.max(WATER_ML_PER_CUP, Math.round(goals.water_goal_ml ?? waterGoalCups * WATER_ML_PER_CUP)),
    [goals.water_goal_ml, waterGoalCups]
  );
  const waterDotCount = Math.min(MAX_WATER_CUPS_UI, Math.max(waterGoalCups, summary.waterCups, 1));
  const consumedMl = summary.waterCups * WATER_ML_PER_CUP;

  const dayLogs = useMemo(() => logs.filter((item) => item.date === selectedDate), [logs, selectedDate]);

  const mealBreakdown = useMemo(
    () =>
      MEAL_ORDER.map((meal) => {
        const entries = dayLogs.filter((item) => item.meal_type === meal);
        return {
          meal_type: meal,
          entries,
          count: entries.length,
          calories: entries.reduce((sum, item) => sum + item.calories, 0),
          grams: entries.reduce((sum, item) => sum + item.grams, 0),
          protein: entries.reduce((sum, item) => sum + item.protein, 0),
          fat: entries.reduce((sum, item) => sum + item.fat, 0),
          carbs: entries.reduce((sum, item) => sum + item.carbs, 0)
        };
      }),
    [dayLogs]
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

  const maxWeekly = useMemo(() => Math.max(1, ...weeklyCalories.map((item) => item.total)), [weeklyCalories]);

  const searchResults = useMemo(() => searchFoodReferences(searchQuery, 10), [searchQuery]);

  const smartInsight = useMemo(() => {
    if (summary.protein >= 90) {
      return "Great protein balance today. Your recovery nutrition looks strong.";
    }
    if (summary.carbs < 160 && summary.calories > 0) {
      return "Carbs are a bit low. Consider adding fruit or grains for sustained focus.";
    }
    if (summary.fat > 75) {
      return "Fat intake is on the higher side. Keep the next meal lighter and hydrated.";
    }
    if (summary.waterCups < Math.max(1, Math.round(goals.water_goal * 0.6))) {
      return "Hydration is lagging. Add one cup between work blocks to keep energy stable.";
    }
    return "Balanced pace today. Keep this rhythm and finish with a light protein-forward meal.";
  }, [goals.water_goal, summary.calories, summary.carbs, summary.fat, summary.protein, summary.waterCups]);

  function syncState() {
    setLogs(getFoodLogs());
  }

  function openCreateModal(defaultMeal: MealType = "Lunch") {
    setEditorMode("create");
    setDraft(emptyDraft(defaultMeal));
    setSelectedReference(null);
    setAutoEstimate(true);
    setSearchQuery("");
    setEditorOpen(true);
  }

  function openEditModal(entry: FoodLog) {
    setEditorMode("edit");
    setDraft({
      id: entry.id,
      meal_type: entry.meal_type,
      food_name: entry.food_name,
      grams: entry.grams,
      calories: entry.calories,
      protein: entry.protein,
      fat: entry.fat,
      carbs: entry.carbs,
      ingredients: entry.ingredients,
      note: entry.note
    });
    setSearchQuery(entry.food_name);
    setSelectedReference(null);
    setAutoEstimate(false);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
  }

  function applyNutritionFromReference(reference: FoodReference, nextGrams: number, nextMeal?: MealType) {
    const estimated = estimateNutritionFromReference(reference, nextGrams);
    setDraft((prev) => ({
      ...prev,
      meal_type: nextMeal ?? prev.meal_type,
      food_name: reference.name,
      grams: estimated.grams,
      calories: estimated.calories,
      protein: estimated.protein,
      fat: estimated.fat,
      carbs: estimated.carbs,
      ingredients: estimated.ingredients
    }));
    setSearchQuery(reference.name);
    setSelectedReference(reference);
    setAutoEstimate(true);
  }

  function runTextEstimation() {
    const basis = draft.food_name.trim() || searchQuery.trim();
    if (!basis) return;
    const estimated = estimateNutritionFromText(basis, draft.grams);
    setDraft((prev) => ({
      ...prev,
      food_name: prev.food_name.trim() || basis,
      grams: estimated.grams,
      calories: estimated.calories,
      protein: estimated.protein,
      fat: estimated.fat,
      carbs: estimated.carbs,
      ingredients: estimated.ingredients
    }));
    setSelectedReference(null);
    setAutoEstimate(true);
  }

  function onGramsChange(raw: string) {
    const parsed = Math.max(1, Math.round(parseNumeric(raw, draft.grams)));
    if (autoEstimate && selectedReference) {
      const estimated = estimateNutritionFromReference(selectedReference, parsed);
      setDraft((prev) => ({
        ...prev,
        grams: estimated.grams,
        calories: estimated.calories,
        protein: estimated.protein,
        fat: estimated.fat,
        carbs: estimated.carbs,
        ingredients: estimated.ingredients
      }));
      return;
    }

    if (autoEstimate && draft.food_name.trim()) {
      const estimated = estimateNutritionFromText(draft.food_name, parsed);
      setDraft((prev) => ({
        ...prev,
        grams: estimated.grams,
        calories: estimated.calories,
        protein: estimated.protein,
        fat: estimated.fat,
        carbs: estimated.carbs,
        ingredients: estimated.ingredients
      }));
      return;
    }

    setDraft((prev) => ({ ...prev, grams: parsed }));
  }

  function updateMacroField(key: "calories" | "protein" | "fat" | "carbs", raw: string) {
    const next = parseNumeric(raw, draft[key]);
    setAutoEstimate(false);
    setDraft((prev) => ({ ...prev, [key]: key === "calories" ? Math.round(clampPositive(next, 0)) : roundOne(clampPositive(next, 0)) }));
  }

  function saveDraft() {
    const foodName = draft.food_name.trim();
    if (!foodName) return;

    upsertFoodLog({
      id: draft.id,
      date: selectedDate,
      meal_type: draft.meal_type,
      food_name: foodName,
      grams: Math.max(1, Math.round(draft.grams || 1)),
      calories: Math.max(0, Math.round(draft.calories || 0)),
      protein: roundOne(clampPositive(draft.protein, 0)),
      fat: roundOne(clampPositive(draft.fat, 0)),
      carbs: roundOne(clampPositive(draft.carbs, 0)),
      ingredients: draft.ingredients,
      water: 0,
      note: draft.note,
      appetite_level: "Normal",
      balanced_meal_rating: 4,
      overeating: false
    });
    syncState();
    closeEditor();
  }

  function removeEntry(id: string) {
    deleteFoodLog(id);
    syncState();
  }

  function cloneEntry(id: string) {
    duplicateFoodLog(id);
    syncState();
  }

  function toggleMeal(meal: MealType) {
    setExpandedMeals((prev) => ({ ...prev, [meal]: !prev[meal] }));
  }

  function setWaterCups(nextCups: number) {
    const normalized = Math.max(0, Math.min(MAX_WATER_CUPS_UI, Math.round(nextCups)));
    setWaterByDate(selectedDate, normalized);
    setWaterPulse(true);
    setTimeout(() => setWaterPulse(false), 400);
    syncState();
  }

  function addWater() {
    setWaterCups(summary.waterCups + 1);
  }

  function removeWater() {
    setWaterCups(summary.waterCups - 1);
  }

  function setWaterUnit(unit: "cups" | "ml") {
    if (unit === "ml") {
      setWellnessGoals({
        water_unit: "ml",
        water_goal_ml: waterGoalMl,
        water_goal: Math.max(1, Math.round(waterGoalMl / WATER_ML_PER_CUP))
      });
    } else {
      setWellnessGoals({
        water_unit: "cups",
        water_goal: waterGoalCups,
        water_goal_ml: Math.max(WATER_ML_PER_CUP, waterGoalCups * WATER_ML_PER_CUP)
      });
    }
    syncState();
  }

  function nudgeWaterGoal(delta: number) {
    if (waterUnit === "ml") {
      const nextMl = Math.max(WATER_ML_PER_CUP, Math.min(6000, waterGoalMl + delta * WATER_ML_PER_CUP));
      setWellnessGoals({
        water_unit: "ml",
        water_goal_ml: nextMl,
        water_goal: Math.max(1, Math.round(nextMl / WATER_ML_PER_CUP))
      });
      syncState();
      return;
    }

    const nextCups = Math.max(1, Math.min(MAX_WATER_CUPS_UI, waterGoalCups + delta));
    setWellnessGoals({
      water_unit: "cups",
      water_goal: nextCups,
      water_goal_ml: Math.max(WATER_ML_PER_CUP, nextCups * WATER_ML_PER_CUP)
    });
    syncState();
  }

  function resetWaterGoal() {
    if (waterUnit === "ml") {
      const nextMl = Number(window.prompt("Set daily water goal (ml)", String(waterGoalMl)) ?? waterGoalMl);
      if (!Number.isFinite(nextMl)) return;
      const normalizedMl = Math.max(WATER_ML_PER_CUP, Math.round(nextMl));
      setWellnessGoals({
        water_unit: "ml",
        water_goal_ml: normalizedMl,
        water_goal: Math.max(1, Math.round(normalizedMl / WATER_ML_PER_CUP))
      });
      syncState();
      return;
    }

    const nextCups = Number(window.prompt("Set daily water goal (cups)", String(waterGoalCups)) ?? waterGoalCups);
    if (!Number.isFinite(nextCups)) return;
    const normalizedCups = Math.max(1, Math.round(nextCups));
    setWellnessGoals({
      water_unit: "cups",
      water_goal: normalizedCups,
      water_goal_ml: normalizedCups * WATER_ML_PER_CUP
    });
    syncState();
  }

  function updateCalorieGoal() {
    const next = Number(window.prompt("Set daily calorie goal", String(goals.calorie_goal)) ?? goals.calorie_goal);
    if (!Number.isFinite(next)) return;
    setWellnessGoals({ calorie_goal: Math.max(1000, Math.round(next)) });
    syncState();
  }

  const totalMealCount = mealBreakdown.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="pb-32">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="rounded-full bg-white px-2 py-2 text-blue-600 shadow-sm" href="/app/welcome">
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Food</h1>
            <p className="text-xs text-slate-500">Meal tracker with AI nutrition estimate</p>
          </div>
        </div>
        <button
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600"
          onClick={() => setSelectedDate(todayLocalISO())}
          type="button"
        >
          Today
        </button>
      </header>

      <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0f57d8] to-[#1849c7] p-5 text-white shadow-[0_20px_45px_rgba(10,80,200,0.24)]">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Daily Nutrition</p>
        <div className="mt-1 flex items-end gap-2">
          <p className="text-4xl font-black leading-none">{summary.calories.toLocaleString()}</p>
          <p className="pb-1 text-lg text-blue-100">/ {goals.calorie_goal.toLocaleString()} kcal</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">Protein</p>
            <p className="text-xl font-black">{summary.protein}g</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">Fat</p>
            <p className="text-xl font-black">{summary.fat}g</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">Carbs</p>
            <p className="text-xl font-black">{summary.carbs}g</p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-[#f3c399] transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(100, summary.percent))}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-100">
          <span>Remaining {summary.remaining.toLocaleString()} kcal</span>
          <span>•</span>
          <span>{summary.percent}% of goal</span>
          <button className="rounded-full bg-white/20 px-3 py-1 text-[11px]" onClick={updateCalorieGoal} type="button">
            Edit goal
          </button>
        </div>
      </article>

      <article className="mt-4 rounded-3xl border-l-4 border-amber-700 bg-[#f5e4d8] p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-700 p-2 text-white">
            <Sparkles size={14} />
          </div>
          <div>
            <p className="text-sm font-black text-amber-900">AI Insight</p>
            <p className="text-sm text-amber-800">{smartInsight}</p>
          </div>
        </div>
      </article>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Meal Breakdown</h2>
            <p className="text-xs text-slate-500">Breakfast / Lunch / Dinner / Snack totals and macro details</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">{totalMealCount} logs</span>
        </div>

        <div className="space-y-3">
          {mealBreakdown.map((meal) => {
            const isOpen = expandedMeals[meal.meal_type];
            const meta = MEAL_META[meal.meal_type];
            return (
              <article className="overflow-hidden rounded-[1.8rem] bg-white p-3 shadow-sm" key={meal.meal_type}>
                <div className="flex items-center justify-between gap-2">
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggleMeal(meal.meal_type)} type="button">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">{meta.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-black text-slate-900">{meal.meal_type}</p>
                      <p className="truncate text-xs text-slate-500">{meta.subtitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-blue-700">{meal.calories} kcal</p>
                      <p className="text-xs text-slate-500">{meal.count} item(s)</p>
                    </div>
                    {isOpen ? <ChevronDown className="text-slate-400" size={18} /> : <ChevronRight className="text-slate-400" size={18} />}
                  </button>
                  <button
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent} text-white`}
                    onClick={() => openCreateModal(meal.meal_type)}
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-2">
                      <div className="rounded-xl bg-white px-2 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Grams</p>
                        <p className="text-sm font-black text-slate-900">{meal.grams}g</p>
                      </div>
                      <div className="rounded-xl bg-white px-2 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Protein</p>
                        <p className="text-sm font-black text-slate-900">{meal.protein}g</p>
                      </div>
                      <div className="rounded-xl bg-white px-2 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Fat</p>
                        <p className="text-sm font-black text-slate-900">{meal.fat}g</p>
                      </div>
                      <div className="rounded-xl bg-white px-2 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Carbs</p>
                        <p className="text-sm font-black text-slate-900">{meal.carbs}g</p>
                      </div>
                    </div>

                    {meal.entries.map((entry) => (
                      <div className="rounded-2xl border border-slate-100 px-3 py-2" key={entry.id}>
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{entry.food_name}</p>
                          <p className="text-xs font-semibold text-slate-500">{entry.grams}g</p>
                          <p className="text-sm font-black text-blue-700">{entry.calories} kcal</p>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          P {entry.protein}g • F {entry.fat}g • C {entry.carbs}g
                        </p>
                        {entry.ingredients.length > 0 && (
                          <p className="mt-1 truncate text-[11px] text-slate-400">Ingredients: {entry.ingredients.join(", ")}</p>
                        )}
                        <div className="mt-2 flex items-center gap-1">
                          <button className="rounded-lg bg-slate-100 p-2 text-slate-600" onClick={() => openEditModal(entry)} type="button">
                            <Pencil size={12} />
                          </button>
                          <button className="rounded-lg bg-slate-100 p-2 text-slate-600" onClick={() => cloneEntry(entry.id)} type="button">
                            <Copy size={12} />
                          </button>
                          <button className="rounded-lg bg-rose-50 p-2 text-rose-600" onClick={() => removeEntry(entry.id)} type="button">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {meal.entries.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">No food logged for this meal yet.</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-7 grid grid-cols-1 gap-4">
        <article className="rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">Weekly Calories</h3>
            <span className="text-blue-600">↗</span>
          </div>
          <div className="flex h-28 items-end gap-2">
            {weeklyCalories.map((item) => {
              const active = item.date === selectedDate;
              const height = Math.max(10, Math.round((item.total / maxWeekly) * 100));
              return (
                <button key={item.date} className="group flex flex-1 flex-col items-center" onClick={() => setSelectedDate(item.date)} type="button">
                  <div className="w-full rounded-full bg-slate-100">
                    <div
                      className={`w-full rounded-full transition-all ${active ? "bg-blue-600" : "bg-[#b6c8ea] group-hover:bg-[#9cb4e3]"}`}
                      style={{ height: `${height}px` }}
                    />
                  </div>
                  <span className={`mt-2 text-[10px] font-bold ${active ? "text-blue-600" : "text-slate-500"}`}>{toDayLabel(item.date)}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">Water Intake</h3>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="rounded-full bg-slate-100 p-0.5">
                <button
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${waterUnit === "cups" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}
                  onClick={() => setWaterUnit("cups")}
                  type="button"
                >
                  cups
                </button>
                <button
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${waterUnit === "ml" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}
                  onClick={() => setWaterUnit("ml")}
                  type="button"
                >
                  ml
                </button>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-slate-100 px-1 py-1">
                <button
                  aria-label="Decrease water goal"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
                  onClick={() => nudgeWaterGoal(-1)}
                  type="button"
                >
                  <Minus size={13} />
                </button>
                <button
                  className="rounded-full px-3 py-1 text-xs font-semibold text-slate-700"
                  onClick={resetWaterGoal}
                  type="button"
                >
                  Goal {waterUnit === "ml" ? `${waterGoalMl} ml` : `${waterGoalCups} cups`}
                </button>
                <button
                  aria-label="Increase water goal"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
                  onClick={() => nudgeWaterGoal(1)}
                  type="button"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>
          <div className={`grid grid-cols-8 gap-2 transition ${waterPulse ? "scale-[1.01]" : ""}`}>
            {Array.from({ length: waterDotCount }, (_, index) => index + 1).map((cup) => {
              const done = cup <= summary.waterCups;
              return (
                <button
                  key={cup}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${done ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}
                  onClick={() => setWaterCups(summary.waterCups === cup ? cup - 1 : cup)}
                  type="button"
                >
                  <Droplets size={14} />
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {waterUnit === "ml"
              ? `${consumedMl} ml of ${waterGoalMl} ml achieved today`
              : `${summary.waterCups} of ${waterGoalCups} cups achieved today`}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              aria-label="Reduce water by one cup"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              onClick={removeWater}
              type="button"
            >
              <Minus size={16} />
            </button>
            <button
              aria-label="Increase water by one cup"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white"
              onClick={addWater}
              type="button"
            >
              <Plus size={16} />
            </button>
            <p className="text-xs font-semibold text-slate-500">Tap droplets or use +/- for quick edits.</p>
          </div>
        </article>
      </section>

      <button
        className="fixed bottom-[11.2rem] right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:scale-105 active:scale-95"
        onClick={() => openCreateModal("Lunch")}
        type="button"
      >
        <Plus size={18} />
      </button>
      <button
        className="fixed bottom-28 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-white shadow-xl transition hover:scale-105 active:scale-95"
        onClick={() => openCreateModal("Snack")}
        type="button"
      >
        <ScanLine size={20} />
      </button>

      {editorOpen && (
        <div className="fixed inset-0 z-[82] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-black text-slate-900">{editorMode === "create" ? "Add Food" : "Edit Food"}</p>
                <p className="text-[11px] text-slate-500">Search and auto-calculate nutrition, then fine-tune manually.</p>
              </div>
              <button className="rounded-full bg-slate-100 p-2 text-slate-600" onClick={closeEditor} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[72vh] space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Meal Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_ORDER.map((meal) => (
                    <button
                      key={meal}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        draft.meal_type === meal ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                      onClick={() => setDraft((prev) => ({ ...prev, meal_type: meal }))}
                      type="button"
                    >
                      {MEAL_META[meal].emoji} {meal}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="food-search">
                  Food Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
                    id="food-search"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setDraft((prev) => ({ ...prev, food_name: event.target.value }));
                      setSelectedReference(null);
                    }}
                    placeholder="Search food (e.g., chicken breast, bibimbap, banana)"
                    value={searchQuery}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-bold text-slate-500">AI suggestions</p>
                  <button className="text-xs font-semibold text-blue-700" onClick={runTextEstimation} type="button">
                    Auto estimate from text
                  </button>
                </div>
                <div className="max-h-44 space-y-1 overflow-y-auto">
                  {searchResults.map((reference) => (
                    <button
                      key={reference.id}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                        selectedReference?.id === reference.id ? "bg-blue-50 ring-1 ring-blue-300" : "bg-white hover:bg-slate-100"
                      }`}
                      onClick={() => applyNutritionFromReference(reference, draft.grams, draft.meal_type)}
                      type="button"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {reference.emoji} {reference.name}
                        </p>
                        <p className="text-[11px] text-slate-500">Suggested: {reference.suggestedMeal}</p>
                      </div>
                      <p className="text-[11px] text-slate-500">{reference.per100g.calories} kcal/100g</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="grams-input">
                  Portion (grams)
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                  id="grams-input"
                  min={1}
                  onChange={(event) => onGramsChange(event.target.value)}
                  step={1}
                  type="number"
                  value={draft.grams}
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input
                    checked={autoEstimate}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    onChange={(event) => setAutoEstimate(event.target.checked)}
                    type="checkbox"
                  />
                  Keep nutrition linked to AI estimate when grams change
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-500">
                  kcal
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
                    min={0}
                    onChange={(event) => updateMacroField("calories", event.target.value)}
                    step={1}
                    type="number"
                    value={draft.calories}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Protein (g)
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
                    min={0}
                    onChange={(event) => updateMacroField("protein", event.target.value)}
                    step={0.1}
                    type="number"
                    value={draft.protein}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Fat (g)
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
                    min={0}
                    onChange={(event) => updateMacroField("fat", event.target.value)}
                    step={0.1}
                    type="number"
                    value={draft.fat}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Carbs (g)
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
                    min={0}
                    onChange={(event) => updateMacroField("carbs", event.target.value)}
                    step={0.1}
                    type="number"
                    value={draft.carbs}
                  />
                </label>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Ingredients (AI suggested)</label>
                <div className="flex min-h-11 flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {draft.ingredients.length > 0 ? (
                    draft.ingredients.map((ingredient) => (
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600" key={ingredient}>
                        {ingredient}
                      </span>
                    ))
                  ) : (
                    <span className="px-1 text-xs text-slate-400">No ingredient data yet. Pick a suggestion or run AI estimate.</span>
                  )}
                </div>
              </div>

              <label className="text-xs font-semibold text-slate-500">
                Notes (optional)
                <textarea
                  className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="Anything notable about this meal"
                  value={draft.note}
                />
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600" onClick={closeEditor} type="button">
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!draft.food_name.trim()}
                onClick={saveDraft}
                type="button"
              >
                <Plus size={14} />
                {editorMode === "create" ? "Add food" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomTabs active="questions" labels={labels} />
    </section>
  );
}
