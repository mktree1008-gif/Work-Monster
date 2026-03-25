"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, ClipboardList, Plus, Sparkles } from "lucide-react";

type Priority = "low" | "medium" | "high";
type Category = "work" | "lesson" | "health" | "personal" | "mission" | "custom";

type PlannerTask = {
  id: string;
  text: string;
  category: Category;
  priority: Priority;
  estimatedMinutes: number;
  note: string;
  linkedToMission: boolean;
  completed: boolean;
  createdAt: string;
};

type Props = {
  locale: "en" | "ko";
};

const STORAGE_PREFIX = "workmonster-plan";
const ACTIVE_MISSION_KEY = "workmonster-active-mission";

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

function storageKey(dateISO: string) {
  return `${STORAGE_PREFIX}-${dateISO}`;
}

function defaultTask(): Omit<PlannerTask, "id" | "createdAt" | "completed"> {
  return {
    text: "",
    category: "work",
    priority: "medium",
    estimatedMinutes: 45,
    note: "",
    linkedToMission: false
  };
}

function templateTasks(locale: "en" | "ko") {
  if (locale === "ko") {
    return [
      { label: "Work", text: "핵심 업무 1개 완료", category: "work" as const, priority: "high" as const, estimatedMinutes: 90 },
      { label: "Lesson", text: "학습/복습 30분", category: "lesson" as const, priority: "medium" as const, estimatedMinutes: 30 },
      { label: "Health", text: "운동 30분", category: "health" as const, priority: "medium" as const, estimatedMinutes: 30 },
      { label: "Personal", text: "개인 할 일 1개 처리", category: "personal" as const, priority: "low" as const, estimatedMinutes: 20 },
      { label: "Mission", text: "매니저 미션 진행", category: "mission" as const, priority: "high" as const, estimatedMinutes: 60 }
    ];
  }

  return [
    { label: "Work", text: "Finish one core work task", category: "work" as const, priority: "high" as const, estimatedMinutes: 90 },
    { label: "Lesson", text: "30 mins lesson or review", category: "lesson" as const, priority: "medium" as const, estimatedMinutes: 30 },
    { label: "Health", text: "30 mins workout", category: "health" as const, priority: "medium" as const, estimatedMinutes: 30 },
    { label: "Personal", text: "Complete one personal errand", category: "personal" as const, priority: "low" as const, estimatedMinutes: 20 },
    { label: "Mission", text: "Progress manager mission", category: "mission" as const, priority: "high" as const, estimatedMinutes: 60 }
  ];
}

function categoryLabel(category: Category, locale: "en" | "ko") {
  const mapEn: Record<Category, string> = {
    work: "Work",
    lesson: "Lesson",
    health: "Health",
    personal: "Personal",
    mission: "Mission",
    custom: "Custom"
  };
  const mapKo: Record<Category, string> = {
    work: "업무",
    lesson: "학습",
    health: "건강",
    personal: "개인",
    mission: "미션",
    custom: "사용자"
  };
  return locale === "ko" ? mapKo[category] : mapEn[category];
}

function priorityLabel(priority: Priority, locale: "en" | "ko") {
  const mapEn: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };
  const mapKo: Record<Priority, string> = { low: "낮음", medium: "보통", high: "높음" };
  return locale === "ko" ? mapKo[priority] : mapEn[priority];
}

