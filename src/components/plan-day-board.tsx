"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, TouchEvent } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  CornerDownRight,
  GripVertical,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Wand2,
  Zap
} from "lucide-react";
import { getSleepSummary, getWorkoutSummary } from "@/lib/wellness-storage";

type Priority = "low" | "medium" | "high";
type Category = "work" | "health" | "study" | "personal" | "admin" | "mission" | "custom";

type PlannerTask = {
  id: string;
  user_id: string;
  title: string;
  category: Category;
  priority: Priority;
  duration: number;
  is_high_impact: boolean;
  is_completed: boolean;
  is_mission_linked: boolean;
  mission_id?: string;
  due_date?: string;
  note?: string;
  created_at: string;
};

type ActiveMission = {
  id: string;
  title: string;
  objective: string;
  startDate?: string;
  dueDate?: string;
  bonusPoints: number;
};

type QuickTaskForm = {
  title: string;
  category: Category;
  priority: Priority;
  duration: number;
  is_high_impact: boolean;
  is_mission_linked: boolean;
  due_date: string;
  note: string;
};

type Suggestion = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  kind: "mission_main" | "mission_split" | "carry_over" | "add_template";
  sourceTask?: PlannerTask;
  template?: {
    title: string;
    category: Category;
    priority: Priority;
    duration: number;
    highImpact?: boolean;
    dueDate?: string;
    note?: string;
    missionLinked?: boolean;
  };
};

type Props = {
  locale: "en" | "ko";
  userId: string;
  mission: ActiveMission | null;
  reward: {
    batteryPercent: number;
    nextRewardText: string;
  };
};

const STORAGE_PREFIX = "workmonster-plan-v2";
const LEGACY_STORAGE_PREFIX = "workmonster-plan";
const FOCUS_STORAGE_PREFIX = "workmonster-focus-v1";
const ACTIVE_MISSION_KEY = "workmonster-active-mission";
const SWIPE_REVEAL_CLASS = "-translate-x-[8.6rem]";

const CATEGORY_COLOR: Record<Category, string> = {
  work: "bg-blue-100 text-blue-700",
  health: "bg-violet-100 text-violet-700",
  study: "bg-cyan-100 text-cyan-700",
  personal: "bg-emerald-100 text-emerald-700",
  admin: "bg-slate-200 text-slate-700",
  mission: "bg-fuchsia-100 text-fuchsia-700",
  custom: "bg-amber-100 text-amber-700"
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function toLocalISODate(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(input);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function shiftISODate(baseISO: string, days: number): string {
  const d = new Date(`${baseISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function storageKey(userId: string, dateISO: string): string {
  return `${STORAGE_PREFIX}-${userId}-${dateISO}`;
}

function legacyStorageKey(dateISO: string): string {
  return `${LEGACY_STORAGE_PREFIX}-${dateISO}`;
}

function focusStorageKey(userId: string, dateISO: string): string {
  return `${FOCUS_STORAGE_PREFIX}-${userId}-${dateISO}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function createTaskId(prefix = "task"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.max(5, Math.round(value));
}

function normalizeCategory(value: unknown): Category {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "work" || raw === "health" || raw === "study" || raw === "personal" || raw === "admin" || raw === "mission" || raw === "custom") {
    return raw;
  }
  if (raw === "lesson") return "study";
  return "custom";
}

function normalizePriority(value: unknown): Priority {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "medium";
}

function normalizeTask(raw: unknown, userId: string): PlannerTask | null {
  const source = raw as Record<string, unknown>;
  const title = String(source.title ?? source.text ?? "").trim();
  if (!title) return null;

  const category = normalizeCategory(source.category);
  const priority = normalizePriority(source.priority);
  const missionLinked = Boolean(source.is_mission_linked ?? source.linkedToMission ?? category === "mission");
  const highImpact = Boolean(source.is_high_impact ?? (missionLinked || priority === "high"));

  return {
    id: String(source.id ?? createTaskId()),
    user_id: String(source.user_id ?? userId),
    title,
    category,
    priority,
    duration: clampDuration(Number(source.duration ?? source.estimatedMinutes ?? 30)),
    is_high_impact: highImpact,
    is_completed: Boolean(source.is_completed ?? source.completed),
    is_mission_linked: missionLinked,
    mission_id: typeof source.mission_id === "string" && source.mission_id.trim().length > 0 ? source.mission_id.trim() : undefined,
    due_date:
      typeof source.due_date === "string" && source.due_date.trim().length > 0
        ? source.due_date.trim()
        : typeof source.dueDate === "string" && source.dueDate.trim().length > 0
          ? source.dueDate.trim()
          : undefined,
    note: typeof source.note === "string" && source.note.trim().length > 0 ? source.note.trim() : undefined,
    created_at: typeof source.created_at === "string" ? source.created_at : typeof source.createdAt === "string" ? source.createdAt : nowISO()
  };
}

function readTasksForDate(userId: string, dateISO: string): PlannerTask[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(storageKey(userId, dateISO));
  const legacy = window.localStorage.getItem(legacyStorageKey(dateISO));
  const sourceRaw = raw ?? legacy;
  if (!sourceRaw) return [];

  try {
    const parsed = JSON.parse(sourceRaw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeTask(item, userId))
      .filter((item): item is PlannerTask => Boolean(item));
  } catch {
    return [];
  }
}

function writeTasksForDate(userId: string, dateISO: string, tasks: PlannerTask[]): void {
  if (!canUseStorage()) return;

  window.localStorage.setItem(storageKey(userId, dateISO), JSON.stringify(tasks));

  const legacyCompatible = tasks.map((task) => ({
    id: task.id,
    text: task.title,
    category: task.category,
    priority: task.priority,
    estimatedMinutes: task.duration,
    note: task.note ?? "",
    dueDate: task.due_date ?? "",
    linkedToMission: task.is_mission_linked,
    completed: task.is_completed,
    createdAt: task.created_at
  }));

  window.localStorage.setItem(legacyStorageKey(dateISO), JSON.stringify(legacyCompatible));
}

function parseLocalMission(raw: string): ActiveMission | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const title = String(parsed.title ?? "").trim();
    const objective = String(parsed.objective ?? "").trim();
    if (!title && !objective) return null;

    return {
      id: String(parsed.id ?? `mission-${title || objective}`),
      title: title || "Mission",
      objective: objective || title || "Mission objective",
      startDate: String(parsed.startDate ?? "").trim() || undefined,
      dueDate: String(parsed.deadline ?? parsed.dueDate ?? "").trim() || undefined,
      bonusPoints: Number.isFinite(Number(parsed.bonusPoints)) ? Math.max(0, Math.round(Number(parsed.bonusPoints))) : 0
    };
  } catch {
    return null;
  }
}

function formatTaskMinutes(minutes: number, locale: "en" | "ko"): string {
  if (minutes >= 60) {
    const hour = Math.floor(minutes / 60);
    const remain = minutes % 60;
    if (remain === 0) return locale === "ko" ? `${hour}시간` : `${hour}h`;
    return locale === "ko" ? `${hour}시간 ${remain}분` : `${hour}h ${remain}m`;
  }
  return locale === "ko" ? `${minutes}분` : `${minutes}m`;
}

function categoryLabel(category: Category, locale: "en" | "ko"): string {
  const labelsEn: Record<Category, string> = {
    work: "WORK",
    health: "HEALTH",
    study: "STUDY",
    personal: "PERSONAL",
    admin: "ADMIN",
    mission: "MANAGER MISSION",
    custom: "CUSTOM"
  };
  const labelsKo: Record<Category, string> = {
    work: "업무",
    health: "건강",
    study: "학습",
    personal: "개인",
    admin: "관리",
    mission: "매니저 미션",
    custom: "사용자"
  };

  return locale === "ko" ? labelsKo[category] : labelsEn[category];
}

function priorityLabel(priority: Priority, locale: "en" | "ko"): string {
  const labelsEn: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };
  const labelsKo: Record<Priority, string> = { low: "낮음", medium: "보통", high: "높음" };
  return locale === "ko" ? labelsKo[priority] : labelsEn[priority];
}

