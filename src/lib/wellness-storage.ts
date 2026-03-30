export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type WorkoutType = "Gym" | "Walk" | "Run" | "Stretch" | "Home" | "Custom";
export type WorkoutIntensity = "low" | "medium" | "high";
export type SleepQuality = "Low" | "Medium" | "High Quality";

export type FoodLog = {
  id: string;
  date: string;
  meal_type: MealType;
  food_name: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  water: number;
  ingredients: string[];
  note: string;
  appetite_level: string;
  balanced_meal_rating: number;
  overeating: boolean;
  image_url?: string;
  created_at: string;
};

export type WorkoutLog = {
  id: string;
  date: string;
  workout_type: WorkoutType;
  title: string;
  start_time: string;
  duration: number;
  intensity: WorkoutIntensity;
  calories_burned: number;
  steps: number;
  location: string;
  fatigue: number;
  note: string;
  mission_linked: boolean;
  created_at: string;
};

export type SleepStage = {
  type: "REM" | "Light" | "Deep" | "Awake";
  minutes: number;
};

export type SleepLog = {
  id: string;
  date: string;
  sleep_start: string;
  wake_time: string;
  total_sleep_minutes: number;
  recovery_percent: number;
  sleep_quality: SleepQuality;
  naps_minutes: number;
  wakeups: number;
  latency_minutes: number;
  mood_after_waking: string;
  late_caffeine: boolean;
  note: string;
  stages: SleepStage[];
  created_at: string;
};

export type FocusSession = {
  id: string;
  date: string;
  label: "Deep Work" | "Collaboration" | "Study" | "Admin";
  minutes: number;
  created_at: string;
};

export type WellnessGoals = {
  calorie_goal: number;
  water_goal: number;
  movement_goal: number;
  sleep_goal_minutes: number;
};

type WaterMap = Record<string, number>;

