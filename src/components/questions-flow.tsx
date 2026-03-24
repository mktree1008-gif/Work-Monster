"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CharacterAlert } from "@/components/character-alert";
import { ChibiAvatar } from "@/components/chibi-avatar";
import { getManagerCue, getUserCue } from "@/lib/character-system";
import { Locale } from "@/lib/types";

type Props = {
  locale: Locale;
  glasses?: boolean;
};

type ChoiceKey = "A" | "B" | "C";

type Option = {
  key: ChoiceKey;
  label: string;
  emoji: string;
  mood: string;
  productive: boolean;
};

type StepDefinition = {
  id: "q1" | "q2" | "q3";
  title: string;
  help: string;
  options: [Option, Option, Option];
};

type StepState = {
  choice: ChoiceKey | "CUSTOM" | "";
  customText: string;
};

const stepDefinitions: StepDefinition[] = [
  {
    id: "q1",
    title: "Q1. How do you feel right now?",
    help: "Pick A/B/C quickly, or add your own answer.",
    options: [
      {
        key: "A",
        label: "Focused and ready to execute",
        emoji: "😎",
        mood: "Focused",
        productive: true
      },
      {
        key: "B",
        label: "Steady but low energy",
        emoji: "🙂",
        mood: "Steady",
        productive: true
      },
      {
        key: "C",
        label: "Overwhelmed and distracted",
        emoji: "😵",
        mood: "Tired",
        productive: false
      }
    ]
  },
  {
    id: "q2",
    title: "Q2. How was your work progress?",
    help: "Select your closest result for today.",
    options: [
      {
        key: "A",
        label: "Major progress with clear output",
        emoji: "🚀",
        mood: "Focused",
        productive: true
      },
      {
        key: "B",
        label: "Some progress, still in progress",
        emoji: "👍",
        mood: "Steady",
        productive: true
      },
      {
        key: "C",
        label: "Blocked and behind schedule",
        emoji: "😓",
        mood: "Tired",
        productive: false
      }
    ]
  },
  {
    id: "q3",
    title: "Q3. What do you need next?",
    help: "Choose your next move before submitting.",
    options: [
      {
        key: "A",
        label: "Deep focus sprint",
        emoji: "🔥",
        mood: "Focused",
        productive: true
      },
      {
        key: "B",
        label: "Short reset and continue",
        emoji: "🧘",
        mood: "Steady",
        productive: true
      },
      {
        key: "C",
        label: "Need feedback or help",
        emoji: "🆘",
        mood: "Tired",
        productive: false
      }
    ]
  }
];

function initialSteps(): StepState[] {
  return stepDefinitions.map(() => ({ choice: "", customText: "" }));
}

function hasAnswer(state: StepState): boolean {
  if (state.choice === "CUSTOM") {
    return state.customText.trim().length > 0;
  }
  return state.choice !== "";
}

function selectedOption(stepIndex: number, state: StepState): Option | null {
  if (state.choice === "CUSTOM" || state.choice === "") {
    return null;
  }
  return stepDefinitions[stepIndex].options.find((item) => item.key === state.choice) ?? null;
}

function answerLabel(stepIndex: number, state: StepState): string {
  if (state.choice === "CUSTOM") {
    return state.customText.trim();
  }
  return selectedOption(stepIndex, state)?.label ?? "";
}

