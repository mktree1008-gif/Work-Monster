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
  Flame,
  Mail,
  MoonStar,
  Plus,
  Sparkles,
  Target,
  Utensils,
  Zap
} from "lucide-react";
import { BottomTabs } from "@/components/bottom-tabs";
import {
  getFocusSessions,
  getFoodSummary,
  getSleepSummary,
  getWorkoutSummary,
  todayLocalISO
} from "@/lib/wellness-storage";

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
  checkinState: "none" | "draft" | "submitted" | "in_review" | "approved" | "rejected" | "needs_revision";
  labels: {
    questions: string;
    record: string;
    rewards: string;
    score: string;
    rules: string;
  };
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
const HOME_MODE_KEY = "wm-home-mode";

type HomeMode = "productivity" | "wellness";

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
  } catch {
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
    } catch {
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

function statusBadgeText(checkinState: Props["checkinState"]): string {
  if (checkinState === "submitted") return "Submitted to manager";
  if (checkinState === "in_review") return "In review";
  if (checkinState === "approved") return "Approved";
  if (checkinState === "rejected") return "Rejected";
  if (checkinState === "needs_revision") return "Needs revision";
  if (checkinState === "draft") return "Draft saved";
  return "Not started";
}

export function WelcomeDashboardClient({ mission, checkinState, labels, score, reward }: Props) {
  const router = useRouter();
  const [localTrigger, setLocalTrigger] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [missionAccepted, setMissionAccepted] = useState(false);
  const [mode, setMode] = useState<HomeMode>("productivity");
  const [fabOpen, setFabOpen] = useState(false);
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

    const savedMode = window.localStorage.getItem(HOME_MODE_KEY);
    if (savedMode === "productivity" || savedMode === "wellness") {
      setMode(savedMode);
    }

    const raw = window.localStorage.getItem(ACTIVE_MISSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { id?: string; title?: string };
      const matchedById = mission.id && parsed.id && mission.id === parsed.id;
      const matchedByTitle = mission.title.trim().length > 0 && mission.title.trim() === String(parsed.title ?? "").trim();
      setMissionAccepted(Boolean(matchedById || matchedByTitle));
    } catch {
      setMissionAccepted(false);
    }
  }, [mission.id, mission.title]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(HOME_MODE_KEY, mode);
  }, [mounted, mode]);

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

  function closeFab() {
    setFabOpen(false);
  }

  return (
    <section className="pb-32">
      <section className="card card-standard mb-4 p-1.5">
        <div className="grid grid-cols-2 gap-1">
          <button
            className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
              mode === "productivity" ? "bg-blue-700 text-white shadow-sm" : "bg-transparent text-slate-600"
            }`}
            onClick={() => setMode("productivity")}
            type="button"
          >
            Productivity
          </button>
          <button
            className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
              mode === "wellness" ? "bg-blue-700 text-white shadow-sm" : "bg-transparent text-slate-600"
            }`}
            onClick={() => setMode("wellness")}
            type="button"
          >
            Wellness
          </button>
        </div>
      </section>

      {mode === "productivity" ? (
        <>
          <section className="card card-hero mb-4 overflow-hidden bg-gradient-to-br from-[#0f57d8] to-[#264ba1] p-5 text-white shadow-[0_20px_45px_rgba(20,72,210,0.24)]">
            <p className="text-caption uppercase tracking-[0.16em] text-blue-100">Plan Your Day</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[clamp(2rem,10vw,2.9rem)] font-black leading-[0.98]">Start Planning</h2>
                <p className="mt-2 text-sm text-blue-100">
                  {planCount > 0 ? `${planCount} checklist items ready.` : "Set top priorities and build your checklist."}
                </p>
                <Link className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-700" href="/app/plan">
                  <ClipboardList size={15} />
                  Open planner
                </Link>
              </div>
              <div className="relative mt-1 h-20 w-20 shrink-0 rounded-3xl bg-white/15 p-3">
                <Mail className={`h-7 w-7 ${mission.hasMission ? "anim-bounce-soft text-amber-200" : "text-blue-100"}`} />
                <Sparkles className="absolute right-3 top-3 h-4 w-4 text-amber-200" />
              </div>
            </div>
          </section>

          <section className={`card card-standard mb-4 p-4 ${mission.hasMission ? "ring-1 ring-blue-200" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-caption font-bold uppercase tracking-[0.16em] text-blue-700">Mission from Manager</p>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
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
            <h3 className="mt-2 text-card-title font-black text-slate-900">{mission.title}</h3>
            <p className="mt-2 text-body-compact text-slate-600">{mission.objective}</p>
            <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
              <CalendarClock size={12} />
              Deadline: {mission.deadline}
              {mission.hasMission && missionDday !== "Flexible deadline" && (
                <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">{missionDday}</span>
              )}
              {mission.bonusPoints > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                  +{mission.bonusPoints} pts
                </span>
              )}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
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
                Add to plan
              </button>
            </div>
          </section>

          <section className="card card-standard mb-4 p-4">
            <p className="text-caption font-bold uppercase tracking-[0.16em] text-blue-700">Current Momentum</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-[clamp(1.8rem,8.6vw,2.35rem)] font-black leading-none text-slate-900">{score.totalPoints}</p>
                <p className="mt-1 text-sm text-slate-600">{score.streak}-day streak • Lifetime {score.lifetimePoints} pts</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${score.inRisk ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {score.inRisk ? "Risk" : "Safe"}
              </span>
            </div>
            <div className="mt-3 rounded-2xl bg-slate-100 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <BatteryCharging size={14} /> Reward battery
                </span>
                <span>{reward.batteryPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8de1ff] via-[#4d78ff] to-[#5a45d8] transition-all duration-700"
                  style={{ width: `${Math.max(8, reward.batteryPercent)}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">{reward.nextRewardText}</p>
              {score.multiplierActive && (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                  <Sparkles size={12} /> {score.multiplierValue.toFixed(1)}x multiplier active
                </p>
              )}
            </div>
          </section>

          <section className="card card-standard mb-4 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-card-title font-black text-slate-900">Daily Check-in</h3>
                <p className="mt-1 text-sm text-slate-600">Guided 7-step reflection with manager review.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">{statusBadgeText(checkinState)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">💭 State</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">🎯 Execution</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">⚡ Productivity</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">🧾 Summary</span>
            </div>
            <Link className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white" href="/app/questions/check-in">
              Start check-in
            </Link>
            {checkinState !== "none" && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                <CheckCircle2 size={12} />
                {checkinState === "submitted"
                  ? "Submitted. Waiting review."
                  : checkinState === "approved"
                    ? "Approved by manager."
                    : checkinState === "rejected"
                      ? "Rejected by manager."
                      : checkinState === "needs_revision"
                        ? "Needs revision before resubmit."
                        : checkinState === "in_review"
                          ? "Manager is reviewing now."
                          : "Draft is saved."}
              </p>
            )}
          </section>

          {focusSessions.length > 0 && (
            <section className="card card-standard p-4">
              <p className="text-caption font-bold uppercase tracking-[0.16em] text-slate-500">Quick Productivity Insight</p>
              <p className="mt-2 text-sm text-slate-700">
                {focusSessions.length} focus session(s) today. Longest block: {Math.max(...focusSessions.map((session) => session.minutes))}m.
              </p>
              <Link className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white" href="/app/record">
                View analytics
              </Link>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="card card-hero mb-4 bg-gradient-to-br from-[#0f57d8] to-[#2c4fa7] p-5 text-white shadow-[0_20px_45px_rgba(20,72,210,0.24)]">
            <h3 className="text-[clamp(1.9rem,9.2vw,2.55rem)] font-black leading-none">Today&apos;s Energy</h3>
            <p className="mt-2 text-sm text-blue-100">Your recovery context supports productivity. Keep the rhythm steady.</p>
          </section>

          <section className="space-y-3">
            <Link className="card card-standard block p-4" href="/app/food" onClick={refreshLiveCards}>
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><Utensils className="text-amber-600" size={15} /> Food</p>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Consumed</span>
              </div>
              <p className="mt-2 text-[clamp(1.45rem,7.1vw,1.95rem)] font-black text-slate-900">{food.calories} kcal</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-amber-700" style={{ width: `${food.percent}%` }} />
              </div>
            </Link>

            <Link className="card card-standard block p-4" href="/app/workout" onClick={refreshLiveCards}>
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><Dumbbell className="text-blue-600" size={15} /> Workout</p>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">Active</span>
              </div>
              <p className="mt-2 text-[clamp(1.45rem,7.1vw,1.95rem)] font-black text-slate-900">{workout.minutes} mins</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${workout.percent}%` }} />
              </div>
            </Link>

            <Link className="card card-standard block p-4" href="/app/sleep" onClick={refreshLiveCards}>
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><MoonStar className="text-indigo-600" size={15} /> Sleep</p>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">Recovery</span>
              </div>
              <p className="mt-2 text-[clamp(1.45rem,7.1vw,1.95rem)] font-black text-slate-900">{sleep.recovery}%</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-slate-700" style={{ width: `${sleep.recovery}%` }} />
              </div>
            </Link>
          </section>

          <section className="card card-standard mt-4 p-4">
            <p className="text-caption font-bold uppercase tracking-[0.16em] text-slate-500">Wellness Insight</p>
            <p className="mt-2 text-sm text-slate-700">
              {sleep.recovery >= 80
                ? "Recovery is strong. Great day for high-impact work blocks."
                : "Recovery is moderate. Keep sessions short and focused for better consistency."}
            </p>
          </section>
        </>
      )}

      <div className="fixed bottom-[6.6rem] right-5 z-40">
        {fabOpen && (
          <div className="anim-pop mb-2 w-52 space-y-2 rounded-2xl border border-indigo-100 bg-white/95 p-2 shadow-xl backdrop-blur">
            <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/app/plan" onClick={closeFab}>
              <Plus size={14} /> Add Task
            </Link>
            <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/app/food" onClick={closeFab}>
              <Utensils size={14} /> Log Food
            </Link>
            <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/app/workout" onClick={closeFab}>
              <Dumbbell size={14} /> Log Workout
            </Link>
            <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/app/sleep" onClick={closeFab}>
              <MoonStar size={14} /> Log Sleep
            </Link>
            <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/app/questions/check-in" onClick={closeFab}>
              <Target size={14} /> Start Check-in
            </Link>
          </div>
        )}
        <button
          aria-label="Quick actions"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-[0_16px_28px_rgba(37,99,235,0.35)] transition hover:scale-105 active:scale-95"
          onClick={() => setFabOpen((prev) => !prev)}
          type="button"
        >
          {fabOpen ? <Flame size={20} /> : <Zap size={20} />}
        </button>
      </div>
      <BottomTabs active="questions" labels={labels} />
    </section>
  );
}