const STORAGE_KEYS = {
  food: "wm-food-logs-v1",
  workout: "wm-workout-logs-v1",
  sleep: "wm-sleep-logs-v1",
  focus: "wm-focus-sessions-v1",
  goals: "wm-wellness-goals-v1",
  waterMap: "wm-water-map-v1"
} as const;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJSON<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function todayLocalISO(input = new Date()): string {
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

function shiftDate(baseISO: string, offset: number): string {
  const date = new Date(`${baseISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function seedFoodLogs(): FoodLog[] {
  const today = todayLocalISO();
  return [
    {
      id: createId("food"),
      date: today,
      meal_type: "Breakfast",
      food_name: "Avocado Toast",
      grams: 180,
      calories: 340,
      protein: 18,
      fat: 18,
      carbs: 28,
      water: 1,
      ingredients: ["Bread", "Avocado", "Egg", "Olive oil"],
      note: "Light and balanced",
      appetite_level: "Good",
      balanced_meal_rating: 4,
      overeating: false,
      image_url: "",
      created_at: nowISO()
    },
    {
      id: createId("food"),
      date: today,
      meal_type: "Lunch",
      food_name: "Salmon Salad",
      grams: 320,
      calories: 520,
      protein: 34,
      fat: 28,
      carbs: 29,
      water: 1,
      ingredients: ["Salmon", "Lettuce", "Tomato", "Quinoa", "Olive oil"],
      note: "Protein-focused",
      appetite_level: "Normal",
      balanced_meal_rating: 5,
      overeating: false,
      image_url: "",
      created_at: nowISO()
    },
    {
      id: createId("food"),
      date: today,
      meal_type: "Snack",
      food_name: "Almonds (30g)",
      grams: 30,
      calories: 170,
      protein: 6,
      fat: 14,
      carbs: 6,
      water: 0,
      ingredients: ["Almonds", "Sea salt"],
      note: "Afternoon snack",
      appetite_level: "Low",
      balanced_meal_rating: 3,
      overeating: false,
      image_url: "",
      created_at: nowISO()
    },
    {
      id: createId("food"),
      date: shiftDate(today, -1),
      meal_type: "Dinner",
      food_name: "Chicken Bowl",
      grams: 420,
      calories: 640,
      protein: 42,
      fat: 20,
      carbs: 62,
      water: 1,
      ingredients: ["Chicken breast", "Brown rice", "Broccoli", "Sauce"],
      note: "Late dinner",
      appetite_level: "High",
      balanced_meal_rating: 3,
      overeating: false,
      image_url: "",
      created_at: nowISO()
    }
  ];
}

function seedWorkoutLogs(): WorkoutLog[] {
  const today = todayLocalISO();
  return [
    {
      id: createId("workout"),
      date: today,
      workout_type: "Run",
      title: "Morning Run",
      start_time: "07:30",
      duration: 30,
      intensity: "medium",
      calories_burned: 220,
      steps: 4200,
      location: "Outdoor",
      fatigue: 2,
      note: "Comfort pace",
      mission_linked: true,
      created_at: nowISO()
    },
    {
      id: createId("workout"),
      date: today,
      workout_type: "Stretch",
      title: "Yoga Stretch",
      start_time: "08:15",
      duration: 15,
      intensity: "low",
      calories_burned: 100,
      steps: 4200,
      location: "Home",
      fatigue: 1,
      note: "Recovery",
      mission_linked: false,
      created_at: nowISO()
    },
    {
      id: createId("workout"),
      date: shiftDate(today, -2),
      workout_type: "Gym",
      title: "Strength Session",
      start_time: "18:20",
      duration: 48,
      intensity: "high",
      calories_burned: 320,
      steps: 7800,
      location: "Gym",
      fatigue: 3,
      note: "Push day",
      mission_linked: false,
      created_at: nowISO()
    }
  ];
}

function seedSleepLogs(): SleepLog[] {
  const today = todayLocalISO();
  const yesterday = shiftDate(today, -1);
  return [
    {
      id: createId("sleep"),
      date: today,
      sleep_start: "23:30",
      wake_time: "07:15",
      total_sleep_minutes: 465,
      recovery_percent: 88,
      sleep_quality: "High Quality",
      naps_minutes: 0,
      wakeups: 1,
      latency_minutes: 15,
      mood_after_waking: "Fresh",
      late_caffeine: false,
      note: "Solid deep sleep",
      stages: [
        { type: "REM", minutes: 95 },
        { type: "Light", minutes: 180 },
        { type: "Deep", minutes: 150 },
        { type: "Awake", minutes: 40 }
      ],
      created_at: nowISO()
    },
    {
      id: createId("sleep"),
      date: yesterday,
      sleep_start: "00:05",
      wake_time: "07:00",
      total_sleep_minutes: 415,
      recovery_percent: 76,
      sleep_quality: "Medium",
      naps_minutes: 20,
      wakeups: 2,
      latency_minutes: 20,
      mood_after_waking: "Okay",
      late_caffeine: true,
      note: "Slept later than target",
      stages: [
        { type: "REM", minutes: 80 },
        { type: "Light", minutes: 165 },
        { type: "Deep", minutes: 120 },
        { type: "Awake", minutes: 50 }
      ],
      created_at: nowISO()
    }
  ];
}

function seedFocusSessions(): FocusSession[] {
  const today = todayLocalISO();
  return [
    { id: createId("focus"), date: today, label: "Deep Work", minutes: 135, created_at: nowISO() },
    { id: createId("focus"), date: today, label: "Collaboration", minutes: 45, created_at: nowISO() },
    { id: createId("focus"), date: today, label: "Study", minutes: 35, created_at: nowISO() },
    { id: createId("focus"), date: today, label: "Admin", minutes: 25, created_at: nowISO() }
  ];
}

function ensureSeeded<T>(key: string, seed: T): T {
  if (!canUseStorage()) return seed;
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return readJSON<T>(key, seed);
  }
  writeJSON(key, seed);
  return seed;
}

export function getWellnessGoals(): WellnessGoals {
  return ensureSeeded<WellnessGoals>(STORAGE_KEYS.goals, {
    calorie_goal: 2100,
    water_goal: 8,
    movement_goal: 60,
    sleep_goal_minutes: 480
  });
}

export function setWellnessGoals(next: Partial<WellnessGoals>) {
  const current = getWellnessGoals();
  writeJSON(STORAGE_KEYS.goals, {
    ...current,
    ...next,
    calorie_goal: Math.max(1000, Math.round(next.calorie_goal ?? current.calorie_goal)),
    water_goal: Math.max(1, Math.round(next.water_goal ?? current.water_goal)),
    movement_goal: Math.max(10, Math.round(next.movement_goal ?? current.movement_goal)),
    sleep_goal_minutes: Math.max(120, Math.round(next.sleep_goal_minutes ?? current.sleep_goal_minutes))
  });
}

export function getFoodLogs(): FoodLog[] {
  const seeded = ensureSeeded<FoodLog[]>(STORAGE_KEYS.food, seedFoodLogs());
  const normalized = seeded.map((item) => {
    const calories = Math.max(0, Math.round(Number(item.calories ?? 0)));
    const protein = Math.max(0, roundOne(Number(item.protein ?? 0)));
    const fat = Math.max(0, roundOne(Number(item.fat ?? 0)));
    const carbs = Math.max(0, roundOne(Number(item.carbs ?? 0)));
    const grams = Math.max(1, Math.round(Number(item.grams ?? 0) || 100));
    const ingredientsRaw = item.ingredients;
    const ingredients = Array.isArray(ingredientsRaw)
      ? ingredientsRaw.map((token) => String(token).trim()).filter(Boolean)
      : typeof ingredientsRaw === "string"
        ? ingredientsRaw
            .split(/[,\n]/g)
            .map((token) => token.trim())
            .filter(Boolean)
        : [];

    return {
      ...item,
      grams,
      calories,
      protein,
      fat,
      carbs,
      ingredients
    };
  });
  return [...normalized].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

export function saveFoodLogs(next: FoodLog[]) {
  writeJSON(STORAGE_KEYS.food, [...next].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)));
}

export function upsertFoodLog(input: Partial<FoodLog> & { date: string; meal_type: MealType; food_name: string }): FoodLog {
  const logs = getFoodLogs();
  const normalizedIngredients = Array.isArray(input.ingredients)
    ? input.ingredients.map((token) => String(token).trim()).filter(Boolean)
    : typeof input.ingredients === "string"
      ? input.ingredients
          .split(/[,\n]/g)
          .map((token) => token.trim())
          .filter(Boolean)
      : [];
  const next: FoodLog = {
    id: input.id?.trim() || createId("food"),
    date: input.date,
    meal_type: input.meal_type,
    food_name: input.food_name,
    grams: Math.max(1, Math.round(input.grams ?? 100)),
    calories: Math.max(0, Math.round(input.calories ?? 0)),
    protein: Math.max(0, roundOne(input.protein ?? 0)),
    fat: Math.max(0, roundOne(input.fat ?? 0)),
    carbs: Math.max(0, roundOne(input.carbs ?? 0)),
    water: Math.max(0, Math.round(input.water ?? 0)),
    ingredients: normalizedIngredients,
    note: String(input.note ?? "").trim(),
    appetite_level: String(input.appetite_level ?? "Normal").trim() || "Normal",
    balanced_meal_rating: Math.max(1, Math.min(5, Math.round(input.balanced_meal_rating ?? 3))),
    overeating: Boolean(input.overeating),
    image_url: String(input.image_url ?? "").trim(),
    created_at: input.created_at ?? nowISO()
  };
  const filtered = logs.filter((item) => item.id !== next.id);
  saveFoodLogs([next, ...filtered]);
  return next;
}

export function deleteFoodLog(id: string) {
  saveFoodLogs(getFoodLogs().filter((item) => item.id !== id));
}

export function duplicateFoodLog(id: string): FoodLog | null {
  const target = getFoodLogs().find((item) => item.id === id);
  if (!target) return null;
  return upsertFoodLog({ ...target, id: createId("food"), created_at: nowISO() });
}

export function getWorkoutLogs(): WorkoutLog[] {
  const seeded = ensureSeeded<WorkoutLog[]>(STORAGE_KEYS.workout, seedWorkoutLogs());
  return [...seeded].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

export function saveWorkoutLogs(next: WorkoutLog[]) {
  writeJSON(STORAGE_KEYS.workout, [...next].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)));
}

export function upsertWorkoutLog(input: Partial<WorkoutLog> & { date: string; workout_type: WorkoutType; title: string }): WorkoutLog {
  const logs = getWorkoutLogs();
  const next: WorkoutLog = {
    id: input.id?.trim() || createId("workout"),
    date: input.date,
    workout_type: input.workout_type,
    title: input.title,
    start_time: String(input.start_time ?? "07:00").trim() || "07:00",
    duration: Math.max(5, Math.round(input.duration ?? 20)),
    intensity: input.intensity ?? "medium",
    calories_burned: Math.max(0, Math.round(input.calories_burned ?? 0)),
    steps: Math.max(0, Math.round(input.steps ?? 0)),
    location: String(input.location ?? "").trim(),
    fatigue: Math.max(0, Math.min(5, Math.round(input.fatigue ?? 2))),
    note: String(input.note ?? "").trim(),
    mission_linked: Boolean(input.mission_linked),
    created_at: input.created_at ?? nowISO()
  };
  const filtered = logs.filter((item) => item.id !== next.id);
  saveWorkoutLogs([next, ...filtered]);
  return next;
}

export function deleteWorkoutLog(id: string) {
  saveWorkoutLogs(getWorkoutLogs().filter((item) => item.id !== id));
}

export function getSleepLogs(): SleepLog[] {
  const seeded = ensureSeeded<SleepLog[]>(STORAGE_KEYS.sleep, seedSleepLogs());
  return [...seeded].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

export function saveSleepLogs(next: SleepLog[]) {
  writeJSON(STORAGE_KEYS.sleep, [...next].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)));
}

function normalizeStages(stages: SleepStage[] | undefined, totalMinutes: number): SleepStage[] {
  if (stages && stages.length > 0) {
    const cleaned = stages
      .map((stage) => ({ type: stage.type, minutes: Math.max(0, Math.round(stage.minutes)) }))
      .filter((stage) => stage.minutes > 0);
    if (cleaned.length > 0) return cleaned;
  }

  const rem = Math.max(0, Math.round(totalMinutes * 0.2));
  const light = Math.max(0, Math.round(totalMinutes * 0.4));
  const deep = Math.max(0, Math.round(totalMinutes * 0.3));
  const awake = Math.max(0, totalMinutes - rem - light - deep);
  return [
    { type: "REM", minutes: rem },
    { type: "Light", minutes: light },
    { type: "Deep", minutes: deep },
    { type: "Awake", minutes: awake }
  ];
}

export function upsertSleepLog(input: Partial<SleepLog> & { date: string; sleep_start: string; wake_time: string }): SleepLog {
  const logs = getSleepLogs();
  const totalMinutes = Math.max(120, Math.round(input.total_sleep_minutes ?? 420));
  const next: SleepLog = {
    id: input.id?.trim() || createId("sleep"),
    date: input.date,
    sleep_start: String(input.sleep_start ?? "23:00").trim() || "23:00",
    wake_time: String(input.wake_time ?? "07:00").trim() || "07:00",
    total_sleep_minutes: totalMinutes,
    recovery_percent: Math.max(0, Math.min(100, Math.round(input.recovery_percent ?? 70))),
    sleep_quality: input.sleep_quality ?? "Medium",
    naps_minutes: Math.max(0, Math.round(input.naps_minutes ?? 0)),
    wakeups: Math.max(0, Math.round(input.wakeups ?? 0)),
    latency_minutes: Math.max(0, Math.round(input.latency_minutes ?? 15)),
    mood_after_waking: String(input.mood_after_waking ?? "Okay").trim() || "Okay",
    late_caffeine: Boolean(input.late_caffeine),
    note: String(input.note ?? "").trim(),
    stages: normalizeStages(input.stages, totalMinutes),
    created_at: input.created_at ?? nowISO()
  };
  const filtered = logs.filter((item) => item.id !== next.id);
  saveSleepLogs([next, ...filtered]);
  return next;
}

export function deleteSleepLog(id: string) {
  saveSleepLogs(getSleepLogs().filter((item) => item.id !== id));
}

export function getFocusSessions(): FocusSession[] {
  const seeded = ensureSeeded<FocusSession[]>(STORAGE_KEYS.focus, seedFocusSessions());
  return [...seeded].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

export function saveFocusSessions(next: FocusSession[]) {
  writeJSON(STORAGE_KEYS.focus, next);
}

export function getWaterMap(): WaterMap {
  return ensureSeeded<WaterMap>(STORAGE_KEYS.waterMap, { [todayLocalISO()]: 5 });
}

export function setWaterByDate(date: string, cups: number) {
  const map = getWaterMap();
  map[date] = Math.max(0, Math.round(cups));
  writeJSON(STORAGE_KEYS.waterMap, map);
}

export function addWaterCup(date: string) {
  const map = getWaterMap();
  map[date] = Math.max(0, Math.round(map[date] ?? 0)) + 1;
  writeJSON(STORAGE_KEYS.waterMap, map);
}

export function getFoodSummary(date: string) {
  const logs = getFoodLogs().filter((item) => item.date === date);
  const goals = getWellnessGoals();
  const waterMap = getWaterMap();
  const calories = logs.reduce((sum, item) => sum + item.calories, 0);
  const protein = logs.reduce((sum, item) => sum + item.protein, 0);
  const fat = logs.reduce((sum, item) => sum + item.fat, 0);
  const carbs = logs.reduce((sum, item) => sum + item.carbs, 0);
  const cups = Math.max(0, Math.round(waterMap[date] ?? logs.reduce((sum, item) => sum + item.water, 0)));
  const percent = goals.calorie_goal <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((calories / goals.calorie_goal) * 100)));
  return {
    calories,
    protein,
    fat,
    carbs,
    waterCups: cups,
    goal: goals.calorie_goal,
    remaining: Math.max(0, goals.calorie_goal - calories),
    percent
  };
}

export function getFoodMealBreakdown(date: string) {
  const logs = getFoodLogs().filter((item) => item.date === date);
  const meals: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
  return meals.map((meal) => {
    const entries = logs.filter((item) => item.meal_type === meal);
    return {
      meal_type: meal,
      entries,
      count: entries.length,
      calories: entries.reduce((sum, item) => sum + item.calories, 0),
      grams: entries.reduce((sum, item) => sum + item.grams, 0),
      protein: entries.reduce((sum, item) => sum + item.protein, 0),
      fat: entries.reduce((sum, item) => sum + item.fat, 0),
      carbs: entries.reduce((sum, item) => sum + item.carbs, 0)
    };
  });
}

export function getWorkoutSummary(date: string) {
  const logs = getWorkoutLogs().filter((item) => item.date === date);
  const minutes = logs.reduce((sum, item) => sum + item.duration, 0);
  const calories = logs.reduce((sum, item) => sum + item.calories_burned, 0);
  const steps = logs.reduce((sum, item) => sum + item.steps, 0);
  const goals = getWellnessGoals();
  const percent = goals.movement_goal <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((minutes / goals.movement_goal) * 100)));
  const type = logs[0]?.workout_type ?? "No workout";
  return { minutes, calories, steps, type, percent, goal: goals.movement_goal };
}

export function getSleepSummary(date: string) {
  const logs = getSleepLogs().filter((item) => item.date === date);
  const latest = logs[0] ?? null;
  const goals = getWellnessGoals();
  const totalMinutes = latest?.total_sleep_minutes ?? 0;
  const recovery = latest?.recovery_percent ?? 0;
  const quality = latest?.sleep_quality ?? "Medium";
  const percent = goals.sleep_goal_minutes <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((totalMinutes / goals.sleep_goal_minutes) * 100)));
  return {
    totalMinutes,
    recovery,
    quality,
    percent,
    goalMinutes: goals.sleep_goal_minutes,
    latest
  };
}

export function toHourMinuteLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}

export function weeklyDates(baseDateISO: string): string[] {
  return Array.from({ length: 7 }, (_, idx) => shiftDate(baseDateISO, idx - 6));
}
