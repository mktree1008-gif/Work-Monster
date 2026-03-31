"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
  Home,
  Plus,
  Search,
  Sparkles,
  Star,
  StretchHorizontal,
  TimerReset,
  Trees,
  WandSparkles,
  X
} from "lucide-react";
import {
  deleteWorkoutLog,
  getWellnessGoals,
  getWorkoutManualCaloriesByDate,
  getWorkoutLogs,
  getWorkoutRoutines,
  removeWorkoutRoutine,
  setWorkoutManualCaloriesByDate,
  setWellnessGoals,
  todayLocalISO,
  toggleWorkoutRoutineFavorite,
  touchWorkoutRoutineUsage,
  upsertWorkoutLog,
  upsertWorkoutRoutine,
  weeklyDates,
  WorkoutIntensity,
  WorkoutLog,
  WorkoutRoutine,
  WorkoutType
} from "@/lib/wellness-storage";
import {
  estimateWorkoutFromReference,
  estimateWorkoutFromText,
  searchWorkoutReferences,
  WorkoutReference
} from "@/lib/workout-ai";
import { BottomTabs } from "@/components/bottom-tabs";

type Labels = {
  questions: string;
  record: string;
  rewards: string;
  score: string;
  rules: string;
};

type WorkoutDraft = {
  id?: string;
  title: string;
  workout_type: WorkoutType;
  start_time: string;
  duration: number;
  calories_burned: number;
  steps: number;
  intensity: WorkoutIntensity;
  location: string;
  note: string;
  weightKg: number;
};

function workoutIcon(type: WorkoutType) {
  if (type === "Gym") return <Dumbbell size={16} />;
  if (type === "Walk") return <Trees size={16} />;
  if (type === "Run") return <Activity size={16} />;
  if (type === "Stretch") return <StretchHorizontal size={16} />;
  if (type === "Home") return <Home size={16} />;
  return <TimerReset size={16} />;
}

function emptyDraft(): WorkoutDraft {
  return {
    title: "",
    workout_type: "Custom",
    start_time: "18:00",
    duration: 30,
    calories_burned: 180,
    steps: 1800,
    intensity: "medium",
    location: "Custom",
    note: "",
    weightKg: 65
  };
}

function toDayLetter(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
}

function toDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DurationDial({
  value,
  min = 5,
  max = 180,
  step = 5,
  onChange
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  const dialRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const ratio = Math.max(0, Math.min(1, (value - min) / Math.max(1, max - min)));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * ratio;
  const angle = ratio * Math.PI * 2 - Math.PI / 2;
  const handleX = 50 + Math.cos(angle) * 36;
  const handleY = 50 + Math.sin(angle) * 36;

  const updateFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const element = dialRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      let radians = Math.atan2(dy, dx);
      radians += Math.PI / 2;
      if (radians < 0) radians += Math.PI * 2;
      const nextRatio = radians / (Math.PI * 2);
      const raw = min + nextRatio * (max - min);
      const snapped = Math.round(raw / step) * step;
      const clamped = Math.max(min, Math.min(max, snapped));
      onChange(clamped);
    },
    [max, min, onChange, step]
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (event: PointerEvent) => updateFromPoint(event.clientX, event.clientY);
    const handleUp = () => setDragging(false);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging, updateFromPoint]);

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-28 w-28 touch-none"
        onPointerDown={(event) => {
          event.preventDefault();
          setDragging(true);
          updateFromPoint(event.clientX, event.clientY);
        }}
        ref={dialRef}
      >
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="none" r={radius} stroke="#dfe5ef" strokeWidth="9" />
          <circle
            cx="50"
            cy="50"
            fill="none"
            r={radius}
            stroke="#1d55d8"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            strokeWidth="9"
          />
        </svg>
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
          style={{ left: `${handleX}%`, top: `${handleY}%` }}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Duration</p>
          <p className="text-xl font-black text-slate-900">{value}m</p>
        </div>
      </div>
      <div className="flex flex-1 flex-wrap gap-2">
        {[15, 20, 30, 45, 60, 90].map((candidate) => (
          <button
            className={`rounded-full px-3 py-1 text-xs font-semibold ${candidate === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            key={candidate}
            onClick={() => onChange(candidate)}
            type="button"
          >
            {candidate}m
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkoutPageClient({ labels }: { labels: Labels }) {
  const [selectedDate, setSelectedDate] = useState(todayLocalISO());
  const [logs, setLogs] = useState<ReturnType<typeof getWorkoutLogs>>([]);
  const [routines, setRoutines] = useState<ReturnType<typeof getWorkoutRoutines>>([]);
  const [mounted, setMounted] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [searchQuery, setSearchQuery] = useState("");
  const [draft, setDraft] = useState<WorkoutDraft>(emptyDraft());
  const [autoEstimate, setAutoEstimate] = useState(true);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [selectedReference, setSelectedReference] = useState<WorkoutReference | null>(null);
  const [saveAsRoutine, setSaveAsRoutine] = useState(true);
  const [saveRoutineFavorite, setSaveRoutineFavorite] = useState(true);
  const [manualCaloriesInput, setManualCaloriesInput] = useState("");

  useEffect(() => {
    setLogs(getWorkoutLogs());
    setRoutines(getWorkoutRoutines());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const manualCalories = getWorkoutManualCaloriesByDate(selectedDate);
    setManualCaloriesInput(manualCalories > 0 ? String(manualCalories) : "");
  }, [mounted, selectedDate]);

  const todayLogs = useMemo(
    () => logs.filter((item) => item.date === selectedDate).sort((a, b) => (a.created_at > b.created_at ? -1 : 1)),
    [logs, selectedDate]
  );

  const goals = mounted
    ? getWellnessGoals()
    : { calorie_goal: 2100, water_goal: 8, movement_goal: 60, sleep_goal_minutes: 480 };

  const summary = useMemo(() => {
    const minutes = todayLogs.reduce((sum, item) => sum + item.duration, 0);
    const calories = todayLogs.reduce((sum, item) => sum + item.calories_burned, 0) + getWorkoutManualCaloriesByDate(selectedDate);
    const steps = todayLogs.reduce((sum, item) => sum + item.steps, 0);
    const label = todayLogs.length > 0 ? [...new Set(todayLogs.map((item) => item.workout_type))].join(" • ") : "No workout yet";
    return {
      minutes,
      calories,
      steps,
      label,
      percent: Math.max(0, Math.min(100, Math.round((minutes / Math.max(1, goals.movement_goal)) * 100)))
    };
  }, [goals.movement_goal, selectedDate, todayLogs]);

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
  const searchResults = useMemo(() => searchWorkoutReferences(searchQuery, 10), [searchQuery]);

  const favoriteRoutines = useMemo(() => routines.filter((item) => item.is_favorite).slice(0, 5), [routines]);
  const frequentRoutines = useMemo(() => routines.slice(0, 8), [routines]);

  const consistencyDays = useMemo(() => {
    return weekDates.filter((date) => logs.some((item) => item.date === date)).length;
  }, [logs, weekDates]);
  const consistencyPercent = Math.max(0, Math.min(100, Math.round((consistencyDays / 5) * 100)));

  function syncAll() {
    setLogs(getWorkoutLogs());
    setRoutines(getWorkoutRoutines());
  }

  function applyEstimateByText(nextTitle: string, nextDuration: number, nextWeight: number) {
    const estimated = estimateWorkoutFromText(nextTitle, nextDuration, nextWeight);
    setDraft((prev) => ({
      ...prev,
      title: nextTitle,
      duration: estimated.duration,
      calories_burned: estimated.calories,
      steps: estimated.steps,
      intensity: estimated.intensity,
      location: estimated.location,
      workout_type: prev.workout_type === "Custom" ? estimated.workout_type : prev.workout_type
    }));
  }

  function openCreateModal(routine?: WorkoutRoutine) {
    setEditorMode("create");
    setSearchQuery("");
    setSelectedReference(null);
    setSelectedRoutineId(null);
    if (routine) {
      const estimated = estimateWorkoutFromText(routine.title, routine.duration, 65);
      setDraft({
        title: routine.title,
        workout_type: routine.workout_type,
        start_time: "18:00",
        duration: routine.duration,
        calories_burned: routine.calories_hint > 0 ? routine.calories_hint : estimated.calories,
        steps: routine.steps > 0 ? routine.steps : estimated.steps,
        intensity: routine.intensity,
        location: routine.location,
        note: "",
        weightKg: 65
      });
      setSelectedRoutineId(routine.id);
      setSaveAsRoutine(true);
      setSaveRoutineFavorite(routine.is_favorite);
    } else {
      const defaultRoutine = routines[0];
      if (defaultRoutine) {
        const estimated = estimateWorkoutFromText(defaultRoutine.title, defaultRoutine.duration, 65);
        setDraft({
          title: defaultRoutine.title,
          workout_type: defaultRoutine.workout_type,
          start_time: "18:00",
          duration: defaultRoutine.duration,
          calories_burned: defaultRoutine.calories_hint > 0 ? defaultRoutine.calories_hint : estimated.calories,
          steps: defaultRoutine.steps > 0 ? defaultRoutine.steps : estimated.steps,
          intensity: defaultRoutine.intensity,
          location: defaultRoutine.location,
          note: "",
          weightKg: 65
        });
        setSearchQuery(defaultRoutine.title);
        setSelectedRoutineId(defaultRoutine.id);
        setSaveAsRoutine(true);
        setSaveRoutineFavorite(defaultRoutine.is_favorite);
      } else {
        setDraft(emptyDraft());
        setSaveAsRoutine(true);
        setSaveRoutineFavorite(true);
      }
    }
    setAutoEstimate(true);
    setEditorOpen(true);
  }

  function openEditModal(log: WorkoutLog) {
    setEditorMode("edit");
    setDraft({
      id: log.id,
      title: log.title,
      workout_type: log.workout_type,
      start_time: log.start_time,
      duration: log.duration,
      calories_burned: log.calories_burned,
      steps: log.steps,
      intensity: log.intensity,
      location: log.location,
      note: log.note,
      weightKg: 65
    });
    setSearchQuery(log.title);
    setSelectedRoutineId(log.routine_id ?? null);
    setSelectedReference(null);
    setAutoEstimate(false);
    setSaveAsRoutine(Boolean(log.routine_id));
    const existingRoutine = log.routine_id ? routines.find((item) => item.id === log.routine_id) : null;
    setSaveRoutineFavorite(existingRoutine?.is_favorite ?? true);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
  }

  function applyRoutine(routine: WorkoutRoutine) {
    setDraft((prev) => ({
      ...prev,
      title: routine.title,
      workout_type: routine.workout_type,
      duration: routine.duration,
      calories_burned: routine.calories_hint,
      steps: routine.steps,
      intensity: routine.intensity,
      location: routine.location
    }));
    setSearchQuery(routine.title);
    setSelectedRoutineId(routine.id);
    setSelectedReference(null);
    setAutoEstimate(true);
    setSaveAsRoutine(true);
    setSaveRoutineFavorite(routine.is_favorite);
  }

  function applyReference(reference: WorkoutReference) {
    const estimate = estimateWorkoutFromReference(reference, draft.duration, draft.weightKg);
    setDraft((prev) => ({
      ...prev,
      title: reference.name,
      workout_type: reference.workout_type,
      duration: estimate.duration,
      calories_burned: estimate.calories,
      steps: estimate.steps,
      intensity: estimate.intensity,
      location: estimate.location
    }));
    setSearchQuery(reference.name);
    setSelectedReference(reference);
    setSelectedRoutineId(null);
    setAutoEstimate(true);
  }

  function onDurationChange(nextDuration: number) {
    const safeDuration = Math.max(5, Math.round(nextDuration));
    if (autoEstimate && selectedReference) {
      const estimate = estimateWorkoutFromReference(selectedReference, safeDuration, draft.weightKg);
      setDraft((prev) => ({
        ...prev,
        duration: estimate.duration,
        calories_burned: estimate.calories,
        steps: estimate.steps,
        intensity: estimate.intensity,
        location: estimate.location
      }));
      return;
    }

    if (autoEstimate && draft.title.trim()) {
      const estimate = estimateWorkoutFromText(draft.title, safeDuration, draft.weightKg);
      setDraft((prev) => ({
        ...prev,
        duration: estimate.duration,
        calories_burned: estimate.calories,
        steps: estimate.steps,
        intensity: estimate.intensity,
        location: estimate.location,
        workout_type: prev.workout_type === "Custom" ? estimate.workout_type : prev.workout_type
      }));
      return;
    }

    setDraft((prev) => ({ ...prev, duration: safeDuration }));
  }

  function onWeightChange(raw: string) {
    const nextWeight = Math.max(35, Math.min(180, Math.round(Number(raw) || draft.weightKg)));
    setDraft((prev) => ({ ...prev, weightKg: nextWeight }));
    if (autoEstimate && selectedReference) {
      const estimate = estimateWorkoutFromReference(selectedReference, draft.duration, nextWeight);
      setDraft((prev) => ({ ...prev, calories_burned: estimate.calories, steps: estimate.steps }));
      return;
    }
    if (autoEstimate && draft.title.trim()) {
      const estimate = estimateWorkoutFromText(draft.title, draft.duration, nextWeight);
      setDraft((prev) => ({
        ...prev,
        calories_burned: estimate.calories,
        steps: estimate.steps,
        intensity: estimate.intensity,
        location: estimate.location,
        workout_type: prev.workout_type === "Custom" ? estimate.workout_type : prev.workout_type
      }));
    }
  }

  function saveWorkout() {
    const title = draft.title.trim();
    if (!title) return;

    let resolvedRoutineId = selectedRoutineId;
    if (saveAsRoutine) {
      const bySignature = routines.find(
        (item) => item.title.toLowerCase() === title.toLowerCase() && item.workout_type === draft.workout_type
      );
      const existing = selectedRoutineId ? routines.find((item) => item.id === selectedRoutineId) : bySignature;
      const routine = upsertWorkoutRoutine({
        id: existing?.id,
        title,
        workout_type: draft.workout_type,
        duration: draft.duration,
        intensity: draft.intensity,
        location: draft.location,
        steps: draft.steps,
        calories_hint: draft.calories_burned,
        is_favorite: saveRoutineFavorite,
        use_count: (existing?.use_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
        created_at: existing?.created_at
      });
      resolvedRoutineId = routine.id;
    } else if (selectedRoutineId) {
      touchWorkoutRoutineUsage(selectedRoutineId);
    }

    upsertWorkoutLog({
      id: draft.id,
      date: selectedDate,
      workout_type: draft.workout_type,
      routine_id: resolvedRoutineId ?? undefined,
      title,
      start_time: draft.start_time,
      duration: draft.duration,
      calories_burned: draft.calories_burned,
      steps: draft.steps,
      intensity: draft.intensity,
      location: draft.location,
      fatigue: draft.intensity === "high" ? 3 : draft.intensity === "low" ? 1 : 2,
      mission_linked: draft.workout_type === "Run" || draft.workout_type === "Gym",
      note: draft.note
    });

    syncAll();
    closeEditor();
  }

  function removeWorkout(id: string) {
    deleteWorkoutLog(id);
    syncAll();
  }

  function toggleRoutineStar(id: string) {
    toggleWorkoutRoutineFavorite(id);
    syncAll();
  }

  function removeRoutine(id: string) {
    removeWorkoutRoutine(id);
    syncAll();
  }

  function updateMovementGoal() {
    const next = Number(window.prompt("Set daily movement goal (minutes)", String(goals.movement_goal)) ?? goals.movement_goal);
    if (!Number.isFinite(next)) return;
    setWellnessGoals({ movement_goal: Math.max(10, Math.round(next)) });
    syncAll();
  }

  function saveManualCalories() {
    const parsed = Math.max(0, Math.round(Number(manualCaloriesInput) || 0));
    const saved = setWorkoutManualCaloriesByDate(selectedDate, parsed);
    setManualCaloriesInput(saved > 0 ? String(saved) : "");
    syncAll();
  }

  return (
    <section className="pb-32">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="rounded-full bg-white px-2 py-2 text-blue-600 shadow-sm" href="/app/welcome">
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Workout</h1>
            <p className="text-xs text-slate-500">Search exercise, set time, auto-calc calories, save routine</p>
          </div>
        </div>
        <button
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600"
          onClick={() => setSelectedDate(todayLocalISO())}
          type="button"
        >
          {toDayLabel(selectedDate)}
        </button>
      </header>

      <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0f57d8] to-[#4e4ae8] p-5 text-white shadow-[0_20px_45px_rgba(20,72,210,0.24)]">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100">Daily Activity</p>
            <p className="mt-1 text-5xl font-black leading-none">
              {summary.minutes}
              <span className="ml-1 text-2xl font-semibold">min</span>
            </p>
            <p className="mt-1 text-xs text-blue-100">{summary.label}</p>
          </div>
          <div className="text-right">
            <p className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase">Live</p>
            <p className="mt-3 inline-flex items-center gap-2 text-2xl font-black">
              <Flame size={14} className="text-amber-300" />
              {summary.calories} kcal
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-blue-100">
              <Footprints size={14} />
              {summary.steps.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[#90ddf0] transition-all duration-700" style={{ width: `${summary.percent}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-blue-100">
          <span>{summary.percent}% of movement goal</span>
          <button className="rounded-full bg-white/20 px-3 py-1 font-semibold" onClick={updateMovementGoal} type="button">
            Goal {goals.movement_goal}m
          </button>
        </div>
      </article>

      <section className="mt-4 rounded-[1.7rem] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-900">Quick Burned Calories</p>
            <p className="text-xs text-slate-500">If needed, save only total workout kcal for this day.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">Optional</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            min={0}
            onChange={(event) => setManualCaloriesInput(event.target.value)}
            placeholder="e.g. 420"
            type="number"
            value={manualCaloriesInput}
          />
          <span className="text-xs font-semibold text-slate-500">kcal</span>
          <button
            className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
            onClick={saveManualCalories}
            type="button"
          >
            Save
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Set 0 and save to remove this quick total.</p>
      </section>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">Favorite Routines</h2>
          <button className="text-xs font-semibold text-blue-700" onClick={() => openCreateModal()} type="button">
            Create new
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {favoriteRoutines.map((routine) => (
            <button
              className="min-w-[9.5rem] rounded-2xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5"
              key={routine.id}
              onClick={() => openCreateModal(routine)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex rounded-xl bg-blue-50 p-2 text-blue-600">{workoutIcon(routine.workout_type)}</span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Star size={12} fill="currentColor" />
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-black text-slate-900">{routine.title}</p>
              <p className="text-[11px] text-slate-500">
                {routine.duration}m • {routine.calories_hint} kcal
              </p>
            </button>
          ))}
          {favoriteRoutines.length === 0 && <p className="rounded-2xl bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">No favorites yet. Star a routine while saving.</p>}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-2xl font-black text-slate-900">Workout Log</h3>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{toDayLabel(selectedDate)}</span>
        </div>

        <div className="space-y-3">
          {todayLogs.map((item) => (
            <div className="rounded-2xl bg-slate-50 p-3" key={item.id}>
              <button className="flex w-full items-center gap-3 text-left" onClick={() => openEditModal(item)} type="button">
                <div className="rounded-xl bg-blue-100 p-3 text-blue-700">{workoutIcon(item.workout_type)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {item.start_time} • {item.workout_type} • {item.intensity}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {item.calories_burned} kcal • {item.steps.toLocaleString()} steps
                  </p>
                </div>
                <p className="text-2xl font-black text-slate-700">{item.duration}m</p>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
              <div className="mt-2 flex items-center gap-2">
                {item.routine_id && (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Routine</span>
                )}
                <button className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600" onClick={() => removeWorkout(item.id)} type="button">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {todayLogs.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">No workout logs yet. Tap + to add one.</p>}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-blue-200 bg-[#eaf0ff] p-5">
        <div className="mb-4 inline-flex rounded-full bg-white p-3 text-amber-700 shadow-sm">
          <Sparkles size={16} />
        </div>
        <h3 className="text-2xl font-black text-slate-900">Consistency Boost</h3>
        <p className="mt-2 text-sm text-slate-700">
          You trained {consistencyDays} day(s) this week. Keep momentum and hit 5 active days.
        </p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-blue-600 transition-all duration-700" style={{ width: `${consistencyPercent}%` }} />
        </div>
        <p className="mt-2 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">{consistencyPercent}% complete</p>
      </section>

      <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Weekly Minutes</p>
        <div className="mt-3 flex h-32 items-end gap-2">
          {weeklyMinutes.map((item) => {
            const active = item.date === selectedDate;
            const height = Math.max(10, Math.round((item.total / maxWeekly) * 100));
            return (
              <button className="flex flex-1 flex-col items-center" key={item.date} onClick={() => setSelectedDate(item.date)} type="button">
                <div className="w-full rounded-t-xl bg-slate-100">
                  <div className={`w-full rounded-t-xl ${active ? "bg-blue-600" : "bg-slate-300"}`} style={{ height: `${height}px` }} />
                </div>
                <span className={`mt-2 text-[10px] font-bold ${active ? "text-blue-600" : "text-slate-500"}`}>{toDayLetter(item.date)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <button
        className="fixed bottom-28 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-white shadow-xl transition hover:scale-105 active:scale-95"
        onClick={() => openCreateModal()}
        type="button"
      >
        <Plus size={22} />
      </button>

      {editorOpen && (
        <div className="fixed inset-0 z-[84] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-black text-slate-900">{editorMode === "create" ? "Add Workout" : "Edit Workout"}</p>
                <p className="text-[11px] text-slate-500">Search exercise, set time on dial, auto-calc kcal, save routine.</p>
              </div>
              <button className="rounded-full bg-slate-100 p-2 text-slate-600" onClick={closeEditor} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[72vh] space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500" htmlFor="workout-search">
                  Exercise Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
                    id="workout-search"
                    onChange={(event) => {
                      const nextTitle = event.target.value;
                      setSearchQuery(nextTitle);
                      setDraft((prev) => ({ ...prev, title: nextTitle }));
                      setSelectedReference(null);
                    }}
                    placeholder="Search workout (run, gym, stretch, cycling...)"
                    value={searchQuery}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-bold text-slate-500">AI suggestions</p>
                  <button
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
                    onClick={() => applyEstimateByText(draft.title, draft.duration, draft.weightKg)}
                    type="button"
                  >
                    <WandSparkles size={12} /> Auto estimate
                  </button>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {searchResults.map((reference) => (
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                        selectedReference?.id === reference.id ? "bg-blue-50 ring-1 ring-blue-300" : "bg-white hover:bg-slate-100"
                      }`}
                      key={reference.id}
                      onClick={() => applyReference(reference)}
                      type="button"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {reference.emoji} {reference.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {reference.workout_type} • default {reference.defaultDuration}m
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500">MET {reference.met}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Routine shortcuts</p>
                  <p className="text-[11px] text-slate-500">Tap to load defaults</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {frequentRoutines.map((routine) => (
                    <button
                      className={`rounded-xl px-3 py-2 text-left ${selectedRoutineId === routine.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                      key={routine.id}
                      onClick={() => applyRoutine(routine)}
                      type="button"
                    >
                      <p className="text-xs font-bold">{routine.title}</p>
                      <p className={`text-[10px] ${selectedRoutineId === routine.id ? "text-blue-100" : "text-slate-500"}`}>{routine.duration}m</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Workout Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["Gym", "Walk", "Run", "Stretch", "Home", "Custom"] as WorkoutType[]).map((type) => (
                    <button
                      className={`rounded-xl px-2 py-2 text-xs font-semibold ${draft.workout_type === type ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      key={type}
                      onClick={() => setDraft((prev) => ({ ...prev, workout_type: type }))}
                      type="button"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <DurationDial value={draft.duration} onChange={onDurationChange} />

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-500">
                  Start Time
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                    onChange={(event) => setDraft((prev) => ({ ...prev, start_time: event.target.value }))}
                    type="time"
                    value={draft.start_time}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Weight (kg)
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                    max={180}
                    min={35}
                    onChange={(event) => onWeightChange(event.target.value)}
                    type="number"
                    value={draft.weightKg}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Calories Burned
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                    min={0}
                    onChange={(event) => {
                      setAutoEstimate(false);
                      setDraft((prev) => ({ ...prev, calories_burned: Math.max(0, Math.round(Number(event.target.value) || 0)) }));
                    }}
                    type="number"
                    value={draft.calories_burned}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Steps
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                    min={0}
                    onChange={(event) => {
                      setAutoEstimate(false);
                      setDraft((prev) => ({ ...prev, steps: Math.max(0, Math.round(Number(event.target.value) || 0)) }));
                    }}
                    type="number"
                    value={draft.steps}
                  />
                </label>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Intensity</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["low", "medium", "high"] as WorkoutIntensity[]).map((intensity) => (
                    <button
                      className={`rounded-xl py-2 text-xs font-semibold ${draft.intensity === intensity ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      key={intensity}
                      onClick={() => setDraft((prev) => ({ ...prev, intensity }))}
                      type="button"
                    >
                      {intensity}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <input checked={autoEstimate} onChange={(event) => setAutoEstimate(event.target.checked)} type="checkbox" />
                Keep kcal/steps synced with AI estimate
              </label>

              <div className="rounded-2xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Save Routine</p>
                  <button
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${saveRoutineFavorite ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"}`}
                    onClick={() => setSaveRoutineFavorite((prev) => !prev)}
                    type="button"
                  >
                    <Star size={14} fill={saveRoutineFavorite ? "currentColor" : "none"} />
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input checked={saveAsRoutine} onChange={(event) => setSaveAsRoutine(event.target.checked)} type="checkbox" />
                  Save this workout as reusable routine
                </label>
                {selectedRoutineId && (
                  <div className="mt-2 flex items-center gap-2">
                    <button className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600" onClick={() => toggleRoutineStar(selectedRoutineId)} type="button">
                      Toggle favorite
                    </button>
                    <button className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-600" onClick={() => removeRoutine(selectedRoutineId)} type="button">
                      Delete routine
                    </button>
                  </div>
                )}
              </div>

              <label className="text-xs font-semibold text-slate-500">
                Note (optional)
                <textarea
                  className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                  value={draft.note}
                />
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600" onClick={closeEditor} type="button">
                Cancel
              </button>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!draft.title.trim()}
                onClick={saveWorkout}
                type="button"
              >
                {editorMode === "create" ? "Add workout" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomTabs active="questions" labels={labels} />
    </section>
  );
}