export function PlanDayBoard({ locale }: Props) {
  const isKo = locale === "ko";
  const [todayISO, setTodayISO] = useState(() => toLocalISODate());
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [form, setForm] = useState(defaultTask);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const today = toLocalISODate();
    setTodayISO(today);
    const raw = window.localStorage.getItem(storageKey(today));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PlannerTask[];
        setTasks(Array.isArray(parsed) ? parsed : []);
      } catch (_error) {
        setTasks([]);
      }
    } else {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey(todayISO), JSON.stringify(tasks));
  }, [tasks, todayISO]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const progressPercent = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
  const topPriorityTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => !task.completed)
        .sort((a, b) => {
          const rank = { high: 3, medium: 2, low: 1 };
          return rank[b.priority] - rank[a.priority];
        })
        .slice(0, 3),
    [tasks]
  );

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = form.text.trim();
    if (!text) return;
    const next: PlannerTask = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      text,
      category: form.category,
      priority: form.priority,
      estimatedMinutes: Math.max(5, Number(form.estimatedMinutes) || 30),
      note: form.note.trim(),
      linkedToMission: form.linkedToMission,
      completed: false,
      createdAt: new Date().toISOString()
    };
    setTasks((prev) => [next, ...prev]);
    setForm(defaultTask);
    setSaveMessage(isKo ? "Task added." : "Task added.");
  }

  function addTemplate(kind: Category) {
    const matched = templateTasks(locale).find((item) => item.category === kind);
    if (!matched) return;
    const next: PlannerTask = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      text: matched.text,
      category: matched.category,
      priority: matched.priority,
      estimatedMinutes: matched.estimatedMinutes,
      note: "",
      linkedToMission: matched.category === "mission",
      completed: false,
      createdAt: new Date().toISOString()
    };
    setTasks((prev) => [next, ...prev]);
  }

  function addFromYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const raw = window.localStorage.getItem(storageKey(toLocalISODate(yesterday)));
    if (!raw) {
      setSaveMessage(isKo ? "어제 미완료 항목이 없어요." : "No unfinished tasks from yesterday.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PlannerTask[];
      const carry = parsed.filter((task) => !task.completed);
      if (carry.length === 0) {
        setSaveMessage(isKo ? "어제 미완료 항목이 없어요." : "No unfinished tasks from yesterday.");
        return;
      }
      const now = Date.now();
      const copied = carry.map((task, index) => ({
        ...task,
        id: `carry-${now}-${index}`,
        createdAt: new Date().toISOString()
      }));
      setTasks((prev) => [...copied, ...prev]);
      setSaveMessage(isKo ? "어제 미완료 항목을 가져왔어요." : "Unfinished tasks were carried over.");
    } catch (_error) {
      setSaveMessage(isKo ? "불러오기에 실패했어요." : "Failed to carry over tasks.");
    }
  }

  function addFromMission() {
    const raw = window.localStorage.getItem(ACTIVE_MISSION_KEY);
    if (!raw) {
      setSaveMessage(isKo ? "활성 미션이 없습니다." : "No active mission found.");
      return;
    }
    try {
      const mission = JSON.parse(raw) as { title?: string; objective?: string };
      const text = mission.objective?.trim() || mission.title?.trim();
      if (!text) return;
      const next: PlannerTask = {
        id: `mission-${Date.now()}`,
        text,
        category: "mission",
        priority: "high",
        estimatedMinutes: 60,
        note: mission.title?.trim() || "",
        linkedToMission: true,
        completed: false,
        createdAt: new Date().toISOString()
      };
      setTasks((prev) => [next, ...prev]);
      setSaveMessage(isKo ? "미션이 오늘 계획에 추가됐어요." : "Mission added to your plan.");
    } catch (_error) {
      setSaveMessage(isKo ? "미션 불러오기 실패" : "Failed to load mission.");
    }
  }

  function carryUnfinishedToTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetKey = storageKey(toLocalISODate(tomorrow));
    const existingRaw = window.localStorage.getItem(targetKey);
    let existing: PlannerTask[] = [];
    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw) as PlannerTask[];
      } catch (_error) {
        existing = [];
      }
    }
    const unfinished = tasks.filter((task) => !task.completed).map((task, index) => ({
      ...task,
      id: `tomorrow-${Date.now()}-${index}`,
      createdAt: new Date().toISOString()
    }));
    window.localStorage.setItem(targetKey, JSON.stringify([...unfinished, ...existing]));
    setSaveMessage(isKo ? "미완료 항목을 내일로 넘겼어요." : "Unfinished tasks moved to tomorrow.");
  }

  function moveTask(id: string, direction: "up" | "down") {
    setTasks((prev) => {
      const index = prev.findIndex((task) => task.id === id);
      if (index < 0) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const current = copy[index];
      copy[index] = copy[target];
      copy[target] = current;
      return copy;
    });
  }

  return (
    <section className="space-y-4">
      <article className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {isKo ? "오늘 날짜" : "Today"}
            </p>
            <h2 className="mt-1 text-2xl font-black text-indigo-900">{isKo ? "Plan Your Day" : "Plan Your Day"}</h2>
          </div>
          <div className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={14} />
              {todayISO}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-100 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {isKo ? "진행 요약" : "Progress summary"}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {completedCount}/{tasks.length} {isKo ? "완료" : "completed"} ({progressPercent}%)
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-indigo-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-500">
            {isKo ? "Top 3 priorities" : "Top 3 priorities"}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-indigo-900">
            {topPriorityTasks.length > 0 ? (
              topPriorityTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between rounded-lg bg-white/70 px-2 py-1.5">
                  <span className="truncate">{task.text}</span>
                  <span className="ml-2 text-xs font-semibold text-indigo-600">{priorityLabel(task.priority, locale)}</span>
                </li>
              ))
            ) : (
              <li className="rounded-lg bg-white/70 px-2 py-1.5 text-indigo-700/80">
                {isKo ? "우선순위가 아직 없어요." : "No priorities yet."}
              </li>
            )}
          </ul>
        </div>
      </article>

      <article className="card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {isKo ? "빠른 추가 템플릿" : "Quick-add templates"}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {templateTasks(locale).map((item) => (
            <button
              className="rounded-xl bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-700"
              key={item.label}
              onClick={() => addTemplate(item.category)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn btn-muted w-full text-sm" onClick={addFromYesterday} type="button">
            {isKo ? "어제 미완료 가져오기" : "Add from yesterday"}
          </button>
          <button className="btn btn-muted w-full text-sm" onClick={addFromMission} type="button">
            {isKo ? "미션에서 추가" : "Add from mission"}
          </button>
        </div>
      </article>

      <article className="card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {isKo ? "새 할 일 추가" : "Add task"}
        </p>
        <form className="mt-3 space-y-2" onSubmit={addTask}>
          <input
            className="input"
            onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
            placeholder={isKo ? "오늘 할 일을 입력하세요" : "Write a task for today"}
            value={form.text}
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              className="input"
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as Category }))}
              value={form.category}
            >
              <option value="work">{categoryLabel("work", locale)}</option>
              <option value="lesson">{categoryLabel("lesson", locale)}</option>
              <option value="health">{categoryLabel("health", locale)}</option>
              <option value="personal">{categoryLabel("personal", locale)}</option>
              <option value="mission">{categoryLabel("mission", locale)}</option>
              <option value="custom">{categoryLabel("custom", locale)}</option>
            </select>
            <select
              className="input"
              onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as Priority }))}
              value={form.priority}
            >
              <option value="low">{priorityLabel("low", locale)}</option>
              <option value="medium">{priorityLabel("medium", locale)}</option>
              <option value="high">{priorityLabel("high", locale)}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              min={5}
              onChange={(event) => setForm((prev) => ({ ...prev, estimatedMinutes: Number(event.target.value) }))}
              placeholder={isKo ? "예상 시간(분)" : "Est. minutes"}
              type="number"
              value={form.estimatedMinutes}
            />
            <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
              <input
                checked={form.linkedToMission}
                onChange={(event) => setForm((prev) => ({ ...prev, linkedToMission: event.target.checked }))}
                type="checkbox"
              />
              {isKo ? "미션 연결" : "Mission-linked"}
            </label>
          </div>

          <textarea
            className="input min-h-20 resize-none"
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder={isKo ? "메모(선택)" : "Note (optional)"}
            value={form.note}
          />

          <button className="btn btn-primary inline-flex w-full items-center justify-center gap-2" type="submit">
            <Plus size={16} />
            {isKo ? "할 일 추가" : "Add task"}
          </button>
        </form>
      </article>

      <article className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{isKo ? "체크리스트" : "Checklist"}</p>
          <button className="text-xs font-semibold text-indigo-700" onClick={carryUnfinishedToTomorrow} type="button">
            {isKo ? "내일로 미루기" : "Carry over to tomorrow"}
          </button>
        </div>
        <div className="space-y-2">
          {tasks.length > 0 ? (
            tasks.map((task, index) => (
              <div className="rounded-xl bg-slate-100 p-3" key={task.id}>
                <div className="flex items-start gap-2">
                  <input
                    checked={task.completed}
                    onChange={(event) =>
                      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: event.target.checked } : item)))
                    }
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${task.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>{task.text}</p>
                    <p className="text-xs text-slate-500">
                      {categoryLabel(task.category, locale)} • {priorityLabel(task.priority, locale)} • {task.estimatedMinutes} min
                    </p>
                    {task.note && <p className="mt-0.5 text-xs text-slate-500">{task.note}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button className="rounded-lg bg-white p-1 text-slate-500" onClick={() => moveTask(task.id, "up")} type="button">
                      <ArrowUp size={14} />
                    </button>
                    <button className="rounded-lg bg-white p-1 text-slate-500" onClick={() => moveTask(task.id, "down")} type="button">
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
                {task.linkedToMission && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-700">
                    <Sparkles size={12} />
                    Mission-linked
                  </p>
                )}
                <div className="mt-2">
                  <button
                    className="text-xs font-semibold text-rose-600"
                    onClick={() => setTasks((prev) => prev.filter((item) => item.id !== task.id))}
                    type="button"
                  >
                    {isKo ? "삭제" : "Delete"}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  {isKo ? "순서" : "Order"} #{index + 1}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-500">
              {isKo ? "할 일이 없습니다. 위에서 추가해 보세요." : "No tasks yet. Add your first task above."}
            </p>
          )}
        </div>
      </article>

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 size={16} />
            {saveMessage}
          </span>
        </div>
      )}

      <article className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800">
        <p className="inline-flex items-center gap-2 font-semibold">
          <ClipboardList size={16} />
          {isKo ? "Plan 모드는 아침에 하루 계획을 세우는 용도입니다." : "Plan mode is for morning planning and priority setup."}
        </p>
      </article>
    </section>
  );
}

