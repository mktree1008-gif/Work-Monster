"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
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
  TriangleAlert,
  TrendingUp,
  Wand2,
  X,
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

type QuickAddRow = {
  id: string;
  title: string;
};

type QuickAddDefaults = Omit<QuickTaskForm, "title">;

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

type CompletionCelebration = {
  taskTitle: string;
  percent: number;
  done: number;
  total: number;
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
const RANGE_NOTE_REGEX = /\[(?:Range|기간):\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})\]/i;

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

function createQuickAddRow(initialTitle = ""): QuickAddRow {
  return {
    id: createTaskId("quick-row"),
    title: initialTitle
  };
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

function formatLongDateLabel(dateISO: string, locale: "en" | "ko"): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return dateISO;
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDueRangeLabel(startISO: string, endISO: string, locale: "en" | "ko"): string {
  const normalized = normalizeRange(startISO, endISO);
  if (normalized.start === normalized.end) return formatDueDateLabel(normalized.start, locale);
  return `${formatDueDateLabel(normalized.start, locale)} ${locale === "ko" ? "~" : "-"} ${formatDueDateLabel(normalized.end, locale)}`;
}

function visibleTaskNote(note?: string): string {
  if (!note) return "";
  return stripRangePrefix(note);
}

function taskDueChipLabel(task: PlannerTask, locale: "en" | "ko"): string {
  const parsedRange = parseRangeFromNote(task.note);
  if (parsedRange) return formatDueRangeLabel(parsedRange.start, parsedRange.end, locale);
  if (task.due_date) return formatDueDateLabel(task.due_date, locale);
  return "";
}

function parseRangeFromNote(note?: string): { start: string; end: string } | null {
  if (!note) return null;
  const match = note.match(RANGE_NOTE_REGEX);
  if (!match) return null;
  const start = match[1];
  const end = match[2];
  if (!parseDateToISO(start) || !parseDateToISO(end)) return null;
  return { start, end };
}

function stripRangePrefix(note: string): string {
  return note.replace(RANGE_NOTE_REGEX, "").trim();
}

function normalizeRange(startISO: string, endISO: string): { start: string; end: string } {
  if (startISO <= endISO) return { start: startISO, end: endISO };
  return { start: endISO, end: startISO };
}

function buildRangePrefix(startISO: string, endISO: string, locale: "en" | "ko"): string {
  const normalized = normalizeRange(startISO, endISO);
  if (normalized.start === normalized.end) return "";
  return locale === "ko"
    ? `[기간: ${normalized.start} ~ ${normalized.end}]`
    : `[Range: ${normalized.start} ~ ${normalized.end}]`;
}

function monthStartISO(input: Date): string {
  const d = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1));
  return d.toISOString().slice(0, 10);
}

function shiftMonthISO(monthISO: string, diff: number): string {
  const base = new Date(`${monthISO}T00:00:00.000Z`);
  if (!Number.isFinite(base.getTime())) return monthStartISO(new Date());
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + diff, 1));
  return d.toISOString().slice(0, 10);
}

