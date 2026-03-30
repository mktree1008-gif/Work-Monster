"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CharacterAlert } from "@/components/character-alert";
import { Locale } from "@/lib/types";

type Props = {
  locale: Locale;
  readOnly?: boolean;
};

type Check = "yes" | "partial" | "no";

const MOODS = [
  { emoji: "😞", label: "Rough" },
  { emoji: "😐", label: "Okay" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😄", label: "Great" }
] as const;

function scoreFromCheck(value: Check): number {
  if (value === "yes") return 2;
  if (value === "partial") return 1;
  return 0;
}

export function QuestionsFlow({ locale, readOnly = false }: Props) {
  const router = useRouter();
  const isKo = locale === "ko";
  const [mood, setMood] = useState<(typeof MOODS)[number]>(MOODS[2]);
  const [checklist, setChecklist] = useState<Check>("partial");
  const [food, setFood] = useState<Check>("partial");
  const [exercise, setExercise] = useState<Check>("partial");
  const [sleep, setSleep] = useState<Check>("partial");
  const [mission, setMission] = useState<Check>("partial");
  const [workedOn, setWorkedOn] = useState("");
  const [blocker, setBlocker] = useState("");
  const [carryOver, setCarryOver] = useState("");
  const [calories, setCalories] = useState<number>(0);
  const [fileUrl, setFileUrl] = useState("");
  const [clientTimeZone, setClientTimeZone] = useState("UTC");
  const [clientLocalDate, setClientLocalDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [alreadyDonePopupOpen, setAlreadyDonePopupOpen] = useState(false);
  const [alreadyDoneMessage, setAlreadyDoneMessage] = useState("");
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date());
      const year = parts.find((part) => part.type === "year")?.value;
      const month = parts.find((part) => part.type === "month")?.value;
      const day = parts.find((part) => part.type === "day")?.value;
      setClientTimeZone(timeZone);
      setClientLocalDate(year && month && day ? `${year}-${month}-${day}` : "");
    } catch (_error) {
      setClientTimeZone("UTC");
      setClientLocalDate("");
    }
  }, []);

  const completionScore = useMemo(
    () =>
      scoreFromCheck(checklist) +
      scoreFromCheck(food) +
      scoreFromCheck(exercise) +
      scoreFromCheck(sleep) +
      scoreFromCheck(mission),
    [checklist, exercise, food, mission, sleep]
  );
  const productive = completionScore >= 6;

  async function onSubmitCheckIn() {
    if (readOnly) {
      setSubmitError("Manager preview mode: check-in save is disabled.");
      return;
    }
    if (saving) return;
    if (workedOn.trim().length === 0) {
      setSubmitError("Please fill in what you worked on today.");
      return;
    }

    setSaving(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/submissions/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: mood.label,
          feeling: mood.label,
          focus: workedOn,
          blocker,
          win: carryOver,
          calories,
          productive,
          task_list: workedOn,
          file_url: fileUrl,
          client_time_zone: clientTimeZone,
          client_local_date: clientLocalDate,
          custom_answers: {
            checklist,
            food,
            exercise,
            sleep,
            mission,
            worked_on: workedOn,
            blocker,
            carry_over: carryOver
          }
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        code?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        if (response.status === 409 && payload.code === "already_submitted") {
          setAlreadyDoneMessage(
            payload.error ??
              (isKo
                ? "오늘 Daily Check-in은 이미 제출됐어요. 매니저 리뷰 결과를 확인해보세요."
                : "Today's daily check-in is already submitted. Check your manager review result.")
          );
          setAlreadyDonePopupOpen(true);
          return;
        }
        throw new Error(payload.error ?? "Failed to save check-in.");
      }

      setShowGlow(true);
      setTimeout(() => {
        router.push(payload.redirectTo ?? "/app/welcome?saved=1");
        router.refresh();
      }, 420);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Failed to save check-in.");
    } finally {
      setSaving(false);
    }
  }

  function renderCheckSelector(label: string, value: Check, onChange: (next: Check) => void) {
    return (
      <label className="text-sm font-semibold text-slate-600">
        {label}
        <select
          className="input mt-2"
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value as Check)}
          value={value}
        >
          <option value="yes">Yes</option>
          <option value="partial">Partly</option>
          <option value="no">No</option>
        </select>
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <article className="card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Daily Check-In</p>
        <h2 className="mt-1 text-2xl font-black text-indigo-900">How was your day?</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {MOODS.map((item) => (
            <button
              key={item.label}
              className={`rounded-2xl border px-2 py-3 text-center text-sm font-semibold transition ${
                mood.label === item.label ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              disabled={readOnly}
              onClick={() => setMood(item)}
              type="button"
            >
              <span className="block text-2xl">{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </article>

      <article className="card p-5">
        <h3 className="text-lg font-black text-indigo-900">Evening Reflection</h3>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {renderCheckSelector("Did you complete your checklist?", checklist, setChecklist)}
          {renderCheckSelector("How was your food/calorie intake?", food, setFood)}
          {renderCheckSelector("Did you get some exercise?", exercise, setExercise)}
          {renderCheckSelector("Did you get enough sleep/recovery?", sleep, setSleep)}
          {renderCheckSelector("Did you complete your mission?", mission, setMission)}
          <label className="text-sm font-semibold text-slate-600">
            What did you work on today?
            <textarea
              className="input mt-2 h-24 resize-none"
              disabled={readOnly}
              onChange={(event) => setWorkedOn(event.target.value)}
              placeholder="Write the important work, study, outputs, and wins."
              value={workedOn}
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            What got in the way?
            <textarea
              className="input mt-2 h-20 resize-none"
              disabled={readOnly}
              onChange={(event) => setBlocker(event.target.value)}
              placeholder="Blockers, distractions, constraints."
              value={blocker}
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            What should carry over to tomorrow?
            <textarea
              className="input mt-2 h-20 resize-none"
              disabled={readOnly}
              onChange={(event) => setCarryOver(event.target.value)}
              placeholder="Tasks or intentions to carry over."
              value={carryOver}
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            Calories today (optional)
            <input
              className="input mt-2"
              disabled={readOnly}
              min={0}
              onChange={(event) => setCalories(Number(event.target.value))}
              type="number"
              value={Number.isFinite(calories) ? calories : 0}
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            File link (optional)
            <input
              className="input mt-2"
              disabled={readOnly}
              onChange={(event) => setFileUrl(event.target.value)}
              placeholder="https://..."
              value={fileUrl}
            />
          </label>
        </div>
      </article>

      <article className={`card p-4 transition ${showGlow ? "ring-2 ring-emerald-300 bg-emerald-50" : ""}`}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Check-in Summary</p>
        <p className="mt-1 text-sm text-slate-700">Mood: {mood.emoji} {mood.label}</p>
        <p className="text-sm text-slate-700">Completion score: {completionScore}/10</p>
        <p className={`text-sm font-semibold ${productive ? "text-emerald-700" : "text-amber-700"}`}>
          {productive ? "Productive day detected" : "Recovery day detected"}
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          Date auto-sync: {clientLocalDate || "syncing..."} ({clientTimeZone})
        </p>
      </article>

      {submitError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {submitError}
        </div>
      )}

      <button
        className="btn btn-energetic w-full"
        disabled={saving || readOnly}
        onClick={onSubmitCheckIn}
        type="button"
      >
        {saving ? "Saving..." : "Submit Daily Check-In"}
      </button>

      {alreadyDonePopupOpen && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <CharacterAlert
            compact
            cue={{
              spriteName: "manager_curious",
              expression: "wide-eyes",
              emoji: "🗓️",
              title: "Already submitted",
              message: alreadyDoneMessage
            }}
            role="manager"
            tone="warning"
          />
          <button className="btn btn-muted mt-3 w-full" onClick={() => setAlreadyDonePopupOpen(false)} type="button">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
