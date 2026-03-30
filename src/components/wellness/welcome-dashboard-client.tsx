"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BatteryCharging,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Mail,
  MoonStar,
  Sparkles,
  Target,
  Utensils
} from "lucide-react";
import {
  getFocusSessions,
  getFoodSummary,
  getSleepSummary,
  getWorkoutSummary,
  todayLocalISO
} from "@/lib/wellness-storage";
import { WellnessBottomNav } from "@/components/wellness-bottom-nav";

type MissionCard = {
  id: string;
  hasMission: boolean;
  isNew: boolean;
  title: string;
  objective: string;
  startDate: string;
  deadline: string;
  bonusPoints: number;
  statusLabel: string;
};

type Props = {
  mission: MissionCard;
  checkinState: "none" | "pending" | "reviewed";
  score: {
    totalPoints: number;
    streak: number;
    lifetimePoints: number;
    multiplierActive: boolean;
    multiplierValue: number;
    inRisk: boolean;
  };
  reward: {
    batteryPercent: number;
    nextRewardText: string;
  };
};

const PLAN_STORAGE_PREFIX = "workmonster-plan";
const ACTIVE_MISSION_KEY = "workmonster-active-mission";

type PlanStorageTask = {
  id: string;
  text: string;
  category: "work" | "lesson" | "health" | "personal" | "mission" | "custom";
  priority: "low" | "medium" | "high";
  estimatedMinutes: number;
  note: string;
  linkedToMission: boolean;
  completed: boolean;
  createdAt: string;
};