function buildMonthCells(monthISO: string): Array<{ iso: string; day: number } | null> {
  const base = new Date(`${monthISO}T00:00:00.000Z`);
  if (!Number.isFinite(base.getTime())) return [];
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();

  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    cells.push({ iso, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function composeTaskNote(note: string, startISO: string | null, endISO: string | null, locale: "en" | "ko"): string | undefined {
  const baseNote = stripRangePrefix(note).trim();
  if (!startISO) return baseNote || undefined;
  const normalized = normalizeRange(startISO, endISO ?? startISO);
  const prefix = buildRangePrefix(normalized.start, normalized.end, locale);
  const merged = [prefix, baseNote].filter(Boolean).join(" ").trim();
  return merged || undefined;
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

function defaultQuickAddDefaults(): QuickAddDefaults {
  const base = defaultQuickTaskForm();
  return {
    category: base.category,
    priority: base.priority,
    duration: base.duration,
    is_high_impact: base.is_high_impact,
    is_mission_linked: base.is_mission_linked,
    due_date: base.due_date,
    note: base.note
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const [completionCelebration, setCompletionCelebration] = useState<CompletionCelebration | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState<QuickTaskForm>(defaultQuickTaskForm);
  const [quickAddRows, setQuickAddRows] = useState<QuickAddRow[]>(() => [createQuickAddRow()]);
  const [quickAddDefaults, setQuickAddDefaults] = useState<QuickAddDefaults>(defaultQuickAddDefaults);
  const [quickAddRangeStartISO, setQuickAddRangeStartISO] = useState("");
  const [quickAddRangeEndISO, setQuickAddRangeEndISO] = useState("");
  const [quickAddPickerOpen, setQuickAddPickerOpen] = useState(false);
  const [quickAddPickerMonthISO, setQuickAddPickerMonthISO] = useState(() => monthStartISO(new Date()));
  const [quickAddDraftStartISO, setQuickAddDraftStartISO] = useState("");
  const [quickAddDraftEndISO, setQuickAddDraftEndISO] = useState("");
  const [duePickerOpen, setDuePickerOpen] = useState(false);
  const [duePickerMonthISO, setDuePickerMonthISO] = useState(() => monthStartISO(new Date()));
  const [dueRangeStartISO, setDueRangeStartISO] = useState("");
  const [dueRangeEndISO, setDueRangeEndISO] = useState("");
  const [dueDraftStartISO, setDueDraftStartISO] = useState("");
  const [dueDraftEndISO, setDueDraftEndISO] = useState("");
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const focusActionTimerRef = useRef<number | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);

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
    if (!quickTaskOpen && !quickAddOpen && !suggestionsOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [quickTaskOpen, quickAddOpen, suggestionsOpen]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (focusActionTimerRef.current) {
        window.clearTimeout(focusActionTimerRef.current);
      }
      if (celebrationTimerRef.current) {
        window.clearTimeout(celebrationTimerRef.current);
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

  const yesterdayTasks = useMemo(
    () => readTasksForDate(userId, yesterdayISO),
    [userId, yesterdayISO]
  );
  const yesterdayDoneCount = useMemo(
    () => yesterdayTasks.filter((task) => task.is_completed).length,
    [yesterdayTasks]
  );
  const yesterdayCompletionPercent = useMemo(
    () => (yesterdayTasks.length > 0 ? Math.round((yesterdayDoneCount / yesterdayTasks.length) * 100) : null),
    [yesterdayDoneCount, yesterdayTasks.length]
  );
  const todayLoadMinutes = useMemo(
    () => pendingTasks.reduce((sum, task) => sum + task.duration, 0),
    [pendingTasks]
  );
  const snapshotActionLine = useMemo(() => {
    if (pendingTasks.length === 0) {
      return isKo ? "지금 Quick Add로 오늘의 첫 집중 블록을 만들어볼까요?" : "No tasks yet. Kick off your morning with Quick Add.";
    }
    if (highImpactTasks.length > 0) {
      return isKo ? "가장 중요한 High Impact 작업부터 시작해 흐름을 잡아보세요." : "Start with your top High Impact task to build momentum.";
    }
    return isKo ? "첫 번째 작업을 바로 완료해 오늘의 속도를 올려보세요." : "Complete your first task early to raise today’s pace.";
  }, [highImpactTasks.length, isKo, pendingTasks.length]);
  const snapshotPulseClass = useMemo(
    () => (pendingTasks.length === 0 ? "bg-blue-200/80" : "bg-emerald-300/80"),
    [pendingTasks.length]
  );

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

  const progressPalette = useMemo(() => {
    if (progressPercent >= 100) {
      return {
        card: "from-[#1f5cf0] via-[#5b5bf7] to-[#7c3aed]",
        bar: "from-emerald-300 via-cyan-300 to-violet-300",
        badge: "bg-violet-300/35 text-white"
      };
    }
    if (progressPercent >= 70) {
      return {
        card: "from-[#1256d6] via-[#1f6feb] to-[#06b6d4]",
        bar: "from-emerald-300 via-cyan-200 to-blue-200",
        badge: "bg-cyan-300/30 text-white"
      };
    }
    if (progressPercent >= 35) {
      return {
        card: "from-[#1d4fd9] via-[#2563eb] to-[#3b82f6]",
        bar: "from-amber-200 via-cyan-200 to-blue-200",
        badge: "bg-blue-200/30 text-white"
      };
    }
    return {
      card: "from-[#1e4cca] via-[#2158d8] to-[#2b49cb]",
      bar: "from-amber-200 via-rose-200 to-sky-200",
      badge: "bg-white/20 text-white"
    };
  }, [progressPercent]);

  const dueWeekdayLabels = isKo ? ["일", "월", "화", "수", "목", "금", "토"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dueMonthCells = useMemo(() => buildMonthCells(duePickerMonthISO), [duePickerMonthISO]);
  const dueMonthLabel = useMemo(() => {
    const parsed = new Date(`${duePickerMonthISO}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime())) return duePickerMonthISO;
    return parsed.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "long"
    });
  }, [duePickerMonthISO, locale]);
  const selectedDuePreview = useMemo(() => {
    if (!dueRangeStartISO) return isKo ? "미설정" : "Not set";
    if (!dueRangeEndISO || dueRangeStartISO === dueRangeEndISO) return formatLongDateLabel(dueRangeStartISO, locale);
    const normalized = normalizeRange(dueRangeStartISO, dueRangeEndISO);
    return `${formatLongDateLabel(normalized.start, locale)} ${isKo ? "~" : "→"} ${formatLongDateLabel(normalized.end, locale)}`;
  }, [dueRangeEndISO, dueRangeStartISO, isKo, locale]);
  const quickAddMonthCells = useMemo(() => buildMonthCells(quickAddPickerMonthISO), [quickAddPickerMonthISO]);
  const quickAddMonthLabel = useMemo(() => {
    const parsed = new Date(`${quickAddPickerMonthISO}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime())) return quickAddPickerMonthISO;
    return parsed.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "long"
    });
  }, [quickAddPickerMonthISO, locale]);
  const selectedQuickAddPreview = useMemo(() => {
    if (!quickAddRangeStartISO) return isKo ? "미설정" : "Not set";
    if (!quickAddRangeEndISO || quickAddRangeStartISO === quickAddRangeEndISO) return formatLongDateLabel(quickAddRangeStartISO, locale);
    const normalized = normalizeRange(quickAddRangeStartISO, quickAddRangeEndISO);
    return `${formatLongDateLabel(normalized.start, locale)} ${isKo ? "~" : "→"} ${formatLongDateLabel(normalized.end, locale)}`;
  }, [quickAddRangeEndISO, quickAddRangeStartISO, isKo, locale]);

  function celebrateCompletion(nextTasks: PlannerTask[], taskTitle: string) {
    const done = nextTasks.filter((task) => task.is_completed).length;
    const total = nextTasks.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    setCompletionCelebration({
      taskTitle,
      percent,
      done,
      total
    });
    if (celebrationTimerRef.current) {
      window.clearTimeout(celebrationTimerRef.current);
    }
    celebrationTimerRef.current = window.setTimeout(() => {
      setCompletionCelebration(null);
      celebrationTimerRef.current = null;
    }, 2600);
  }

  function encouragementByPercent(percent: number): string {
    if (isKo) {
      if (percent >= 100) return "완벽해요! 오늘 플랜을 모두 해냈어요.";
      if (percent >= 70) return "아주 좋아요! 마무리 페이스가 올라가고 있어요.";
      if (percent >= 35) return "좋은 흐름이에요! 계속 체크해보세요.";
      return "멋진 시작이에요! 한 칸씩 쌓아가요.";
    }
    if (percent >= 100) return "Perfect run. You completed today’s plan.";
    if (percent >= 70) return "Amazing pace. You are closing strong.";
    if (percent >= 35) return "Great momentum. Keep checking tasks off.";
    return "Strong start. Build one win at a time.";
  }

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

    return items.filter((item) => !dismissedSuggestionIds.includes(item.id)).slice(0, 6);
  }, [
    activeMission,
    dismissedSuggestionIds,
    isKo,
    missionOpenTaskCount,
    pendingTasks.length,
    sleepSummary.recovery,
    workoutSummary.minutes,
    yesterdayUnfinished
  ]);

  function dismissSuggestion(id: string) {
    setDismissedSuggestionIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function confirmSuggestionAction(item: Suggestion): boolean {
    const title = item.title.trim();
    const actionText = item.kind === "carry_over" ? (isKo ? "이월" : "Carry") : (isKo ? "추가" : "Add");
    const question = isKo
      ? `${title}\n\n${actionText} 하시겠습니까?`
      : `${title}\n\nDo you want to ${actionText.toLowerCase()} this?`;
    return window.confirm(question);
  }

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
    if (!confirmSuggestionAction(item)) return;

    if (item.kind === "mission_main") {
      addMissionMainTask();
      dismissSuggestion(item.id);
      return;
    }

    if (item.kind === "mission_split") {
      splitMissionIntoTasks();
      dismissSuggestion(item.id);
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
      dismissSuggestion(item.id);
      return;
    }

    if (item.kind === "add_template" && item.template) {
      appendTaskFromTemplate(item.template);
      dismissSuggestion(item.id);
    }
  }

  function isISOInSelectedRange(iso: string): boolean {
    if (!dueDraftStartISO || !dueDraftEndISO) return false;
    const normalized = normalizeRange(dueDraftStartISO, dueDraftEndISO);
    return iso >= normalized.start && iso <= normalized.end;
  }

  function handleDueDateCellClick(iso: string) {
    if (!dueDraftStartISO || dueDraftEndISO) {
      setDueDraftStartISO(iso);
      setDueDraftEndISO("");
      return;
    }

    if (iso === dueDraftStartISO) {
      setDueDraftEndISO(iso);
      return;
    }

    const normalized = normalizeRange(dueDraftStartISO, iso);
    setDueDraftStartISO(normalized.start);
    setDueDraftEndISO(normalized.end);
  }

  function applyDueDateSelection() {
    const start = parseDateToISO(dueDraftStartISO);
    if (!start) {
      setQuickForm((prev) => ({ ...prev, due_date: "" }));
      setDueRangeStartISO("");
      setDueRangeEndISO("");
      setDuePickerOpen(false);
      return;
    }
    const end = parseDateToISO(dueDraftEndISO) ?? start;
    const normalized = normalizeRange(start, end);
    setDueRangeStartISO(normalized.start);
    setDueRangeEndISO(normalized.end);
    setQuickForm((prev) => ({ ...prev, due_date: normalized.end }));
    setDuePickerOpen(false);
  }

  function clearDueDateSelection() {
    setDueRangeStartISO("");
    setDueRangeEndISO("");
    setDueDraftStartISO("");
    setDueDraftEndISO("");
    setQuickForm((prev) => ({ ...prev, due_date: "" }));
  }

  function toggleDuePicker() {
    if (!duePickerOpen) {
      setDueDraftStartISO(dueRangeStartISO);
      setDueDraftEndISO(dueRangeEndISO);
    }
    setDuePickerOpen((prev) => !prev);
  }

  function isISOInQuickAddSelectedRange(iso: string): boolean {
    if (!quickAddDraftStartISO || !quickAddDraftEndISO) return false;
    const normalized = normalizeRange(quickAddDraftStartISO, quickAddDraftEndISO);
    return iso >= normalized.start && iso <= normalized.end;
  }

  function handleQuickAddDateCellClick(iso: string) {
    if (!quickAddDraftStartISO || quickAddDraftEndISO) {
      setQuickAddDraftStartISO(iso);
      setQuickAddDraftEndISO("");
      return;
    }

    if (iso === quickAddDraftStartISO) {
      setQuickAddDraftEndISO(iso);
      return;
    }

    const normalized = normalizeRange(quickAddDraftStartISO, iso);
    setQuickAddDraftStartISO(normalized.start);
    setQuickAddDraftEndISO(normalized.end);
  }

  function applyQuickAddDateSelection() {
    const start = parseDateToISO(quickAddDraftStartISO);
    if (!start) {
      setQuickAddRangeStartISO("");
      setQuickAddRangeEndISO("");
      setQuickAddDefaults((prev) => ({ ...prev, due_date: "" }));
      setQuickAddPickerOpen(false);
      return;
    }
    const end = parseDateToISO(quickAddDraftEndISO) ?? start;
    const normalized = normalizeRange(start, end);
    setQuickAddRangeStartISO(normalized.start);
    setQuickAddRangeEndISO(normalized.end);
    setQuickAddDefaults((prev) => ({ ...prev, due_date: normalized.end }));
    setQuickAddPickerOpen(false);
  }

  function clearQuickAddDateSelection() {
    setQuickAddRangeStartISO("");
    setQuickAddRangeEndISO("");
    setQuickAddDraftStartISO("");
    setQuickAddDraftEndISO("");
    setQuickAddDefaults((prev) => ({ ...prev, due_date: "" }));
  }

  function toggleQuickAddPicker() {
    if (!quickAddPickerOpen) {
      setQuickAddDraftStartISO(quickAddRangeStartISO);
      setQuickAddDraftEndISO(quickAddRangeEndISO);
    }
    setQuickAddPickerOpen((prev) => !prev);
  }

  function openQuickTaskSheet(task?: PlannerTask) {
    if (task) {
      const parsedRange = parseRangeFromNote(task.note);
      const initialStart = parsedRange?.start ?? (parseDateToISO(task.due_date) ?? "");
      const initialEnd = parsedRange?.end ?? initialStart;
      setEditingTaskId(task.id);
      setQuickForm({
        title: task.title,
        category: task.category === "mission" ? "work" : task.category,
        priority: task.priority,
        duration: task.duration,
        is_high_impact: task.is_high_impact,
        is_mission_linked: task.is_mission_linked,
        due_date: parseDateToISO(task.due_date) ?? "",
        note: visibleTaskNote(task.note)
      });
      setDueRangeStartISO(initialStart);
      setDueRangeEndISO(initialEnd);
      setDueDraftStartISO(initialStart);
      setDueDraftEndISO(initialEnd);
      setDuePickerMonthISO(monthStartISO(initialStart ? new Date(`${initialStart}T00:00:00.000Z`) : new Date()));
    } else {
      setEditingTaskId(null);
      setQuickForm(defaultQuickTaskForm());
      setDueRangeStartISO("");
      setDueRangeEndISO("");
      setDueDraftStartISO("");
      setDueDraftEndISO("");
      setDuePickerMonthISO(monthStartISO(new Date()));
    }
    setDuePickerOpen(false);
    setQuickTaskOpen(true);
  }

  function closeQuickTaskSheet() {
    setQuickTaskOpen(false);
    setEditingTaskId(null);
    setQuickForm(defaultQuickTaskForm());
    setDuePickerOpen(false);
    setDueRangeStartISO("");
    setDueRangeEndISO("");
    setDueDraftStartISO("");
    setDueDraftEndISO("");
    setDuePickerMonthISO(monthStartISO(new Date()));
  }

  function openQuickAddSheet() {
    setQuickAddRows([createQuickAddRow()]);
    setQuickAddDefaults(defaultQuickAddDefaults());
    setQuickAddRangeStartISO("");
    setQuickAddRangeEndISO("");
    setQuickAddDraftStartISO("");
    setQuickAddDraftEndISO("");
    setQuickAddPickerMonthISO(monthStartISO(new Date()));
    setQuickAddPickerOpen(false);
    setQuickAddOpen(true);
  }

  function closeQuickAddSheet() {
    setQuickAddPickerOpen(false);
    setQuickAddOpen(false);
  }

  function addQuickAddRow(prefill = "") {
    setQuickAddRows((prev) => [...prev, createQuickAddRow(prefill)]);
  }

  function removeQuickAddRow(rowId: string) {
    setQuickAddRows((prev) => {
      if (prev.length <= 1) {
        return prev.map((row) => (row.id === rowId ? { ...row, title: "" } : row));
      }
      return prev.filter((row) => row.id !== rowId);
    });
  }

  function updateQuickAddRow(rowId: string, title: string) {
    setQuickAddRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, title } : row)));
  }

  function createTasksFromQuickAdd(openEditorAfterCreate: boolean) {
    const seen = new Set<string>();
    const titles = quickAddRows
      .map((row) => row.title.trim())
      .filter((title) => {
        const key = title.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (titles.length === 0) {
      showSaveMessage(isKo ? "추가할 작업 제목을 입력해 주세요." : "Add at least one task title.");
      return;
    }

    const dueStart = parseDateToISO(quickAddRangeStartISO) ?? parseDateToISO(quickAddDefaults.due_date);
    const dueEnd = parseDateToISO(quickAddRangeEndISO) ?? dueStart;
    const normalizedRange = dueStart && dueEnd ? normalizeRange(dueStart, dueEnd) : null;
    const resolvedDueDate = normalizedRange?.end ?? dueStart ?? undefined;
    const resolvedNote = composeTaskNote(quickAddDefaults.note, normalizedRange?.start ?? null, normalizedRange?.end ?? null, locale);

    const createdTasks: PlannerTask[] = titles.map((title) => ({
      id: createTaskId("quick"),
      user_id: userId,
      title,
      category: quickAddDefaults.category,
      priority: quickAddDefaults.priority,
      duration: clampDuration(quickAddDefaults.duration),
      is_high_impact: quickAddDefaults.is_high_impact || quickAddDefaults.priority === "high" || quickAddDefaults.is_mission_linked,
      is_completed: false,
      is_mission_linked: quickAddDefaults.is_mission_linked,
      mission_id: quickAddDefaults.is_mission_linked ? activeMission?.id : undefined,
      due_date: resolvedDueDate,
      note: resolvedNote,
      created_at: nowISO()
    }));

    const nextTasks = [...createdTasks, ...tasks];
    updateTasks(nextTasks, isKo ? `${createdTasks.length}개 작업을 추가했어요.` : `${createdTasks.length} tasks added.`);
    setExpandedTaskId(createdTasks[0]?.id ?? null);
    setQuickAddOpen(false);
    setQuickAddRows([createQuickAddRow()]);

    if (openEditorAfterCreate && createdTasks[0]) {
      window.setTimeout(() => {
        openQuickTaskSheet(createdTasks[0]);
      }, 80);
    }
  }

  function submitQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTasksFromQuickAdd(true);
  }

  function submitQuickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickForm.title.trim();
    if (!title) return;
    const dueStart = parseDateToISO(dueRangeStartISO) ?? parseDateToISO(quickForm.due_date);
    const dueEnd = parseDateToISO(dueRangeEndISO) ?? dueStart;
    const normalizedRange = dueStart && dueEnd ? normalizeRange(dueStart, dueEnd) : null;
    const resolvedDueDate = normalizedRange?.end ?? dueStart ?? undefined;
    const resolvedNote = composeTaskNote(quickForm.note, normalizedRange?.start ?? null, normalizedRange?.end ?? null, locale);

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
          due_date: resolvedDueDate,
          note: resolvedNote
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
      due_date: resolvedDueDate,
      note: resolvedNote,
      created_at: nowISO()
    };

    updateTasks([nextTask, ...tasks], isKo ? "작업이 추가됐어요." : "Task added.");
    closeQuickTaskSheet();
  }

  function toggleCompleted(taskId: string) {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    if (target && !target.is_completed) {
      setCompletedCollapsed(false);
    }
    const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, is_completed: !task.is_completed } : task));
    updateTasks(nextTasks, isKo ? "체크리스트가 업데이트됐어요." : "Checklist updated.");
    if (!target.is_completed) {
      celebrateCompletion(nextTasks, target.title);
    }
  }

  function deleteTask(taskId: string) {
    updateTasks(tasks.filter((task) => task.id !== taskId), isKo ? "작업이 삭제됐어요." : "Task deleted.");
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    }
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
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    }
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

  function renderActiveTaskCard(task: PlannerTask, tone: "high" | "other") {
    const isExpanded = expandedTaskId === task.id;
    const dueChip = taskDueChipLabel(task, locale);
    const cardBase =
      tone === "high"
        ? "rounded-2xl border border-blue-200/70 bg-gradient-to-r from-white to-blue-50/35 shadow-[0_10px_24px_rgba(37,99,235,0.12)]"
        : "rounded-2xl border border-slate-200 bg-slate-50/80";

    return (
      <article
        className={`${cardBase} cursor-pointer p-3 transition hover:border-blue-300`}
        draggable
        key={task.id}
        onClick={() => setExpandedTaskId((prev) => (prev === task.id ? null : task.id))}
        onDragEnd={() => setDraggingTaskId(null)}
        onDragOver={(event) => event.preventDefault()}
        onDragStart={() => setDraggingTaskId(task.id)}
        onDrop={() => {
          if (!draggingTaskId) return;
          reorderTask(draggingTaskId, task.id);
          setDraggingTaskId(null);
        }}
      >
        <div className="flex items-start gap-3">
          <button
            className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
              task.is_completed ? "border-blue-500 bg-blue-500 text-white" : "border-blue-500 text-transparent"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              toggleCompleted(task.id);
            }}
            type="button"
          >
            <Check size={14} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p className="line-clamp-2 flex-1 break-words text-[1.04rem] font-black leading-snug text-slate-900">
                {task.title}
              </p>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/95 text-slate-300 shadow-sm">
                <GripVertical size={15} />
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ${CATEGORY_COLOR[task.category]}`}>
                {categoryLabel(task.category, locale)}
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                <Clock3 size={11} />
                {formatTaskMinutes(task.duration, locale)}
              </span>
              {dueChip && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                  <CalendarClock size={11} />
                  {isKo ? "마감" : "Due"} {dueChip}
                </span>
              )}
              {task.is_mission_linked && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-black text-fuchsia-700">
                  <Target size={11} />
                  {isKo ? "매니저 미션" : "MISSION"}
                </span>
              )}
              {!task.is_mission_linked && (
                <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {priorityLabel(task.priority, locale)}
                </span>
              )}
            </div>

            {visibleTaskNote(task.note) && (
              <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{visibleTaskNote(task.note)}</p>
            )}

            <div
              className={`mt-2 grid overflow-hidden transition-all duration-300 ${
                isExpanded ? "max-h-20 grid-cols-3 gap-2 opacity-100" : "max-h-0 grid-cols-3 gap-0 opacity-0"
              }`}
            >
              <button
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                onClick={(event) => {
                  event.stopPropagation();
                  openQuickTaskSheet(task);
                }}
                type="button"
              >
                <Pencil size={13} />
                {isKo ? "수정" : "Edit"}
              </button>
              <button
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
                onClick={(event) => {
                  event.stopPropagation();
                  moveTaskToTomorrow(task.id);
                }}
                type="button"
              >
                <CornerDownRight size={13} />
                {isKo ? "내일" : "Carry"}
              </button>
              <button
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteTask(task.id);
                }}
                type="button"
              >
                <Trash2 size={13} />
                {isKo ? "삭제" : "Delete"}
              </button>
            </div>

            {!isExpanded && (
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {isKo ? "탭해서 관리하기" : "Tap to manage"}
              </p>
            )}
          </div>
        </div>
      </article>
    );
  }

  const sectionTitleChecklist = isKo ? "오늘의 체크리스트" : "Today's Checklist";
  const activeTaskCount = highImpactTasks.length + otherTasks.length;
  const celebrationPercent = completionCelebration?.percent ?? 0;
  const celebrationRadius = 42;
  const celebrationCircumference = 2 * Math.PI * celebrationRadius;
  const celebrationDashOffset = celebrationCircumference - (celebrationPercent / 100) * celebrationCircumference;

  return (
    <section className="space-y-5 pb-28">
      <article className="relative overflow-hidden rounded-[1.7rem] border border-blue-200/70 bg-gradient-to-br from-[#f8fbff] via-white to-[#eef4ff] px-4 py-4 shadow-[0_12px_30px_rgba(59,130,246,0.14)]">
        <div className={`absolute right-5 top-4 h-2.5 w-2.5 animate-pulse rounded-full ${snapshotPulseClass}`} />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
              {isKo ? "모닝 모멘텀 스냅샷" : "Momentum Snapshot"}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-700">
              {isKo ? "오늘의 속도를 만드는 아침 런치패드" : "Your morning launchpad for a focused day"}
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
            {isKo ? "플랜 모드" : "Plan Mode"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-blue-100 bg-white/85 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-500">{isKo ? "어제 완료율" : "Yesterday completion"}</p>
            <p className="mt-1 truncate whitespace-nowrap text-lg font-black text-slate-900">
              {yesterdayCompletionPercent === null ? (isKo ? "기록 없음" : "No record yet") : `${yesterdayCompletionPercent}%`}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              {yesterdayTasks.length === 0 ? "—" : `${yesterdayDoneCount}/${yesterdayTasks.length}`}
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-white/85 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-500">{isKo ? "이월 작업" : "Carry-over"}</p>
            <p className="mt-1 text-lg font-black text-slate-900">{yesterdayUnfinished.length}</p>
            <p className="text-[11px] font-semibold text-slate-500">{isKo ? "오늘로 가져올 수 있음" : "can be moved into today"}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-white/85 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-500">{isKo ? "오늘 로드" : "Today load"}</p>
            <p className="mt-1 text-lg font-black text-slate-900">{todayLoadMinutes}m</p>
            <p className="text-[11px] font-semibold text-slate-500">{activeTaskCount} {isKo ? "활성 작업" : "active tasks"}</p>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 transition-all duration-700"
            style={{ width: `${yesterdayCompletionPercent ?? 0}%` }}
          />
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
            <Sparkles size={13} />
          </span>
          <span className="min-w-0 truncate">{snapshotActionLine}</span>
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-black text-white shadow-[0_10px_20px_rgba(43,80,214,0.3)] transition hover:brightness-105 active:scale-[0.98]"
            onClick={openQuickAddSheet}
            type="button"
          >
            <Plus size={15} />
            {isKo ? "Quick Add" : "Quick Add"}
          </button>
          <button
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-black transition ${
              yesterdayUnfinished.length > 0
                ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            }`}
            disabled={yesterdayUnfinished.length === 0}
            onClick={carryForwardFromYesterday}
            type="button"
          >
            <ArrowUpRight size={15} />
            {isKo ? "Carry Forward" : "Carry Forward"}
          </button>
        </div>
      </article>

      <section>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="text-3xl font-black text-slate-900">{sectionTitleChecklist}</h2>
            <p className="mt-1 inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-slate-500">
              <GripVertical size={13} />
              {isKo ? "카드를 길게 눌러 드래그하면 우선순위를 바꿀 수 있어요." : "Long press and drag cards to reorder priority."}
            </p>
            {focusText.trim().length > 0 && (
              <p className="mt-2 inline-flex max-w-[31rem] items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-sm font-black text-white shadow-[0_10px_24px_rgba(43,80,214,0.34)] sm:text-base">
                <Zap size={15} />
                {isKo ? "오늘의 포커스:" : "Today focus:"} <span className="truncate font-black">{focusText.trim()}</span>
              </p>
            )}
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-white/95 px-2 py-2 shadow-sm">
            <span className="inline-flex h-8 items-center rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-600">
              {isKo ? "활성" : "Active"} {activeTaskCount}
            </span>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-2 text-xs font-black text-white shadow-[0_10px_20px_rgba(43,80,214,0.3)] transition hover:brightness-105 active:scale-[0.98]"
              onClick={openQuickAddSheet}
              type="button"
            >
              <Plus size={14} />
              {isKo ? "Quick Add" : "Quick Add"}
            </button>
          </div>
        </div>

        <article className="overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-[0_16px_40px_rgba(33,72,165,0.09)]">
          <div className="bg-gradient-to-br from-blue-50/70 via-white to-blue-50/50 px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="whitespace-nowrap text-xs font-black uppercase tracking-[0.18em] text-blue-700">{isKo ? "핵심 임팩트" : "High Impact"}</p>
              <div className="flex items-center gap-2">
                {missionMetaLabel && (
                  <span className="whitespace-nowrap rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600">{missionMetaLabel}</span>
                )}
                {activeMission && (
                  <button
                    className="whitespace-nowrap rounded-full bg-fuchsia-100 px-2 py-1 text-[11px] font-bold text-fuchsia-700"
                    onClick={addMissionMainTask}
                    type="button"
                  >
                    {isKo ? "매니저 미션 추가" : "Add manager mission"}
                  </button>
                )}
                {activeMission && missionOpenTaskCount > 0 && (
                  <button
                    className="whitespace-nowrap rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700"
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
                highImpactTasks.map((task) => renderActiveTaskCard(task, "high"))
              ) : (
                <p className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500">
                  {isKo ? "핵심 작업이 아직 없습니다. Quick Add로 빠르게 시작해보세요." : "No high-impact tasks yet. Start quickly with Quick Add."}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 px-4 py-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">{isKo ? "기타 작업" : "Other Tasks"}</p>
              <span className="text-xs font-bold text-slate-400">{otherTasks.length}</span>
            </div>
            {otherTasks.length > 0 ? (
              otherTasks.map((task) => renderActiveTaskCard(task, "other"))
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
                        <p className="truncate whitespace-nowrap text-sm font-semibold text-slate-400 line-through">{task.title}</p>
                        {taskDueChipLabel(task, locale) && (
                          <p className="mt-0.5 whitespace-nowrap text-[11px] font-semibold text-slate-400">
                            {isKo ? "마감" : "Due"} {taskDueChipLabel(task, locale)}
                          </p>
                        )}
                      </div>
                      <span className="whitespace-nowrap text-[10px] font-bold text-blue-700">{isKo ? "다시 활성화" : "Re-open"}</span>
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

      <section className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${progressPalette.card} p-4 text-white shadow-[0_20px_45px_rgba(20,72,210,0.26)]`}>
        <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-16 top-8 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-200/90" />
        <div className="absolute right-8 top-14 h-1.5 w-1.5 animate-pulse rounded-full bg-white/90 [animation-delay:260ms]" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="whitespace-nowrap text-[clamp(1.55rem,6.3vw,2.05rem)] font-black leading-[1.05] tracking-tight">
                {isKo ? "오늘의 플랜" : "Today's Plan"}
              </h3>
              <p className="mt-1 whitespace-nowrap text-sm font-medium text-blue-100">
                {prettyDate(todayISO, locale)} • {tasks.length} {isKo ? "Tasks" : "Tasks"}
              </p>
            </div>
            <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-black shadow-sm ${progressPalette.badge} ${progressPercent < 100 ? "animate-pulse" : ""}`}>
              PROGRESS: {progressPercent}%
            </span>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className={`relative h-full rounded-full bg-gradient-to-r ${progressPalette.bar} transition-all duration-700`}
              style={{ width: `${progressPercent}%` }}
            >
              <span className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 animate-pulse rounded-full bg-white/85 shadow-[0_0_0_3px_rgba(255,255,255,0.2)]" />
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-white/10 p-2 text-xs font-semibold text-blue-50">
            {reward.nextRewardText}
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-cyan-200" style={{ width: `${Math.max(6, reward.batteryPercent)}%` }} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-white px-3 py-2 text-sm font-black text-blue-700 shadow-[0_8px_18px_rgba(8,42,120,0.2)]"
              onClick={openQuickAddSheet}
              type="button"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Plus size={14} />
              </span>
              <span>{isKo ? "Quick Add" : "Quick Add"}</span>
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-black text-white"
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
        <p className="mt-1 text-xs font-semibold text-blue-700">
          {isKo
            ? "직접 저장한 문구가 체크리스트 상단에 강하게 고정됩니다. 오늘의 에너지를 한 줄로 선언하세요."
            : "Your saved line stays pinned at the top of checklist. Lock in your energy with one bold intention."}
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
                className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
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
          <p className="mt-1 truncate whitespace-nowrap text-xs text-slate-500">
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
          <p className="mt-3 whitespace-nowrap text-sm font-black uppercase tracking-wide text-slate-600">{isKo ? "Insights" : "Insights"}</p>
          <p className="mt-1 truncate whitespace-nowrap text-xs text-slate-500">{weeklyInsight}</p>
        </Link>
      </section>

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {saveMessage}
        </div>
      )}

      {completionCelebration && (
        <div
          className="fixed inset-0 z-[83] flex items-end justify-center bg-slate-950/20 px-4 pb-[calc(8.6rem+env(safe-area-inset-bottom))] text-left sm:items-center sm:pb-0"
          onClick={() => setCompletionCelebration(null)}
        >
          <div
            className="w-full max-w-xs rounded-[1.6rem] border border-blue-100 bg-white p-4 shadow-[0_24px_60px_rgba(29,78,216,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Image
                alt={isKo ? "응원 캐릭터" : "Cheer character"}
                className="h-14 w-14 rounded-2xl border border-blue-100 bg-blue-50 object-cover"
                height={56}
                src="/images/cheer-character.svg"
                width={56}
              />
              <div className="min-w-0">
                <p className="text-sm font-black text-blue-700">{isKo ? "잘했어요!" : "Nice work!"}</p>
                <p className="max-h-8 overflow-hidden text-xs font-semibold text-slate-600">{encouragementByPercent(completionCelebration.percent)}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <div className="relative h-24 w-24">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="none" r={celebrationRadius} stroke="rgba(148,163,184,0.22)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    fill="none"
                    r={celebrationRadius}
                    stroke="url(#celebration-progress)"
                    strokeDasharray={celebrationCircumference}
                    strokeDashoffset={celebrationDashOffset}
                    strokeLinecap="round"
                    strokeWidth="8"
                    style={{ transition: "stroke-dashoffset 620ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                  />
                  <defs>
                    <linearGradient id="celebration-progress" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="55%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xl font-black text-indigo-700">{completionCelebration.percent}%</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Progress</p>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{completionCelebration.taskTitle}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {isKo ? "완료" : "Completed"} {completionCelebration.done}/{completionCelebration.total}
                </p>
                <p className="mt-1 text-[11px] text-blue-700">{isKo ? "체크리스트를 계속 채워보세요 ✨" : "Keep stacking wins ✨"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        className="fixed bottom-28 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_16px_30px_rgba(24,83,236,0.35)] transition-transform active:scale-95"
        onClick={openQuickAddSheet}
        type="button"
      >
        <Plus size={28} />
      </button>

      {quickAddOpen && (
        <div className="fixed inset-0 z-[79] bg-slate-950/45 px-4 py-8" onClick={closeQuickAddSheet}>
          <div
            className="mx-auto max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-blue-100 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.28)] sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-2xl font-black text-slate-900">{isKo ? "Quick Add" : "Quick Add"}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {isKo
                    ? "아침 체크리스트를 빠르게 여러 개 만들고, 필요하면 바로 상세 편집까지 이어가세요."
                    : "Create multiple tasks fast, then jump to detailed editor if needed."}
                </p>
              </div>
              <button
                aria-label={isKo ? "닫기" : "Close"}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                onClick={closeQuickAddSheet}
                type="button"
              >
                <X size={14} />
              </button>
            </div>

            <form className="space-y-3" onSubmit={submitQuickAdd}>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/45 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                    {isKo ? "Task List Up" : "Task List Up"}
                  </p>
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
                    {quickAddRows.filter((row) => row.title.trim().length > 0).length} {isKo ? "입력됨" : "ready"}
                  </span>
                </div>
                <div className="space-y-2">
                  {quickAddRows.map((row, index) => (
                    <div className="flex items-center gap-2" key={row.id}>
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-blue-700 shadow-sm">
                        {index + 1}
                      </span>
                      <input
                        className="input h-11 flex-1"
                        onChange={(event) => updateQuickAddRow(row.id, event.target.value)}
                        placeholder={isKo ? "할 일을 입력하세요" : "Type a task"}
                        value={row.title}
                      />
                      <button
                        aria-label={isKo ? "행 삭제" : "Remove row"}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                        onClick={() => removeQuickAddRow(row.id)}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-100"
                    onClick={() => addQuickAddRow()}
                    type="button"
                  >
                    <Plus size={13} />
                    {isKo ? "계속 추가하기" : "Add more row"}
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-200"
                    onClick={() => {
                      closeQuickAddSheet();
                      openQuickTaskSheet();
                    }}
                    type="button"
                  >
                    <Sparkles size={12} />
                    {isKo ? "상세 편집 열기" : "Open full editor"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">
                  {isKo ? "공통 설정 (한 번에 적용)" : "Shared settings (applied to all)"}
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    className="input"
                    onChange={(event) =>
                      setQuickAddDefaults((prev) => ({ ...prev, category: normalizeCategory(event.target.value) }))
                    }
                    value={quickAddDefaults.category}
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
                    onChange={(event) =>
                      setQuickAddDefaults((prev) => ({ ...prev, priority: normalizePriority(event.target.value) }))
                    }
                    value={quickAddDefaults.priority}
                  >
                    <option value="high">{priorityLabel("high", locale)}</option>
                    <option value="medium">{priorityLabel("medium", locale)}</option>
                    <option value="low">{priorityLabel("low", locale)}</option>
                  </select>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-600">
                    {isKo ? "분" : "Mins"}
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      min={5}
                      onChange={(event) =>
                        setQuickAddDefaults((prev) => ({ ...prev, duration: clampDuration(Number(event.target.value)) }))
                      }
                      type="number"
                      value={quickAddDefaults.duration}
                    />
                  </label>
                  <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-600">
                    {isKo ? "기간 설정" : "Date range"}
                    <button
                      className="mt-1 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-sm font-semibold text-slate-700"
                      onClick={toggleQuickAddPicker}
                      type="button"
                    >
                      <span className="truncate whitespace-nowrap">{selectedQuickAddPreview}</span>
                      <CalendarClock className="shrink-0 text-blue-600" size={15} />
                    </button>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {isKo
                        ? "시작일 터치 후 종료일 터치 = 기간, 시작일만 선택 후 적용 = 당일"
                        : "Tap start then end for range. Tap one day and Apply for same-day."}
                    </p>
                  </div>
                </div>

                {quickAddPickerOpen && (
                  <div className="mt-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        aria-label={isKo ? "이전 달" : "Previous month"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 transition hover:bg-blue-100"
                        onClick={() => setQuickAddPickerMonthISO((prev) => shiftMonthISO(prev, -1))}
                        type="button"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <p className="text-sm font-black text-slate-800">{quickAddMonthLabel}</p>
                      <button
                        aria-label={isKo ? "다음 달" : "Next month"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 transition hover:bg-blue-100"
                        onClick={() => setQuickAddPickerMonthISO((prev) => shiftMonthISO(prev, 1))}
                        type="button"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {dueWeekdayLabels.map((label) => (
                        <span className="py-1 text-center text-[10px] font-black uppercase tracking-[0.08em] text-slate-500" key={`quick-add-${label}`}>
                          {label}
                        </span>
                      ))}

                      {quickAddMonthCells.map((cell, index) => {
                        if (!cell) return <span className="h-8 rounded-lg" key={`quick-add-empty-${index}`} />;
                        const isStart = quickAddDraftStartISO === cell.iso;
                        const isEnd = quickAddDraftEndISO === cell.iso;
                        const inRange = isISOInQuickAddSelectedRange(cell.iso);
                        return (
                          <button
                            className={`h-8 rounded-lg text-xs font-bold transition ${
                              isStart || isEnd
                                ? "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)]"
                                : inRange
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-white text-slate-600 hover:bg-blue-50"
                            }`}
                            key={`quick-add-date-${cell.iso}`}
                            onClick={() => handleQuickAddDateCellClick(cell.iso)}
                            type="button"
                          >
                            {cell.day}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm"
                        onClick={clearQuickAddDateSelection}
                        type="button"
                      >
                        {isKo ? "초기화" : "Clear"}
                      </button>
                      <button
                        className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!quickAddDraftStartISO}
                        onClick={applyQuickAddDateSelection}
                        type="button"
                      >
                        {isKo ? "적용" : "Apply"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                  <label className="flex items-center gap-2">
                    <input
                      checked={quickAddDefaults.is_high_impact}
                      onChange={(event) =>
                        setQuickAddDefaults((prev) => ({ ...prev, is_high_impact: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    {isKo ? "High Impact" : "High Impact"}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      checked={quickAddDefaults.is_mission_linked}
                      onChange={(event) =>
                        setQuickAddDefaults((prev) => ({ ...prev, is_mission_linked: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    {isKo ? "미션 연결" : "Mission linked"}
                  </label>
                </div>

                <textarea
                  className="input mt-2 min-h-20 resize-none"
                  onChange={(event) => setQuickAddDefaults((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder={isKo ? "공통 메모 (선택)" : "Shared note (optional)"}
                  value={quickAddDefaults.note}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  className="btn btn-primary w-full"
                  onClick={() => createTasksFromQuickAdd(false)}
                  type="button"
                >
                  {isKo ? "한 번에 생성" : "Create only"}
                </button>
                <button className="btn btn-muted w-full" type="submit">
                  {isKo ? "생성 후 검토" : "Create + Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {isKo ? "작은 한 칸씩 쌓으면 오늘 성취가 빨라져요." : "Small wins first. Build momentum with one clear action."}
            </p>
            {!editingTaskId && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">{isKo ? "추천 25분" : "Suggested 25m"}</span>
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">{isKo ? "한 줄 목표" : "Single clear goal"}</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{isKo ? "완료 우선" : "Completion first"}</span>
              </div>
            )}

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

                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                  {isKo ? "마감일" : "Due date"}
                  <button
                    className="mt-1 flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700"
                    onClick={toggleDuePicker}
                    type="button"
                  >
                    <span className="truncate whitespace-nowrap">
                      {selectedDuePreview}
                    </span>
                    <CalendarClock className="shrink-0 text-blue-600" size={15} />
                  </button>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {isKo
                      ? "시작일 터치 후 종료일 터치 = 기간, 시작일만 선택 후 적용 = 당일"
                      : "Tap start date then end date for a range. Select one date then Apply for same-day."}
                  </p>
                </div>
              </div>

              {duePickerOpen && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      aria-label={isKo ? "이전 달" : "Previous month"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 transition hover:bg-blue-100"
                      onClick={() => setDuePickerMonthISO((prev) => shiftMonthISO(prev, -1))}
                      type="button"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <p className="text-sm font-black text-slate-800">{dueMonthLabel}</p>
                    <button
                      aria-label={isKo ? "다음 달" : "Next month"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 transition hover:bg-blue-100"
                      onClick={() => setDuePickerMonthISO((prev) => shiftMonthISO(prev, 1))}
                      type="button"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {dueWeekdayLabels.map((label) => (
                      <span className="py-1 text-center text-[10px] font-black uppercase tracking-[0.08em] text-slate-500" key={label}>
                        {label}
                      </span>
                    ))}

                    {dueMonthCells.map((cell, index) => {
                      if (!cell) {
                        return <span className="h-8 rounded-lg" key={`empty-${index}`} />;
                      }
                      const isStart = dueDraftStartISO === cell.iso;
                      const isEnd = dueDraftEndISO === cell.iso;
                      const inRange = isISOInSelectedRange(cell.iso);
                      return (
                        <button
                          className={`h-8 rounded-lg text-xs font-bold transition ${isStart || isEnd
                            ? "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)]"
                            : inRange
                              ? "bg-blue-100 text-blue-700"
                              : "bg-white text-slate-600 hover:bg-blue-50"}`}
                          key={cell.iso}
                          onClick={() => handleDueDateCellClick(cell.iso)}
                          type="button"
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm"
                      onClick={clearDueDateSelection}
                      type="button"
                    >
                      {isKo ? "초기화" : "Clear"}
                    </button>
                    <button
                      className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!dueDraftStartISO}
                      onClick={applyDueDateSelection}
                      type="button"
                    >
                      {isKo ? "적용" : "Apply"}
                    </button>
                  </div>
                </div>
              )}

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
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-slate-900">{item.title}</p>
                      <button
                        aria-label={isKo ? "추천 숨기기" : "Dismiss suggestion"}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100"
                        onClick={() => dismissSuggestion(item.id)}
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        className="whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                        onClick={() => applySuggestion(item)}
                        type="button"
                      >
                        {item.actionLabel}
                      </button>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                        <TriangleAlert size={11} />
                        {isKo ? "적용 전 확인 팝업 표시" : "Shows confirm popup before action"}
                      </span>
                    </div>
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
