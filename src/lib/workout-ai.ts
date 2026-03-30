import type { WorkoutIntensity, WorkoutType } from "@/lib/wellness-storage";

export type WorkoutReference = {
  id: string;
  name: string;
  aliases: string[];
  emoji: string;
  workout_type: WorkoutType;
  intensity: WorkoutIntensity;
  location: string;
  met: number;
  defaultDuration: number;
  defaultStepsPerMinute: number;
};

export type WorkoutEstimate = {
  duration: number;
  calories: number;
  steps: number;
  intensity: WorkoutIntensity;
  location: string;
};

const WORKOUT_DB: WorkoutReference[] = [
  {
    id: "gym-strength",
    name: "Strength Training",
    aliases: ["gym", "weight", "strength", "웨이트", "헬스"],
    emoji: "🏋️",
    workout_type: "Gym",
    intensity: "high",
    location: "Gym",
    met: 6.0,
    defaultDuration: 45,
    defaultStepsPerMinute: 40
  },
  {
    id: "walking",
    name: "Brisk Walk",
    aliases: ["walk", "walking", "산책", "걷기"],
    emoji: "🚶",
    workout_type: "Walk",
    intensity: "medium",
    location: "Outdoor",
    met: 4.3,
    defaultDuration: 30,
    defaultStepsPerMinute: 115
  },
  {
    id: "running",
    name: "Running",
    aliases: ["run", "running", "조깅", "달리기"],
    emoji: "🏃",
    workout_type: "Run",
    intensity: "high",
    location: "Outdoor",
    met: 9.8,
    defaultDuration: 30,
    defaultStepsPerMinute: 155
  },
  {
    id: "stretch",
    name: "Mobility Stretch",
    aliases: ["stretch", "yoga", "필라테스", "스트레칭"],
    emoji: "🧘",
    workout_type: "Stretch",
    intensity: "low",
    location: "Home",
    met: 2.8,
    defaultDuration: 20,
    defaultStepsPerMinute: 20
  },
  {
    id: "home-hiit",
    name: "Home HIIT",
    aliases: ["home workout", "home", "맨몸", "hiit"],
    emoji: "💪",
    workout_type: "Home",
    intensity: "high",
    location: "Home",
    met: 8.0,
    defaultDuration: 22,
    defaultStepsPerMinute: 65
  },
  {
    id: "cycling",
    name: "Cycling",
    aliases: ["bike", "cycling", "자전거"],
    emoji: "🚴",
    workout_type: "Custom",
    intensity: "medium",
    location: "Outdoor",
    met: 7.5,
    defaultDuration: 35,
    defaultStepsPerMinute: 35
  },
  {
    id: "swimming",
    name: "Swimming",
    aliases: ["swim", "swimming", "수영"],
    emoji: "🏊",
    workout_type: "Custom",
    intensity: "high",
    location: "Pool",
    met: 8.3,
    defaultDuration: 35,
    defaultStepsPerMinute: 15
  }
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u3131-\uD79D\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function score(item: WorkoutReference, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(item.name);
  const aliases = item.aliases.map((alias) => normalize(alias));

  if (name === q) return 120;
  if (aliases.includes(q)) return 110;
  if (name.startsWith(q)) return 95;
  if (aliases.some((alias) => alias.startsWith(q))) return 88;
  if (name.includes(q)) return 74;
  if (aliases.some((alias) => alias.includes(q))) return 66;

  const tokens = q.split(" ");
  let tokenScore = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (name.includes(token)) tokenScore += 8;
    if (aliases.some((alias) => alias.includes(token))) tokenScore += 6;
  }
  return tokenScore;
}

export function searchWorkoutReferences(query: string, limit = 10): WorkoutReference[] {
  const q = query.trim();
  if (!q) return WORKOUT_DB.slice(0, limit);
  return [...WORKOUT_DB]
    .map((item) => ({ item, score: score(item, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}

function computeCalories(met: number, weightKg: number, duration: number): number {
  const safeWeight = Math.max(35, Math.min(180, weightKg));
  const safeDuration = Math.max(5, Math.round(duration));
  return Math.round((met * 3.5 * safeWeight * safeDuration) / 200);
}

export function estimateWorkoutFromReference(reference: WorkoutReference, duration: number, weightKg = 65): WorkoutEstimate {
  const safeDuration = Math.max(5, Math.round(duration));
  return {
    duration: safeDuration,
    calories: computeCalories(reference.met, weightKg, safeDuration),
    steps: Math.max(0, Math.round(reference.defaultStepsPerMinute * safeDuration)),
    intensity: reference.intensity,
    location: reference.location
  };
}

function fallbackMet(query: string): { met: number; intensity: WorkoutIntensity; type: WorkoutType; location: string; stepsPerMinute: number } {
  const q = normalize(query);
  if (q.includes("run") || q.includes("달")) return { met: 9.3, intensity: "high", type: "Run", location: "Outdoor", stepsPerMinute: 150 };
  if (q.includes("walk") || q.includes("걷") || q.includes("산책")) return { met: 4.0, intensity: "medium", type: "Walk", location: "Outdoor", stepsPerMinute: 110 };
  if (q.includes("gym") || q.includes("헬스") || q.includes("웨이트")) return { met: 6.0, intensity: "high", type: "Gym", location: "Gym", stepsPerMinute: 40 };
  if (q.includes("stretch") || q.includes("yoga") || q.includes("필라테스")) return { met: 2.8, intensity: "low", type: "Stretch", location: "Home", stepsPerMinute: 18 };
  return { met: 5.0, intensity: "medium", type: "Custom", location: "Custom", stepsPerMinute: 60 };
}

export function estimateWorkoutFromText(query: string, duration: number, weightKg = 65): WorkoutEstimate & { workout_type: WorkoutType } {
  const fallback = fallbackMet(query);
  const safeDuration = Math.max(5, Math.round(duration));
  return {
    workout_type: fallback.type,
    duration: safeDuration,
    calories: computeCalories(fallback.met, weightKg, safeDuration),
    steps: Math.max(0, Math.round(fallback.stepsPerMinute * safeDuration)),
    intensity: fallback.intensity,
    location: fallback.location
  };
}