function prettyDate(dateISO: string, locale: "en" | "ko"): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
}

function formatDueDateLabel(dueDate: string, locale: "en" | "ko"): string {
  const date = new Date(`${dueDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return dueDate;
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric"
  });
}

function parseDateToISO(input?: string): string | null {
  if (!input) return null;
  const text = input.trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const currentYear = new Date().getFullYear();

  const monthDayNamed = text.match(/^([A-Za-z]{3,12})\s+(\d{1,2})$/);
  if (monthDayNamed) {
    const parsedNamed = new Date(`${monthDayNamed[1]} ${monthDayNamed[2]}, ${currentYear}`);
    if (Number.isFinite(parsedNamed.getTime())) return parsedNamed.toISOString().slice(0, 10);
  }

  const monthDayNumeric = text.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
  if (monthDayNumeric) {
    const month = Number(monthDayNumeric[1]);
    const day = Number(monthDayNumeric[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const parsedNumeric = new Date(Date.UTC(currentYear, month - 1, day));
      if (Number.isFinite(parsedNumeric.getTime())) return parsedNumeric.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

function missionDday(dueDate?: string): string {
  const dueISO = parseDateToISO(dueDate);
  if (!dueISO) return "";
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dueUTC = new Date(`${dueISO}T00:00:00.000Z`);
  if (!Number.isFinite(dueUTC.getTime())) return "";
  const diff = Math.round((dueUTC.getTime() - todayUTC.getTime()) / 86_400_000);
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function ensureMissionTask(tasks: PlannerTask[], mission: ActiveMission | null, userId: string): PlannerTask[] {
  if (!mission) return tasks;

  const hasMissionTask = tasks.some((task) => {
    if (!task.is_mission_linked) return false;
    if (task.mission_id && mission.id && task.mission_id === mission.id) return true;
    return task.title.trim().toLowerCase() === mission.objective.trim().toLowerCase();
  });

  if (hasMissionTask) return tasks;

  const missionTask: PlannerTask = {
    id: createTaskId("mission"),
    user_id: userId,
    title: mission.objective || mission.title,
    category: "mission",
    priority: "high",
    duration: 60,
    is_high_impact: true,
    is_completed: false,
    is_mission_linked: true,
    mission_id: mission.id,
    due_date: parseDateToISO(mission.dueDate ?? undefined) ?? undefined,
    note: `${mission.title}${mission.bonusPoints > 0 ? ` • +${mission.bonusPoints} pts` : ""}${mission.dueDate ? ` • ${missionDday(mission.dueDate)}` : ""}`,
    created_at: nowISO()
  };

  return [missionTask, ...tasks];
}

function defaultQuickTaskForm(): QuickTaskForm {
  return {
    title: "",
    category: "work",
    priority: "high",
    duration: 45,
    is_high_impact: true,
    is_mission_linked: false,
    due_date: "",
    note: ""
  };
}

export function PlanDayBoard({ locale, userId, mission, reward }: Props) {
  const isKo = locale === "ko";
  const [todayISO, setTodayISO] = useState(() => toLocalISODate());
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeMission, setActiveMission] = useState<ActiveMission | null>(mission);
  const [focusText, setFocusText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [focusActionState, setFocusActionState] = useState<"idle" | "saved" | "skipped">("idle");
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState<QuickTaskForm>(defaultQuickTaskForm);
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [swipedTaskId, setSwipedTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const touchStartXRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const focusActionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const today = toLocalISODate();
    setTodayISO(today);

    const loaded = readTasksForDate(userId, today);
    const localMissionRaw = canUseStorage() ? window.localStorage.getItem(ACTIVE_MISSION_KEY) : null;
    const localMission = localMissionRaw ? parseLocalMission(localMissionRaw) : null;
    const resolvedMission = localMission ?? mission;
    setActiveMission(resolvedMission);

    const mergedTasks = ensureMissionTask(loaded, resolvedMission, userId);
    setTasks(mergedTasks);

    if (canUseStorage()) {
      const storedFocus = window.localStorage.getItem(focusStorageKey(userId, today));
      setFocusText(storedFocus ?? "");
    }
    setHydrated(true);
  }, [mission, userId]);

  useEffect(() => {
    if (!hydrated) return;
    const timeoutId = window.setTimeout(() => {
      writeTasksForDate(userId, todayISO, tasks);
    }, 120);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hydrated, tasks, todayISO, userId]);

  useEffect(() => {
    if (!quickTaskOpen && !suggestionsOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [quickTaskOpen, suggestionsOpen]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (focusActionTimerRef.current) {
        window.clearTimeout(focusActionTimerRef.current);
      }
    };
  }, []);

  const sleepSummary = useMemo(
    () => getSleepSummary(todayISO),
    [todayISO]
  );
  const workoutSummary = useMemo(
    () => getWorkoutSummary(todayISO),
    [todayISO]
  );

  const yesterdayISO = useMemo(() => shiftISODate(todayISO, -1), [todayISO]);
  const yesterdayUnfinished = useMemo(
    () => readTasksForDate(userId, yesterdayISO).filter((task) => !task.is_completed),
    [userId, yesterdayISO]
  );

  const pendingTasks = useMemo(() => tasks.filter((task) => !task.is_completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.is_completed), [tasks]);
  const highImpactTasks = useMemo(
    () => pendingTasks.filter((task) => task.is_high_impact || task.priority === "high" || task.is_mission_linked),
    [pendingTasks]
  );
  const otherTasks = useMemo(
    () => pendingTasks.filter((task) => !(task.is_high_impact || task.priority === "high" || task.is_mission_linked)),
    [pendingTasks]
  );

  const progressPercent = tasks.length === 0 ? 0 : Math.round((completedTasks.length / tasks.length) * 100);
  const missionOpenTaskCount = useMemo(
    () => highImpactTasks.filter((task) => task.is_mission_linked).length,
    [highImpactTasks]
  );
  const missionDdayLabel = useMemo(() => missionDday(activeMission?.dueDate), [activeMission?.dueDate]);
  const missionMetaLabel = useMemo(() => {
    if (!activeMission) return "";
    const chunks: string[] = [];
    if (activeMission.bonusPoints > 0) chunks.push(`+${activeMission.bonusPoints} pts`);
    if (missionDdayLabel) chunks.push(missionDdayLabel);
    return chunks.join(" • ");
  }, [activeMission, missionDdayLabel]);

  const topInsight = useMemo(() => {
    const recovery = sleepSummary.recovery;
    const workloadMinutes = pendingTasks.reduce((sum, task) => sum + task.duration, 0);

    if (activeMission && missionOpenTaskCount === 0) {
      return `${isKo ? "회복" : "Recovery"} ${recovery}% — ${isKo ? "오늘 미션을 High Impact에 먼저 추가하세요." : "Add your mission to High Impact first."}`;
    }

    if (recovery < 65) {
      return `${isKo ? "회복" : "Recovery"} ${recovery}% — ${isKo ? "저강도 작업 중심으로 리듬을 유지해요." : "Low recovery: keep your plan light and focused."}`;
    }

    if (workloadMinutes > 300 || pendingTasks.length > 6) {
      return `${isKo ? "회복" : "Recovery"} ${recovery}% — ${isKo ? "Top 3 우선순위에만 집중하세요." : "Focus on your top 3 priorities today."}`;
    }

    if (workoutSummary.minutes < 20) {
      return `${isKo ? "회복" : "Recovery"} ${recovery}% — ${isKo ? "짧은 움직임 세션을 일정에 추가해보세요." : "Add a short movement block to keep momentum."}`;
    }

    return `${isKo ? "회복" : "Recovery"} ${recovery}% — ${isKo ? "핵심 작업부터 빠르게 실행해요." : "You are ready: execute your key tasks first."}`;
  }, [activeMission, isKo, missionOpenTaskCount, pendingTasks, sleepSummary.recovery, workoutSummary.minutes]);

  const previousWeekStats = useMemo(() => {
    let previousTotal = 0;
    let previousDone = 0;
    for (let i = 1; i < 7; i += 1) {
      const date = shiftISODate(todayISO, -i);
      const dayTasks = readTasksForDate(userId, date);
      previousTotal += dayTasks.length;
      previousDone += dayTasks.filter((task) => task.is_completed).length;
    }
    return { previousTotal, previousDone };
  }, [todayISO, userId]);

  const weeklyInsight = useMemo(() => {
    const total = previousWeekStats.previousTotal + tasks.length;
    const done = previousWeekStats.previousDone + completedTasks.length;
    if (total === 0) return isKo ? "최근 7일 기록이 아직 없습니다." : "No weekly baseline yet.";
    const rate = Math.round((done / total) * 100);
    return isKo ? `최근 7일 완료율 ${rate}%` : `7-day completion rate ${rate}%`;
  }, [previousWeekStats, isKo, tasks.length, completedTasks.length]);

  const quickFocusTemplates = useMemo(
    () =>
      isKo
        ? ["매니저 미션 1개 완료", "High Impact 2개 완료", "90분 집중 블록"]
        : ["Finish one manager mission", "Complete 2 high-impact tasks", "Focus block 90 mins"],
    [isKo]
  );

  function showSaveMessage(message: string, duration = 1600) {
    setSaveMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setSaveMessage("");
      toastTimerRef.current = null;
    }, duration);
  }

  function flashFocusAction(mode: "saved" | "skipped") {
    setFocusActionState(mode);
    if (focusActionTimerRef.current) window.clearTimeout(focusActionTimerRef.current);
    focusActionTimerRef.current = window.setTimeout(() => {
      setFocusActionState("idle");
      focusActionTimerRef.current = null;
    }, 1800);
  }

  const suggestions = useMemo<Suggestion[]>(() => {
    const items: Suggestion[] = [];

    if (activeMission && missionOpenTaskCount === 0) {
      items.push({
        id: "mission-main",
        title: isKo ? "미션 메인 작업 추가" : "Add mission task to High Impact",
        description: isKo
          ? `${activeMission.title} 미션을 오늘 핵심 작업에 추가합니다.`
          : `Add "${activeMission.title}" as your mission-linked high-impact task.`,
        actionLabel: isKo ? "추가" : "Add",
        kind: "mission_main"
      });
    }

    if (activeMission && missionOpenTaskCount > 0) {
      items.push({
        id: "mission-split",
        title: isKo ? "미션을 3단계로 분해" : "Split mission into 3 tasks",
        description: isKo
          ? "준비 → 실행 → 리뷰 단계로 자동 분해합니다."
          : "Convert mission objective into prep, execution, and wrap-up tasks.",
        actionLabel: isKo ? "분해" : "Split",
        kind: "mission_split"
      });
    }

    for (const task of yesterdayUnfinished.slice(0, 2)) {
      items.push({
        id: `carry-${task.id}`,
        title: isKo ? `미완료 이월: ${task.title}` : `Carry over unfinished: ${task.title}`,
        description: isKo ? "어제 미완료 작업을 오늘 계획에 복사합니다." : "Bring this unfinished task from yesterday.",
        actionLabel: isKo ? "이월" : "Carry",
        kind: "carry_over",
        sourceTask: task
      });
    }

    if (sleepSummary.recovery < 70) {
      items.push({
        id: "light-task",
        title: isKo ? "저회복 모드: 가벼운 작업 추천" : "Low recovery: add a lighter task",
        description: isKo ? "인지 부하가 낮은 20분 정리 작업을 추가합니다." : "Add a low-cognitive admin task for 20 minutes.",
        actionLabel: isKo ? "추가" : "Add",
        kind: "add_template",
        template: {
          title: isKo ? "가벼운 정리 작업 (20분)" : "Light admin cleanup (20m)",
          category: "admin",
          priority: "low",
          duration: 20,
          highImpact: false,
          note: isKo ? "저회복일용 추천" : "Suggested for low-recovery day"
        }
      });
    }

    if (workoutSummary.minutes < 20) {
      items.push({
        id: "movement",
        title: isKo ? "움직임 세션 추가" : "Add movement session",
        description: isKo ? "짧은 걷기/스트레칭으로 에너지를 유지해요." : "Keep momentum with a short walk/stretch block.",
        actionLabel: isKo ? "추가" : "Add",
        kind: "add_template",
        template: {
          title: isKo ? "20분 워크 + 스트레칭" : "20-min walk + stretch",
          category: "health",
          priority: "medium",
          duration: 20,
          highImpact: false,
          note: isKo ? "활동량 부족 자동 제안" : "Auto-suggested due to low movement"
        }
      });
    }

    if (pendingTasks.length === 0) {
      items.push({
        id: "starter",
        title: isKo ? "오늘의 시작 작업 추가" : "Add a quick starter task",
        description: isKo ? "첫 25분 집중 블록으로 하루를 시작해요." : "Start with one focused 25-minute block.",
        actionLabel: isKo ? "추가" : "Add",
        kind: "add_template",
        template: {
          title: isKo ? "핵심 작업 25분 시작" : "Start core task (25m)",
          category: "work",
          priority: "high",
          duration: 25,
          highImpact: true,
          note: isKo ? "Starter block" : "Starter block"
        }
      });
    }

    return items.slice(0, 6);
  }, [activeMission, isKo, missionOpenTaskCount, pendingTasks.length, sleepSummary.recovery, workoutSummary.minutes, yesterdayUnfinished]);

  function updateTasks(next: PlannerTask[], message?: string) {
    setTasks(next);
    if (message) {
      showSaveMessage(message, 1400);
    }
  }

  function appendTaskFromTemplate(template: NonNullable<Suggestion["template"]>) {
    const nextTask: PlannerTask = {
      id: createTaskId("task"),
      user_id: userId,
      title: template.title,
      category: template.category,
      priority: template.priority,
      duration: clampDuration(template.duration),
      is_high_impact: Boolean(template.highImpact ?? template.priority === "high"),
      is_completed: false,
      is_mission_linked: Boolean(template.missionLinked),
      mission_id: template.missionLinked ? activeMission?.id : undefined,
      due_date: parseDateToISO(template.dueDate ?? undefined) ?? undefined,
      note: template.note,
      created_at: nowISO()
    };

    const duplicate = tasks.some((task) => !task.is_completed && task.title.trim().toLowerCase() === nextTask.title.trim().toLowerCase());
    if (duplicate) {
      showSaveMessage(isKo ? "이미 비슷한 작업이 있습니다." : "A similar task already exists.");
      return;
    }

    updateTasks([nextTask, ...tasks], isKo ? "작업이 추가됐어요." : "Task added.");
  }

  function addMissionMainTask() {
    if (!activeMission) return;
    const already = tasks.some((task) => task.is_mission_linked && (task.mission_id === activeMission.id || task.title.trim() === activeMission.objective.trim()));
    if (already) {
      showSaveMessage(isKo ? "미션 작업이 이미 있습니다." : "Mission task already exists.");
      return;
    }

    const missionTask: PlannerTask = {
      id: createTaskId("mission"),
      user_id: userId,
      title: activeMission.objective || activeMission.title,
      category: "mission",
      priority: "high",
      duration: 60,
      is_high_impact: true,
      is_completed: false,
      is_mission_linked: true,
      mission_id: activeMission.id,
      due_date: parseDateToISO(activeMission.dueDate ?? undefined) ?? undefined,
      note: `${activeMission.title}${activeMission.bonusPoints > 0 ? ` • +${activeMission.bonusPoints} pts` : ""}${missionDdayLabel ? ` • ${missionDdayLabel}` : ""}`,
      created_at: nowISO()
    };

    updateTasks([missionTask, ...tasks], isKo ? "미션이 High Impact에 추가됐어요." : "Mission added to High Impact.");
  }

  function splitMissionIntoTasks() {
    if (!activeMission) return;
    const templates: Array<{ title: string; duration: number; priority: Priority; note: string }> = [
      {
        title: isKo ? `${activeMission.title} 준비` : `Prep: ${activeMission.title}`,
        duration: 20,
        priority: "medium",
        note: isKo ? "요구사항 정리" : "Clarify scope and checklist"
      },
      {
        title: activeMission.objective,
        duration: 50,
        priority: "high",
        note: isKo ? "핵심 실행" : "Core execution"
      },
      {
        title: isKo ? `${activeMission.title} 결과 정리` : `Wrap-up: ${activeMission.title}`,
        duration: 20,
        priority: "medium",
        note: isKo ? "결과/리뷰" : "Result and self-review"
      }
    ];

    const existingTitleSet = new Set(tasks.map((task) => task.title.trim().toLowerCase()));
    const generated = templates
      .filter((template) => !existingTitleSet.has(template.title.trim().toLowerCase()))
      .map((template) => ({
        id: createTaskId("mission-step"),
        user_id: userId,
        title: template.title,
        category: "mission" as const,
        priority: template.priority,
        duration: template.duration,
        is_high_impact: true,
        is_completed: false,
        is_mission_linked: true,
        mission_id: activeMission.id,
        note: template.note,
        due_date: parseDateToISO(activeMission.dueDate ?? undefined) ?? undefined,
        created_at: nowISO()
      }));

    if (generated.length === 0) {
      showSaveMessage(isKo ? "추가할 미션 하위 작업이 없습니다." : "No new mission sub-tasks to add.");
      return;
    }

    updateTasks([...generated, ...tasks], isKo ? "미션이 세부 작업으로 분해됐어요." : "Mission converted into multiple tasks.");
  }

  function applySuggestion(item: Suggestion) {
    if (item.kind === "mission_main") {
      addMissionMainTask();
      return;
    }

    if (item.kind === "mission_split") {
      splitMissionIntoTasks();
      return;
    }

    if (item.kind === "carry_over" && item.sourceTask) {
      const copied: PlannerTask = {
        ...item.sourceTask,
        id: createTaskId("carry"),
        user_id: userId,
        is_completed: false,
        created_at: nowISO()
      };
      updateTasks([copied, ...tasks], isKo ? "어제 작업을 이월했어요." : "Task carried over from yesterday.");
      return;
    }

    if (item.kind === "add_template" && item.template) {
      appendTaskFromTemplate(item.template);
    }
  }

  function openQuickTaskSheet(task?: PlannerTask) {
    if (task) {
      setEditingTaskId(task.id);
      setQuickForm({
        title: task.title,
        category: task.category === "mission" ? "work" : task.category,
        priority: task.priority,
        duration: task.duration,
        is_high_impact: task.is_high_impact,
        is_mission_linked: task.is_mission_linked,
        due_date: task.due_date ?? "",
        note: task.note ?? ""
      });
    } else {
      setEditingTaskId(null);
      setQuickForm(defaultQuickTaskForm());
    }
    setQuickTaskOpen(true);
  }

  function closeQuickTaskSheet() {
    setQuickTaskOpen(false);
    setEditingTaskId(null);
    setQuickForm(defaultQuickTaskForm());
  }

  function submitQuickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickForm.title.trim();
    if (!title) return;

    if (editingTaskId) {
      const edited = tasks.map((task) => {
        if (task.id !== editingTaskId) return task;
        return {
          ...task,
          title,
          category: quickForm.category,
          priority: quickForm.priority,
          duration: clampDuration(quickForm.duration),
          is_high_impact: quickForm.is_high_impact || quickForm.priority === "high" || quickForm.is_mission_linked,
          is_mission_linked: quickForm.is_mission_linked,
          mission_id: quickForm.is_mission_linked ? activeMission?.id : undefined,
          due_date: parseDateToISO(quickForm.due_date) ?? undefined,
          note: quickForm.note.trim() || undefined
        };
      });
      updateTasks(edited, isKo ? "작업이 수정됐어요." : "Task updated.");
      closeQuickTaskSheet();
      return;
    }

    const nextTask: PlannerTask = {
      id: createTaskId("task"),
      user_id: userId,
      title,
      category: quickForm.category,
      priority: quickForm.priority,
      duration: clampDuration(quickForm.duration),
      is_high_impact: quickForm.is_high_impact || quickForm.priority === "high" || quickForm.is_mission_linked,
      is_completed: false,
      is_mission_linked: quickForm.is_mission_linked,
      mission_id: quickForm.is_mission_linked ? activeMission?.id : undefined,
      due_date: parseDateToISO(quickForm.due_date) ?? undefined,
      note: quickForm.note.trim() || undefined,
      created_at: nowISO()
    };

    updateTasks([nextTask, ...tasks], isKo ? "작업이 추가됐어요." : "Task added.");
    closeQuickTaskSheet();
  }

  function toggleCompleted(taskId: string) {
    updateTasks(
      tasks.map((task) => (task.id === taskId ? { ...task, is_completed: !task.is_completed } : task)),
      isKo ? "체크리스트가 업데이트됐어요." : "Checklist updated."
    );
  }

  function deleteTask(taskId: string) {
    updateTasks(tasks.filter((task) => task.id !== taskId), isKo ? "작업이 삭제됐어요." : "Task deleted.");
    setSwipedTaskId(null);
  }

  function moveTaskToTomorrow(taskId: string) {
    const tomorrowISO = shiftISODate(todayISO, 1);
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;

    const tomorrowTasks = readTasksForDate(userId, tomorrowISO);
    const copied: PlannerTask = {
      ...target,
      id: createTaskId("tomorrow"),
      is_completed: false,
      created_at: nowISO()
    };

    writeTasksForDate(userId, tomorrowISO, [copied, ...tomorrowTasks]);
    updateTasks(tasks.filter((task) => task.id !== taskId), isKo ? "내일로 이동했어요." : "Moved to tomorrow.");
    setSwipedTaskId(null);
  }

  function carryForwardFromYesterday() {
    if (yesterdayUnfinished.length === 0) {
      showSaveMessage(isKo ? "어제 미완료 작업이 없어요." : "No unfinished tasks from yesterday.");
      return;
    }

    const existingSet = new Set(tasks.map((task) => task.title.trim().toLowerCase()));
    const copied = yesterdayUnfinished
      .filter((task) => !existingSet.has(task.title.trim().toLowerCase()))
      .map((task) => ({ ...task, id: createTaskId("carry"), user_id: userId, is_completed: false, created_at: nowISO() }));

    if (copied.length === 0) {
      showSaveMessage(isKo ? "이미 오늘 목록에 포함돼 있어요." : "Those tasks are already in today's plan.");
      return;
    }

    updateTasks([...copied, ...tasks], isKo ? `${copied.length}개 작업을 이월했어요.` : `Carried ${copied.length} unfinished task(s).`);
  }

  function saveFocus() {
    if (!canUseStorage()) return;
    const trimmed = focusText.trim();
    if (!trimmed) {
      window.localStorage.removeItem(focusStorageKey(userId, todayISO));
      showSaveMessage(isKo ? "오늘의 포커스를 비웠어요." : "Focus was cleared for today.");
      flashFocusAction("skipped");
      return;
    }
    window.localStorage.setItem(focusStorageKey(userId, todayISO), trimmed);
    showSaveMessage(isKo ? "오늘의 포커스를 저장했어요." : "Focus of the day saved.");
    flashFocusAction("saved");
  }

  function clearFocus() {
    setFocusText("");
    if (canUseStorage()) {
      window.localStorage.removeItem(focusStorageKey(userId, todayISO));
    }
    showSaveMessage(isKo ? "오늘은 포커스 없이 진행해요." : "Skipped focus for today.");
    flashFocusAction("skipped");
  }

  function reorderTask(dragId: string, dropId: string) {
    if (!dragId || !dropId || dragId === dropId) return;

    const sourceIndex = tasks.findIndex((task) => task.id === dragId);
    const targetIndex = tasks.findIndex((task) => task.id === dropId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const next = [...tasks];
    const [dragged] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, dragged);
    setTasks(next);
  }

  function onRowTouchStart(event: TouchEvent) {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? 0;
  }

  function onRowTouchEnd(taskId: string, event: TouchEvent) {
    const endX = event.changedTouches[0]?.clientX ?? 0;
    const diff = endX - touchStartXRef.current;
    if (diff < -40) {
      setSwipedTaskId(taskId);
      return;
    }
    if (diff > 35) {
      setSwipedTaskId(null);
    }
  }

  const sectionTitleChecklist = isKo ? "오늘의 체크리스트" : "Today's Checklist";

  return (
    <section className="space-y-5 pb-28">
      <article className="rounded-[1.6rem] border border-blue-200/70 bg-blue-50/60 px-4 py-3 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
            <Sparkles size={16} />
          </span>
          <span>
            {topInsight.split("—")[0].trim()} — <span className="font-bold text-blue-700">{topInsight.split("—").slice(1).join("—").trim()}</span>
          </span>
        </p>
      </article>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <h2 className="text-3xl font-black text-slate-900">{sectionTitleChecklist}</h2>
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <GripVertical size={13} />
              {isKo ? "드래그로 우선순위를 바꿀 수 있어요." : "Drag rows to reorder priority."}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {isKo ? "Mission = 매니저 지정, Task = 내가 직접 추가" : "Mission = manager assigned, Task = self-created"}
            </p>
            {focusText.trim().length > 0 && (
              <p className="mt-1 max-w-[20rem] truncate text-xs font-bold text-blue-700">
                {isKo ? "오늘의 포커스:" : "Today focus:"} {focusText.trim()}
              </p>
            )}
          </div>
          <button
            className="text-sm font-bold text-blue-700 hover:underline"
            onClick={() => showSaveMessage(isKo ? "개별 작업은 스와이프해서 수정할 수 있어요." : "Swipe a task row to edit quickly.")}
            type="button"
          >
            {isKo ? "리스트 편집" : "Edit List"}
          </button>
        </div>

        <article className="overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-[0_16px_40px_rgba(33,72,165,0.09)]">
          <div className="bg-blue-50/50 px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{isKo ? "핵심 임팩트" : "High Impact"}</p>
              <div className="flex items-center gap-2">
                {missionMetaLabel && (
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600">{missionMetaLabel}</span>
                )}
                {activeMission && (
                  <button
                    className="rounded-full bg-fuchsia-100 px-2 py-1 text-[11px] font-bold text-fuchsia-700"
                    onClick={addMissionMainTask}
                    type="button"
                  >
                    {isKo ? "매니저 미션 추가" : "Add manager mission"}
                  </button>
                )}
                {activeMission && missionOpenTaskCount > 0 && (
                  <button
                    className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700"
                    onClick={splitMissionIntoTasks}
                    type="button"
                  >
                    {isKo ? "매니저 미션 분해" : "Split manager mission"}
                  </button>
                )}
                <Star className="text-blue-600" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              {highImpactTasks.length > 0 ? (
                highImpactTasks.map((task) => (
                  <div className="relative overflow-hidden rounded-2xl" key={task.id}>
                    <div
                      className={`relative rounded-2xl bg-white/80 p-3 transition-transform duration-200 ${swipedTaskId === task.id ? SWIPE_REVEAL_CLASS : "translate-x-0"}`}
                      draggable
                      onDragEnd={() => setDraggingTaskId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDragStart={() => setDraggingTaskId(task.id)}
                      onDrop={() => {
                        if (!draggingTaskId) return;
                        reorderTask(draggingTaskId, task.id);
                        setDraggingTaskId(null);
                      }}
                      onTouchEnd={(event) => onRowTouchEnd(task.id, event)}
                      onTouchStart={onRowTouchStart}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 ${task.is_completed ? "border-blue-500 bg-blue-500 text-white" : "border-blue-500 text-transparent"}`}
                          onClick={() => toggleCompleted(task.id)}
                          type="button"
                        >
                          <Check size={14} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-black text-slate-900">{task.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${CATEGORY_COLOR[task.category]}`}>
                              {categoryLabel(task.category, locale)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[12px] text-slate-500">
                              <Clock3 size={12} />
                              {formatTaskMinutes(task.duration, locale)}
                            </span>
                            {task.due_date && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                <CalendarClock size={11} />
                                {isKo ? "마감" : "Due"} {formatDueDateLabel(task.due_date, locale)}
                              </span>
                            )}
                            {task.is_mission_linked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-black text-fuchsia-700">
                                <Target size={12} />
                                {isKo ? "매니저 미션" : "MANAGER MISSION"}
                              </span>
                            )}
                          </div>
                          {task.note && <p className="mt-1 text-xs text-slate-500">{task.note}</p>}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
                              onClick={() => openQuickTaskSheet(task)}
                              type="button"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition hover:bg-amber-100"
                              onClick={() => moveTaskToTomorrow(task.id)}
                              type="button"
                            >
                              <CornerDownRight size={14} />
                            </button>
                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:bg-rose-100"
                              onClick={() => deleteTask(task.id)}
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="pt-0.5 text-slate-300">
                            <GripVertical size={18} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500">
                  {isKo ? "핵심 작업이 아직 없습니다. Quick Task로 시작해보세요." : "No high-impact tasks yet. Start with Quick Task."}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 px-4 py-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">{isKo ? "기타 작업" : "Other Tasks"}</p>
              <span className="text-xs font-bold text-slate-400">{otherTasks.length}</span>
            </div>
            {otherTasks.length > 0 ? (
              otherTasks.map((task) => (
                <div className="relative overflow-hidden rounded-2xl" key={task.id}>
                  <div
                    className={`relative rounded-2xl bg-slate-50 p-3 transition-transform duration-200 ${swipedTaskId === task.id ? SWIPE_REVEAL_CLASS : "translate-x-0"}`}
                    draggable
                    onDragEnd={() => setDraggingTaskId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => setDraggingTaskId(task.id)}
                    onDrop={() => {
                      if (!draggingTaskId) return;
                      reorderTask(draggingTaskId, task.id);
                      setDraggingTaskId(null);
                    }}
                    onTouchEnd={(event) => onRowTouchEnd(task.id, event)}
                    onTouchStart={onRowTouchStart}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 ${task.is_completed ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-transparent"}`}
                        onClick={() => toggleCompleted(task.id)}
                        type="button"
                      >
                        <Check size={14} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-semibold text-slate-900">{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${CATEGORY_COLOR[task.category]}`}>
                            {categoryLabel(task.category, locale)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[12px] text-slate-500">
                            <Clock3 size={12} />
                            {formatTaskMinutes(task.duration, locale)}
                          </span>
                          {task.due_date && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                              <CalendarClock size={11} />
                              {isKo ? "마감" : "Due"} {formatDueDateLabel(task.due_date, locale)}
                            </span>
                          )}
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            {priorityLabel(task.priority, locale)}
                          </span>
                        </div>
                        {task.note && <p className="mt-1 text-xs text-slate-500">{task.note}</p>}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
                            onClick={() => openQuickTaskSheet(task)}
                            type="button"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition hover:bg-amber-100"
                            onClick={() => moveTaskToTomorrow(task.id)}
                            type="button"
                          >
                            <CornerDownRight size={14} />
                          </button>
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:bg-rose-100"
                            onClick={() => deleteTask(task.id)}
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="pt-0.5 text-slate-300">
                          <GripVertical size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                {isKo ? "다른 작업은 없습니다." : "No other tasks for today."}
              </p>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setCompletedCollapsed((prev) => !prev)}
              type="button"
            >
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {isKo ? "완료" : "Completed"}
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
                {completedTasks.length}
                {completedCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </span>
            </button>

            {!completedCollapsed && (
              <div className="mt-3 space-y-2">
                {completedTasks.length > 0 ? (
                  completedTasks.map((task) => (
                    <div className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2" key={task.id}>
                      <button
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition hover:bg-blue-200"
                        onClick={() => toggleCompleted(task.id)}
                        type="button"
                      >
                        <Check size={14} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-400 line-through">{task.title}</p>
                        {task.due_date && (
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                            {isKo ? "마감" : "Due"} {formatDueDateLabel(task.due_date, locale)}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-blue-700">{isKo ? "다시 활성화" : "Re-open"}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{isKo ? "완료 항목이 없습니다." : "No completed tasks yet."}</p>
                )}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0f57d8] via-[#1764ef] to-[#2a49cb] p-5 text-white shadow-[0_20px_45px_rgba(20,72,210,0.26)]">
        <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[clamp(2rem,8.1vw,2.7rem)] font-black leading-[1.02] tracking-tight">{isKo ? "오늘의 플랜" : "Today's Plan"}</h3>
              <p className="mt-1 text-sm font-medium text-blue-100">
                {prettyDate(todayISO, locale)} • {tasks.length} {isKo ? "Tasks" : "Tasks"}
              </p>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black">PROGRESS: {progressPercent}%</span>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mt-3 rounded-xl bg-white/10 p-2 text-xs font-semibold text-blue-50">
            {reward.nextRewardText}
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-cyan-200" style={{ width: `${Math.max(6, reward.batteryPercent)}%` }} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-sm font-black text-blue-700 shadow-[0_8px_18px_rgba(8,42,120,0.2)]"
              onClick={() => openQuickTaskSheet()}
              type="button"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Plus size={14} />
              </span>
              <span>{isKo ? "Quick Task" : "Quick Task"}</span>
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-3 py-2.5 text-sm font-black text-white"
              onClick={() => setSuggestionsOpen(true)}
              type="button"
            >
              <Wand2 size={16} />
              {isKo ? "Suggestions" : "Suggestions"}
            </button>
          </div>
        </div>
      </section>

      <section className="card rounded-[1.8rem] p-4">
        <h3 className="inline-flex items-center gap-2 text-2xl font-black text-slate-900">
          <Zap className="text-violet-600" size={18} />
          {isKo ? "오늘의 포커스" : "Focus of the Day"}
        </h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {isKo
            ? "선택 기능이에요. 오늘 가장 중요한 한 줄 목표를 적어두면 체크리스트 상단에 계속 보여줘서 우선순위를 잃지 않게 도와줘요."
            : "Optional. Add one key intention and we keep it visible above your checklist so priorities stay clear."}
        </p>
        <div className="mt-3 rounded-2xl bg-slate-100 p-3">
          <input
            className="input bg-white"
            maxLength={120}
            onChange={(event) => setFocusText(event.target.value)}
            placeholder={
              isKo
                ? "예: High Impact 2개 완료 후 미션 마감..."
                : "e.g. Finish 2 high-impact tasks before mission deadline"
            }
            value={focusText}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {quickFocusTemplates.map((template) => (
              <button
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                key={template}
                onClick={() => setFocusText(template)}
                type="button"
              >
                {template}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="btn btn-primary w-full text-sm" onClick={saveFocus} type="button">
              {focusActionState === "saved"
                ? isKo ? "저장됨 ✓" : "Saved ✓"
                : isKo ? "포커스 저장" : "Save focus"}
            </button>
            <button className="btn btn-muted w-full text-sm" onClick={clearFocus} type="button">
              {focusActionState === "skipped"
                ? isKo ? "건너뛰기 완료" : "Skipped"
                : isKo ? "건너뛰기" : "Skip today"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          className="card rounded-[1.6rem] border border-slate-200 p-4 text-left"
          onClick={carryForwardFromYesterday}
          type="button"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <ArrowUpRight size={18} />
          </span>
          <p className="mt-3 text-sm font-black uppercase tracking-wide text-slate-600">{isKo ? "Carry Forward" : "Carry Forward"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {yesterdayUnfinished.length > 0
              ? isKo
                ? `미완료 ${yesterdayUnfinished.length}개 이월하기`
                : `Carry ${yesterdayUnfinished.length} unfinished task(s)`
              : isKo
                ? "이월할 항목이 없습니다"
                : "No tasks to carry"}
          </p>
        </button>

        <Link className="card rounded-[1.6rem] border border-slate-200 p-4 text-left" href="/app/record">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <TrendingUp size={18} />
          </span>
          <p className="mt-3 text-sm font-black uppercase tracking-wide text-slate-600">{isKo ? "Insights" : "Insights"}</p>
          <p className="mt-1 text-xs text-slate-500">{weeklyInsight}</p>
        </Link>
      </section>

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {saveMessage}
        </div>
      )}

      <button
        className="fixed bottom-28 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_16px_30px_rgba(24,83,236,0.35)] transition-transform active:scale-95"
        onClick={() => openQuickTaskSheet()}
        type="button"
      >
        <Plus size={28} />
      </button>

      {quickTaskOpen && (
        <div className="fixed inset-0 z-[78] bg-slate-950/45" onClick={closeQuickTaskSheet}>
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] bg-white p-5 pb-[calc(1.3rem+env(safe-area-inset-bottom))] shadow-[0_-18px_45px_rgba(15,23,42,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />
            <h3 className="text-2xl font-black text-slate-900">
              {editingTaskId ? (isKo ? "작업 수정" : "Edit task") : (isKo ? "Quick Task" : "Quick Task")}
            </h3>

            <form className="mt-3 space-y-2" onSubmit={submitQuickTask}>
              <input
                className="input"
                onChange={(event) => setQuickForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder={isKo ? "작업 제목" : "Task title"}
                value={quickForm.title}
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  className="input"
                  onChange={(event) => setQuickForm((prev) => ({ ...prev, category: normalizeCategory(event.target.value) }))}
                  value={quickForm.category}
                >
                  <option value="work">{categoryLabel("work", locale)}</option>
                  <option value="health">{categoryLabel("health", locale)}</option>
                  <option value="study">{categoryLabel("study", locale)}</option>
                  <option value="personal">{categoryLabel("personal", locale)}</option>
                  <option value="admin">{categoryLabel("admin", locale)}</option>
                  <option value="custom">{categoryLabel("custom", locale)}</option>
                </select>

                <select
                  className="input"
                  onChange={(event) => setQuickForm((prev) => ({ ...prev, priority: normalizePriority(event.target.value) }))}
                  value={quickForm.priority}
                >
                  <option value="high">{priorityLabel("high", locale)}</option>
                  <option value="medium">{priorityLabel("medium", locale)}</option>
                  <option value="low">{priorityLabel("low", locale)}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                  {isKo ? "소요 시간 (분)" : "Duration (mins)"}
                  <input
                    className="mt-1 w-full rounded-xl border-none bg-white px-2 py-1 text-sm"
                    min={5}
                    onChange={(event) => setQuickForm((prev) => ({ ...prev, duration: clampDuration(Number(event.target.value)) }))}
                    type="number"
                    value={quickForm.duration}
                  />
                </label>

                <label className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                  {isKo ? "마감일" : "Due date"}
                  <input
                    className="mt-1 w-full rounded-xl border-none bg-white px-2 py-1 text-sm"
                    lang={isKo ? "ko-KR" : "en-US"}
                    onChange={(event) => setQuickForm((prev) => ({ ...prev, due_date: event.target.value }))}
                    placeholder="YYYY-MM-DD"
                    type="date"
                    value={quickForm.due_date}
                  />
                </label>
              </div>

              <div className="space-y-2 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                <label className="flex items-center gap-2">
                  <input
                    checked={quickForm.is_mission_linked}
                    onChange={(event) => setQuickForm((prev) => ({ ...prev, is_mission_linked: event.target.checked }))}
                    type="checkbox"
                  />
                  {isKo ? "매니저 미션 연결" : "Link to manager mission"}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    checked={quickForm.is_high_impact}
                    onChange={(event) => setQuickForm((prev) => ({ ...prev, is_high_impact: event.target.checked }))}
                    type="checkbox"
                  />
                  {isKo ? "High Impact" : "High Impact"}
                </label>
              </div>

              <textarea
                className="input min-h-20 resize-none"
                onChange={(event) => setQuickForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={isKo ? "메모 (선택)" : "Optional note"}
                value={quickForm.note}
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button className="btn btn-muted w-full" onClick={closeQuickTaskSheet} type="button">
                  {isKo ? "취소" : "Cancel"}
                </button>
                <button className="btn btn-primary w-full" type="submit">
                  {editingTaskId ? (isKo ? "수정 저장" : "Save") : (isKo ? "작업 추가" : "Add task")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {suggestionsOpen && (
        <div className="fixed inset-0 z-[79] bg-slate-950/45" onClick={() => setSuggestionsOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[82dvh] overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[calc(1.3rem+env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />
            <h3 className="text-2xl font-black text-slate-900">{isKo ? "스마트 제안" : "Smart Suggestions"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {isKo ? "미션/어제 미완료/회복/운동 상태를 기반으로 추천합니다." : "Based on mission, unfinished tasks, recovery, and movement."}
            </p>

            <div className="mt-3 space-y-2">
              {suggestions.length > 0 ? (
                suggestions.map((item) => (
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={item.id}>
                    <p className="text-sm font-black text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                    <button
                      className="mt-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                      onClick={() => applySuggestion(item)}
                      type="button"
                    >
                      {item.actionLabel}
                    </button>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-100 px-3 py-3 text-sm text-slate-500">
                  {isKo ? "현재 추가로 추천할 항목이 없습니다." : "No additional suggestions right now."}
                </p>
              )}
            </div>

            <button className="btn btn-muted mt-4 w-full" onClick={() => setSuggestionsOpen(false)} type="button">
              {isKo ? "닫기" : "Close"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
