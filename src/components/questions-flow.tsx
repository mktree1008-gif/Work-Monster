"use client";

import { useMemo, useState } from "react";
import { submitCheckInAction } from "@/lib/services/actions";

const moods = ["Focused", "Steady", "Tired", "Energized"];

export function QuestionsFlow() {
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState(moods[0]);
  const [focus, setFocus] = useState("");
  const [blocker, setBlocker] = useState("");
  const [win, setWin] = useState("");
  const [calories, setCalories] = useState("500");
  const [productive, setProductive] = useState(true);
  const [taskList, setTaskList] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const progress = useMemo(() => Math.round(((step + 1) / 3) * 100), [step]);

  return (
    <div className="space-y-4">
      <div className="soft-card p-3">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Daily check-in flow</span>
          <span>{step + 1}/3</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {step === 0 && (
        <article className="card space-y-4 p-5">
          <h2 className="text-xl font-bold text-indigo-900">How do you feel today?</h2>
          <div className="grid grid-cols-2 gap-2">
            {moods.map((option) => (
              <button
                key={option}
                className={`rounded-2xl px-3 py-3 text-sm font-semibold ${mood === option ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-600"}`}
                onClick={() => setMood(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
          <label className="text-sm font-semibold text-slate-600">
            What will you focus on?
            <textarea className="input mt-2 h-24 resize-none" onChange={(e) => setFocus(e.target.value)} value={focus} />
          </label>
        </article>
      )}

      {step === 1 && (
        <article className="card space-y-4 p-5">
          <h2 className="text-xl font-bold text-indigo-900">What happened in your work today?</h2>
          <label className="text-sm font-semibold text-slate-600">
            Biggest blocker
            <textarea className="input mt-2 h-20 resize-none" onChange={(e) => setBlocker(e.target.value)} value={blocker} />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            Best win
            <textarea className="input mt-2 h-20 resize-none" onChange={(e) => setWin(e.target.value)} value={win} />
          </label>
        </article>
      )}

      {step === 2 && (
        <article className="card space-y-4 p-5">
          <h2 className="text-xl font-bold text-indigo-900">Submit your daily record</h2>
          <label className="text-sm font-semibold text-slate-600">
            Calories
            <input className="input mt-2" onChange={(e) => setCalories(e.target.value)} type="number" value={calories} />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            Task list (one task per line)
            <textarea className="input mt-2 h-24 resize-none" onChange={(e) => setTaskList(e.target.value)} value={taskList} />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            File link (optional)
            <input className="input mt-2" onChange={(e) => setFileUrl(e.target.value)} value={fileUrl} />
          </label>
          <div className="rounded-2xl bg-slate-100 p-3">
            <p className="mb-2 text-sm font-semibold">Was this day productive?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${productive ? "bg-emerald-200 text-emerald-900" : "bg-white text-slate-500"}`}
                onClick={() => setProductive(true)}
                type="button"
              >
                Yes
              </button>
              <button
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${productive ? "bg-white text-slate-500" : "bg-amber-200 text-amber-900"}`}
                onClick={() => setProductive(false)}
                type="button"
              >
                No
              </button>
            </div>
          </div>
        </article>
      )}

      <div className="flex items-center justify-between gap-2">
        <button className="btn btn-muted w-full" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} type="button">
          Back
        </button>
        {step < 2 ? (
          <button className="btn btn-primary w-full" onClick={() => setStep((s) => Math.min(2, s + 1))} type="button">
            Next
          </button>
        ) : (
          <form action={submitCheckInAction} className="w-full">
            <input name="mood" type="hidden" value={mood} />
            <input name="feeling" type="hidden" value={mood} />
            <input name="focus" type="hidden" value={focus} />
            <input name="blocker" type="hidden" value={blocker} />
            <input name="win" type="hidden" value={win} />
            <input name="calories" type="hidden" value={calories} />
            <input name="productive" type="hidden" value={productive ? "true" : "false"} />
            <input name="task_list" type="hidden" value={taskList} />
            <input name="file_url" type="hidden" value={fileUrl} />
            <button className="btn btn-primary w-full" type="submit">
              Save check-in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