function todayPlanCount() {
  if (typeof window === "undefined") return 0;
  const key = `${PLAN_STORAGE_PREFIX}-${todayLocalISO()}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as Array<{ id: string }>;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (_error) {
    return 0;
  }
}

function todayPlanStorageKey() {
  return `${PLAN_STORAGE_PREFIX}-${todayLocalISO()}`;
}

function parseISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

function missionDdayLabel(deadline: string): string {
  const due = parseISODate(deadline);
  if (!due) return "Flexible deadline";
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diff = Math.round((due.getTime() - todayUTC.getTime()) / 86_400_000);
  if (diff < 0) return `D+${Math.abs(diff)}`;
  if (diff === 0) return "D-Day";
  return `D-${diff}`;
}

function addMissionTaskToToday(mission: MissionCard) {
  const missionText = mission.objective.trim() || mission.title.trim();
  if (!missionText) return;
  const key = todayPlanStorageKey();
  const raw = window.localStorage.getItem(key);
  let currentTasks: PlanStorageTask[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PlanStorageTask[];
      currentTasks = Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      currentTasks = [];
    }
  }

  const alreadyExists = currentTasks.some((task) => {
    return task.linkedToMission && task.text.trim().toLowerCase() === missionText.toLowerCase();
  });
  if (alreadyExists) return;

  const missionTask: PlanStorageTask = {
    id: `mission-${Date.now()}`,
    text: missionText,
    category: "mission",
    priority: "high",
    estimatedMinutes: 60,
    note: `${mission.title} (${missionDdayLabel(mission.deadline)})`,
    linkedToMission: true,
    completed: false,
    createdAt: new Date().toISOString()
  };

  window.localStorage.setItem(key, JSON.stringify([missionTask, ...currentTasks]));
}

export function WelcomeDashboardClient({ mission, checkinState, score, reward }: Props) {
  const router = useRouter();
  const [localTrigger, setLocalTrigger] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [missionAccepted, setMissionAccepted] = useState(false);
  const today = todayLocalISO();
  const planCount = useMemo(() => (mounted ? todayPlanCount() : 0), [localTrigger, mounted]);
  const food = useMemo(
    () =>
      mounted
        ? getFoodSummary(today)
        : { calories: 0, protein: 0, waterCups: 0, goal: 2100, remaining: 2100, percent: 0 },
    [localTrigger, mounted, today]
  );
  const workout = useMemo(
    () =>
      mounted
        ? getWorkoutSummary(today)
        : { minutes: 0, calories: 0, steps: 0, type: "No workout", percent: 0, goal: 60 },
    [localTrigger, mounted, today]
  );
  const sleep = useMemo(
    () =>
      mounted
        ? getSleepSummary(today)
        : { totalMinutes: 0, recovery: 0, quality: "Medium", percent: 0, goalMinutes: 480, latest: null },
    [localTrigger, mounted, today]
  );
  const focusSessions = useMemo(
    () => (mounted ? getFocusSessions().filter((item) => item.date === today) : []),
    [localTrigger, mounted, today]
  );
  const missionDday = missionDdayLabel(mission.deadline);

  useEffect(() => {
    setMounted(true);
    setLocalTrigger((prev) => prev + 1);
    const raw = window.localStorage.getItem(ACTIVE_MISSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { id?: string; title?: string };
      const matchedById = mission.id && parsed.id && mission.id === parsed.id;
      const matchedByTitle = mission.title.trim().length > 0 && mission.title.trim() === String(parsed.title ?? "").trim();
      setMissionAccepted(Boolean(matchedById || matchedByTitle));
    } catch (_error) {
      setMissionAccepted(false);
    }
  }, [mission.id, mission.title]);

  function refreshLiveCards() {
    setLocalTrigger((prev) => prev + 1);
  }

  function addMissionToPlan() {
    if (!mission.hasMission) {
      router.push("/app/plan");
      return;
    }
    if (!mounted) return;
    addMissionTaskToToday(mission);
    window.localStorage.setItem(
      ACTIVE_MISSION_KEY,
      JSON.stringify({
        id: mission.id,
        title: mission.title,
        objective: mission.objective,
        startDate: mission.startDate,
        deadline: mission.deadline,
        bonusPoints: mission.bonusPoints,
        acceptedAt: new Date().toISOString(),
        savedAt: new Date().toISOString()
      })
    );
    setMissionAccepted(true);
    setLocalTrigger((prev) => prev + 1);
    router.push("/app/plan");
  }

  return (
    <section className="pb-32">
      <section className="mb-4 rounded-[2rem] bg-gradient-to-br from-[#0f57d8] to-[#264ba1] p-6 text-white shadow-[0_20px_45px_rgba(20,72,210,0.24)]">
        <p className="text-sm uppercase tracking-[0.12em] text-blue-100">Plan Your Day</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-5xl font-black leading-none">Start Planning</h2>
            <p className="mt-2 text-blue-100">
              {planCount > 0
                ? `${planCount} checklist items ready for today.`
                : "Set top priorities and build your checklist."}
            </p>
            <Link className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-700" href="/app/plan">
              <ClipboardList size={16} />
              Start Planning
            </Link>
          </div>
          <div className="relative mt-1 h-24 w-24 rounded-3xl bg-white/15 p-3">
            <Mail className={`h-8 w-8 ${mission.hasMission ? "anim-bounce-soft text-amber-200" : "text-blue-100"}`} />
            <Sparkles className="absolute right-3 top-3 h-4 w-4 text-amber-200" />
          </div>
        </div>
      </section>

      <section className={`mb-4 rounded-[1.8rem] bg-white p-5 shadow-sm ${mission.hasMission ? "ring-1 ring-blue-200" : ""}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Mission from Manager</p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              mission.hasMission
                ? missionAccepted
                  ? "bg-blue-100 text-blue-700"
                  : mission.isNew
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {missionAccepted && mission.hasMission ? "Accepted" : mission.statusLabel}
          </span>
        </div>
        <h3 className="mt-2 text-3xl font-black text-slate-900">{mission.title}</h3>
        <p className="mt-2 text-sm text-slate-600">{mission.objective}</p>
        <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
          <CalendarClock size={12} />
          Deadline: {mission.deadline}
          {mission.hasMission && missionDday !== "Flexible deadline" && (
            <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              {missionDday}
            </span>
          )}
          {mission.bonusPoints > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              +{mission.bonusPoints} pts
            </span>
          )}
        </p>
        <div className="mt-3 grid grid-cols-[0.92fr_1.08fr] gap-2">
          <Link
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-slate-100 px-3 py-2 text-center text-sm font-bold text-slate-700"
            href="/app/mission"
          >
            Open mission
          </Link>
          <button
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-center text-[13px] font-black text-white shadow-[0_10px_22px_rgba(37,99,235,0.34)]"
            onClick={addMissionToPlan}
            type="button"
          >
            <Target size={14} />
            Add mission to plan
          </button>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-3 gap-2">
        <Link className="rounded-[1.4rem] bg-white p-3 shadow-sm" href="/app/food" onClick={refreshLiveCards}>
          <p className="inline-flex items-center gap-1 text-sm font-bold text-slate-900">
            <Utensils className="text-amber-600" size={14} />
            Food
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">{food.calories}</p>
          <p className="text-xs text-slate-500">cal logged</p>
        </Link>
        <Link className="rounded-[1.4rem] bg-white p-3 shadow-sm" href="/app/workout" onClick={refreshLiveCards}>
          <p className="inline-flex items-center gap-1 text-sm font-bold text-slate-900">
            <Dumbbell className="text-blue-600" size={14} />
            Workout
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">{workout.minutes}</p>
          <p className="text-xs text-slate-500">mins logged</p>
        </Link>
        <Link className="rounded-[1.4rem] bg-white p-3 shadow-sm" href="/app/sleep" onClick={refreshLiveCards}>
          <p className="inline-flex items-center gap-1 text-sm font-bold text-slate-900">
            <MoonStar className="text-indigo-600" size={14} />
            Sleep
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">{sleep.recovery}</p>
          <p className="text-xs text-slate-500">% recovery</p>
        </Link>
      </section>

      <section className="mb-4 rounded-[1.8rem] bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Current Momentum</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-6xl font-black leading-none text-slate-900">{score.totalPoints}</p>
            <p className="mt-1 text-sm text-slate-600">
              {score.streak}-day streak • Lifetime {score.lifetimePoints} pts
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${score.inRisk ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
            {score.inRisk ? "Risk Zone" : "Safe Zone"}
          </span>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-100 p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <BatteryCharging size={14} />
              Reward battery
            </span>
            <span>{reward.batteryPercent}%</span>
          </div>
          <div className="mt-2 h-8 overflow-hidden rounded-full border border-blue-200 bg-white p-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8de1ff] via-[#4d78ff] to-[#5a45d8] transition-all duration-700"
              style={{ width: `${Math.max(8, reward.batteryPercent)}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-bold text-slate-900">{reward.nextRewardText}</p>
          {score.multiplierActive && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
              <Sparkles size={12} />
              {score.multiplierValue.toFixed(1)}x multiplier active
            </p>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-[1.8rem] bg-white p-5 shadow-sm">
        <h3 className="text-3xl font-black text-slate-900">Daily Check-In</h3>
        <p className="mt-2 text-sm text-slate-600">How was your day? 🙂 😌 😊 😄</p>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li>Did you complete your checklist?</li>
          <li>How was your food/calorie intake?</li>
          <li>Did you get some exercise?</li>
          <li>Did you get enough sleep/recovery?</li>
        </ul>
        <Link className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white" href="/app/questions/check-in">
          Start Check-In
        </Link>
        {checkinState !== "none" && (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            <CheckCircle2 size={12} />
            {checkinState === "pending" ? "Submitted. Pending manager review." : "Submitted and reviewed."}
          </p>
        )}
      </section>

      <section className="mb-6 rounded-[2rem] bg-gradient-to-br from-[#0f57d8] to-[#2c4fa7] p-6 text-white shadow-[0_20px_45px_rgba(20,72,210,0.24)]">
        <h3 className="text-6xl font-black leading-none">Today&apos;s Energy</h3>
        <p className="mt-2 max-w-sm text-xl text-blue-100">
          You&apos;re hitting peak performance today. Keep the kinetic momentum going.
        </p>
      </section>

      <section className="space-y-4">
        <article className="rounded-[1.8rem] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Daily Intake</p>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Consumed</span>
          </div>
          <p className="mt-2 text-6xl font-black text-slate-900">{food.calories} kcal</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-amber-700" style={{ width: `${food.percent}%` }} />
          </div>
        </article>
        <article className="rounded-[1.8rem] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Movement</p>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">Active</span>
          </div>
          <p className="mt-2 text-6xl font-black text-slate-900">{workout.minutes} mins</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${workout.percent}%` }} />
          </div>
        </article>
        <article className="rounded-[1.8rem] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Vitality</p>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">Recovery</span>
          </div>
          <p className="mt-2 text-6xl font-black text-slate-900">{sleep.recovery}%</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-slate-700" style={{ width: `${sleep.recovery}%` }} />
          </div>
        </article>
      </section>

      <section className="mt-8">
        <h3 className="text-5xl font-black text-slate-900">Focus Sessions</h3>
        <div className="mt-3 space-y-2">
          {focusSessions.map((session) => (
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm" key={session.id}>
              <p className="flex items-center justify-between text-lg font-semibold text-slate-800">
                <span className="inline-flex items-center gap-2">
                  <Target className="text-blue-600" size={15} />
                  {session.label}
                </span>
                <span className="text-sm text-slate-500">{Math.floor(session.minutes / 60)}h {session.minutes % 60}m</span>
              </p>
            </div>
          ))}
        </div>
        <Link className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-800 px-4 py-3 text-lg font-bold text-white" href="/app/record">
          View Full Analytics →
        </Link>
      </section>

      <section className="mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#298b8e] to-[#0e4a4e] p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Recommended for you</p>
        <h3 className="mt-1 text-5xl font-black">Core Velocity Training</h3>
        <div className="mt-3 flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/20 px-3 py-1">Intermediate</span>
          <span className="rounded-full bg-white/20 px-3 py-1">20 mins</span>
        </div>
      </section>

      <WellnessBottomNav active="food" />
    </section>
  );
}
