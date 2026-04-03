export type CheckInQuestionId =
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "q5"
  | "q6"
  | "q7"
  | "q8"
  | "q9"
  | "q10";

export type CheckInChoiceQuestionId = Exclude<CheckInQuestionId, "q10">;

export type CheckInOption = {
  value: string;
  emoji: string;
  label: string;
};

export type CheckInQuestion = {
  id: CheckInQuestionId;
  title: string;
  description: string;
  type: "choice" | "slider";
  options?: CheckInOption[];
  sliderMin?: number;
  sliderMax?: number;
};

export type DailyCheckInDraft = {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q5: string;
  q6: string[];
  q7: string;
  q8: string;
  q9: string;
  q10: number;
  blocker_other: string;
  quick_tag: string;
  work_note: string;
  manager_message: string;
  manager_quick_message: string;
  evidence_files: string[];
  evidence_links: string[];
};

export const DEFAULT_DAILY_CHECKIN_DRAFT: DailyCheckInDraft = {
  q1: "",
  q2: "",
  q3: "",
  q4: "",
  q5: "",
  q6: [],
  q7: "",
  q8: "",
  q9: "",
  q10: 7,
  blocker_other: "",
  quick_tag: "",
  work_note: "",
  manager_message: "",
  manager_quick_message: "",
  evidence_files: [],
  evidence_links: []
};

export const DAILY_CHECKIN_QUESTIONS: CheckInQuestion[] = [
  {
    id: "q1",
    title: "How much of your plan did you complete?",
    description: "Single tap to answer",
    type: "choice",
    options: [
      { value: "not_much", emoji: "😓", label: "Not much" },
      { value: "some", emoji: "😐", label: "Some of it" },
      { value: "most", emoji: "🙂", label: "Most of it" },
      { value: "almost_all", emoji: "😎", label: "Almost all" }
    ]
  },
  {
    id: "q2",
    title: "Did you complete your main task?",
    description: "Single tap to answer",
    type: "choice",
    options: [
      { value: "no", emoji: "❌", label: "No" },
      { value: "partly", emoji: "⚡", label: "Partly" },
      { value: "yes", emoji: "✅", label: "Yes" },
      { value: "no_main_task", emoji: "➖", label: "No main task" }
    ]
  },
  {
    id: "q3",
    title: "How well did your day follow your plan?",
    description: "Single tap to answer",
    type: "choice",
    options: [
      { value: "very_off", emoji: "😵", label: "Very off track" },
      { value: "a_bit_off", emoji: "😕", label: "A bit off" },
      { value: "mostly_on", emoji: "🙂", label: "Mostly on track" },
      { value: "fully_on", emoji: "🔥", label: "Fully on track" }
    ]
  },
  {
    id: "q4",
    title: "How focused were you?",
    description: "Single tap to answer",
    type: "choice",
    options: [
      { value: "very_low", emoji: "💤", label: "Very low" },
      { value: "distracted", emoji: "📱", label: "Distracted" },
      { value: "okay", emoji: "👍", label: "Okay" },
      { value: "strong", emoji: "🎯", label: "Strong" }
    ]
  },
  {
    id: "q5",
    title: "How productive was your day?",
    description: "Single tap to answer",
    type: "choice",
    options: [
      { value: "poor", emoji: "😞", label: "Poor" },
      { value: "okay", emoji: "😐", label: "Okay" },
      { value: "good", emoji: "🙂", label: "Good" },
      { value: "great", emoji: "🚀", label: "Great" }
    ]
  },
  {
    id: "q6",
    title: "What was your biggest blocker?",
    description: "Tap one or more blockers",
    type: "choice",
    options: [
      { value: "low_energy", emoji: "😴", label: "Low energy" },
      { value: "too_many_tasks", emoji: "📋", label: "Too many tasks" },
      { value: "distractions", emoji: "📱", label: "Distractions" },
      { value: "stress_mood", emoji: "💭", label: "Stress / mood" }
    ]
  },
  {
    id: "q7",
    title: "How was your sleep?",
    description: "Single tap to answer",
    type: "choice",
    options: [
      { value: "poor", emoji: "😵", label: "Poor" },
      { value: "okay", emoji: "😐", label: "Okay" },
      { value: "good", emoji: "🙂", label: "Good" },
      { value: "great", emoji: "😴", label: "Great" }
    ]
  },
  {
    id: "q8",
    title: "How active were you?",
    description: "Single tap to answer",
    type: "choice",
    options: [
      { value: "none", emoji: "🛌", label: "None" },
      { value: "light", emoji: "🚶", label: "Light" },
      { value: "moderate", emoji: "🏃", label: "Moderate" },
      { value: "strong", emoji: "💪", label: "Strong" }
    ]
  },
  {
    id: "q9",
    title: "How did you do with your calorie goal?",
    description: "Single tap to answer",
    type: "choice",
    options: [
      { value: "far_above", emoji: "🍔", label: "Far above" },
      { value: "slightly_above", emoji: "🍕", label: "Slightly above" },
      { value: "close", emoji: "🥗", label: "Close to goal" },
      { value: "on_target", emoji: "🎯", label: "On target" }
    ]
  },
  {
    id: "q10",
    title: "How would you rate your day?",
    description: "Slide from 1 to 10",
    type: "slider",
    sliderMin: 1,
    sliderMax: 10
  }
];

export const QUICK_TAG_OPTIONS: CheckInOption[] = [
  { value: "tough_day", emoji: "😞", label: "Tough day" },
  { value: "okay_day", emoji: "😐", label: "Okay day" },
  { value: "good_day", emoji: "🙂", label: "Good day" },
  { value: "great_day", emoji: "🔥", label: "Great day" }
];

export const MANAGER_QUICK_MESSAGE_OPTIONS: CheckInOption[] = [
  { value: "tried_best", emoji: "🙏", label: "I tried my best" },
  { value: "harder_than_expected", emoji: "😓", label: "It was harder than expected" },
  { value: "good_progress", emoji: "💪", label: "I made good progress" },
  { value: "better_tomorrow", emoji: "🔄", label: "I'll do better tomorrow" }
];

export function findQuestionById(id: CheckInQuestionId): CheckInQuestion | undefined {
  return DAILY_CHECKIN_QUESTIONS.find((question) => question.id === id);
}

export function findOptionLabel(questionId: CheckInChoiceQuestionId, value: string): string {
  const question = findQuestionById(questionId);
  const option = question?.options?.find((item) => item.value === value);
  if (!option) return "-";
  return `${option.emoji} ${option.label}`;
}

export function pickOptionLabel(options: CheckInOption[], value: string): string {
  const option = options.find((item) => item.value === value);
  if (!option) return "-";
  return `${option.emoji} ${option.label}`;
}