export function QuestionsFlow({ locale, glasses = false }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<StepState[]>(initialSteps);
  const [taskList, setTaskList] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [clientTimeZone, setClientTimeZone] = useState("UTC");
  const [clientLocalDate, setClientLocalDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showConfusedHint, setShowConfusedHint] = useState(false);

  const progress = useMemo(() => Math.round(((step + 1) / stepDefinitions.length) * 100), [step]);
  const determinedCue = getUserCue("questions_determined", locale);
  const confusedCue = getUserCue("questions_confused", locale);
  const managerCuriousCue = getManagerCue("upload_saved_pending", locale);

  const currentStepDef = stepDefinitions[step];
  const currentState = answers[step];
  const currentOption = selectedOption(step, currentState);
  const stepCompleted = hasAnswer(currentState);
  const allAnswered = answers.every((item) => hasAnswer(item));
  const reactionEmoji = currentOption?.emoji ?? (currentState.customText.trim() ? "✍️" : "🙂");
  const reactionText = currentOption?.label ?? (currentState.customText.trim() || "Choose an option");
  const userEmotion =
    currentState.choice === ""
      ? "neutral"
      : currentOption?.productive === false || currentState.choice === "CUSTOM"
        ? "alert"
        : "excited";
  const managerEmotion = stepCompleted ? "approval" : "encouraging";

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

  function chooseOption(key: ChoiceKey) {
    setSubmitError("");
    setShowConfusedHint(false);
    setAnswers((prev) =>
      prev.map((item, index) => {
        if (index !== step) return item;
        return { choice: key, customText: "" };
      })
    );
  }

  function updateCustom(value: string) {
    setSubmitError("");
    setShowConfusedHint(false);
    setAnswers((prev) =>
      prev.map((item, index) => {
        if (index !== step) return item;
        if (value.trim().length === 0) {
          return item.choice === "CUSTOM" ? { choice: "", customText: "" } : { ...item, customText: "" };
        }
        return { choice: "CUSTOM", customText: value };
      })
    );
  }

  const mood = selectedOption(0, answers[0])?.mood ?? (answerLabel(0, answers[0]) || "Steady");
  const progressAnswer = answerLabel(1, answers[1]) || "";
  const nextMoveAnswer = answerLabel(2, answers[2]) || "";
  const productive =
    (selectedOption(0, answers[0])?.productive ?? true) &&
    (selectedOption(1, answers[1])?.productive ?? true) &&
    (selectedOption(2, answers[2])?.productive ?? true);

  async function onSubmitCheckIn() {
    if (saving) return;
    if (!allAnswered) {
      setShowConfusedHint(true);
      return;
    }

    setSaving(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/submissions/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          feeling: mood,
          focus: answerLabel(0, answers[0]),
          blocker: progressAnswer,
          win: nextMoveAnswer,
          calories: 0,
          productive,
          task_list: taskList,
          file_url: fileUrl,
          client_time_zone: clientTimeZone,
          client_local_date: clientLocalDate
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to save check-in.");
      }

      const payload = (await response.json()) as { redirectTo?: string };
      router.push(payload.redirectTo ?? "/app/questions?saved=1");
      router.refresh();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Failed to save check-in.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <CharacterAlert glasses={glasses} role="user" cue={determinedCue} compact />

      <div className="soft-card p-3">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Daily check-in flow</span>
          <span>
            {step + 1}/{stepDefinitions.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Date auto-sync: {clientLocalDate || "syncing..."} ({clientTimeZone})
        </p>
      </div>

      <article className="card space-y-4 p-5">
        <div className="rounded-2xl bg-indigo-50 p-3">
          <p className="text-sm font-semibold text-indigo-900">{currentStepDef.title}</p>
          <p className="text-xs text-indigo-700">{currentStepDef.help}</p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {currentStepDef.options.map((option) => {
            const selected = currentState.choice === option.key;
            return (
              <button
                key={option.key}
                className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
                  selected
                    ? "border-indigo-400 bg-indigo-100 text-indigo-900"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
                onClick={() => chooseOption(option.key)}
                type="button"
              >
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-indigo-700">
                  {option.key}
                </span>
                {option.emoji} {option.label}
              </button>
            );
          })}
        </div>

        <label className="text-sm font-semibold text-slate-600">
          Your answer
          <textarea
            className="input mt-2 h-20 resize-none"
            onChange={(event) => updateCustom(event.target.value)}
            placeholder="Type your own answer if A/B/C does not fit."
            value={currentState.choice === "CUSTOM" ? currentState.customText : ""}
          />
        </label>

        <div className="rounded-2xl bg-amber-50 p-3">
          <div className="flex items-center justify-center gap-3">
            <ChibiAvatar emotion={managerEmotion} role="manager" size={48} />
            <p className="anim-pop text-3xl">{reactionEmoji}</p>
            <ChibiAvatar emotion={userEmotion} glasses={glasses} role="user" size={48} />
          </div>
          <p className="mt-1 text-center text-sm font-semibold text-amber-800">{reactionText}</p>
        </div>

        {showConfusedHint && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-2">
            <CharacterAlert glasses={glasses} role="user" cue={confusedCue} compact tone="warning" />
          </div>
        )}
      </article>

      {step === stepDefinitions.length - 1 && (
        <article className="card space-y-3 p-5">
          <label className="text-sm font-semibold text-slate-600">
            Task log (one task per line)
            <textarea
              className="input mt-2 h-24 resize-none"
              onChange={(event) => setTaskList(event.target.value)}
              placeholder="- Ship homepage\n- Review PR\n- Sync with manager"
              value={taskList}
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            File link (optional)
            <input className="input mt-2" onChange={(event) => setFileUrl(event.target.value)} value={fileUrl} />
          </label>
          {(fileUrl.trim().length > 0 || allAnswered) && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-2">
              <CharacterAlert role="manager" cue={managerCuriousCue} compact />
            </div>
          )}
        </article>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          className="btn btn-muted w-full"
          disabled={step === 0}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          type="button"
        >
          Back
        </button>

        {step < stepDefinitions.length - 1 ? (
          <button
            className="btn btn-primary w-full"
            onClick={() => {
              if (!stepCompleted) {
                setShowConfusedHint(true);
                return;
              }
              setShowConfusedHint(false);
              setStep((value) => Math.min(stepDefinitions.length - 1, value + 1));
            }}
            type="button"
          >
            Next
          </button>
        ) : (
          <button className="btn btn-primary w-full" disabled={saving} onClick={onSubmitCheckIn} type="button">
            <span className="inline-flex items-center gap-2">
              <ChibiAvatar emotion={allAnswered ? "approval" : "encouraging"} role="manager" size={24} />
              {saving ? "Saving..." : "Save check-in"}
              <ChibiAvatar emotion={allAnswered ? "excited" : "neutral"} glasses={glasses} role="user" size={24} />
            </span>
          </button>
        )}
      </div>

      {submitError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {submitError}
        </div>
      )}
    </div>
  );
}
