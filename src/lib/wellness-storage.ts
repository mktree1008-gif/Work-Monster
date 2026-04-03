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
  routine_id?: string;
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

export type WorkoutRoutine = {
  id: string;
  title: string;
  workout_type: WorkoutType;
  duration: number;
  intensity: WorkoutIntensity;
  location: string;
  steps: number;
  calories_hint: number;
  is_favorite: boolean;
  use_count: number;
  last_used_at: string;
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
  protein_goal: number;
  fat_goal: number;
  carb_goal: number;
  water_goal: number;
  water_unit?: "cups" | "ml";
  water_goal_ml?: number;
  movement_goal: number;
  sleep_goal_minutes: number;
};

type WaterMap = Record<string, number>;
type DailyCaloriesMap = Record<string, number>;
type DailyMacroMap = Record<string, { protein: number; fat: number; carbs: number }>;

const STORAGE_KEYS = {
  food: "wm-food-logs-v1",
  workout: "wm-workout-logs-v1",
  foodManualCalories: "wm-food-manual-calories-v1",
  foodManualMacros: "wm-food-manual-macros-v1",
  workoutManualCalories: "wm-workout-manual-calories-v1",
  workoutRoutines: "wm-workout-routines-v1",
  sleep: "wm-sleep-logs-v1",
  focus: "wm-focus-sessions-v1",
  goals: "wm-wellness-goals-v1",
  waterMap: "wm-water-map-v1",
  seedCleanupDone: "wm-wellness-seed-cleanup-v1"
} as const;

const WATER_ML_PER_CUP = 250;

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
  return [];
}

function seedWorkoutLogs(): WorkoutLog[] {
  return [];
}

function seedSleepLogs(): SleepLog[] {
  return [];
}

function seedWorkoutRoutines(): WorkoutRoutine[] {
  return [
    {
      id: createId("routine"),
      title: "Gym Strength",
      workout_type: "Gym",
      duration: 45,
      intensity: "high",
      location: "Gym",
      steps: 1800,
      calories_hint: 320,
      is_favorite: true,
      use_count: 6,
      last_used_at: nowISO(),
      created_at: nowISO()
    },
    {
      id: createId("routine"),
      title: "Lunch Walk",
      workout_type: "Walk",
      duration: 30,
      intensity: "medium",
      location: "Outdoor",
      steps: 3600,
      calories_hint: 140,
      is_favorite: true,
      use_count: 9,
      last_used_at: nowISO(),
      created_at: nowISO()
    },
    {
      id: createId("routine"),
      title: "Evening Stretch",
      workout_type: "Stretch",
      duration: 18,
      intensity: "low",
      location: "Home",
      steps: 400,
      calories_hint: 70,
      is_favorite: false,
      use_count: 3,
      last_used_at: nowISO(),
      created_at: nowISO()
    }
  ];
}

function seedFocusSessions(): FocusSession[] {
  return [];
}

const LEGACY_FOOD_SAMPLE_SIGNATURES = new Set<string>([
  "Breakfast|Avocado Toast|Light and balanced|340|18|18|28",
  "Lunch|Salmon Salad|Protein-focused|520|34|28|29",
  "Snack|Almonds (30g)|Afternoon snack|170|6|14|6",
  "Dinner|Chicken Bowl|Late dinner|640|42|20|62"
]);

const LEGACY_WORKOUT_SAMPLE_SIGNATURES = new Set<string>([
  "Run|Morning Run|Comfort pace|30|220|4200",
  "Stretch|Yoga Stretch|Recovery|15|100|4200",
  "Gym|Strength Session|Push day|48|320|7800"
]);

const LEGACY_SLEEP_SAMPLE_SIGNATURES = new Set<string>([
  "Solid deep sleep|465|88|High Quality",
  "Slept later than target|415|76|Medium"
]);

const LEGACY_FOCUS_SAMPLE_SIGNATURES = new Set<string>([
  "Deep Work|135",
  "Collaboration|45",
  "Study|35",
  "Admin|25"
]);

function isLegacyFoodSeed(log: FoodLog): boolean {
  const signature = [
    log.meal_type,
    log.food_name,
    String(log.note ?? "").trim(),
    String(Math.round(Number(log.calories ?? 0))),
    String(roundOne(Number(log.protein ?? 0))),
    String(roundOne(Number(log.fat ?? 0))),
    String(roundOne(Number(log.carbs ?? 0)))
  ].join("|");
  return LEGACY_FOOD_SAMPLE_SIGNATURES.has(signature);
}

function isLegacyWorkoutSeed(log: WorkoutLog): boolean {
  const signature = [
    log.workout_type,
    log.title,
    String(log.note ?? "").trim(),
    String(Math.round(Number(log.duration ?? 0))),
    String(Math.round(Number(log.calories_burned ?? 0))),
    String(Math.round(Number(log.steps ?? 0)))
  ].join("|");
  return LEGACY_WORKOUT_SAMPLE_SIGNATURES.has(signature);
}

function isLegacySleepSeed(log: SleepLog): boolean {
  const signature = [
    String(log.note ?? "").trim(),
    String(Math.round(Number(log.total_sleep_minutes ?? 0))),
    String(Math.round(Number(log.recovery_percent ?? 0))),
    String(log.sleep_quality ?? "")
  ].join("|");
  return LEGACY_SLEEP_SAMPLE_SIGNATURES.has(signature);
}

function isLegacyFocusSeed(session: FocusSession): boolean {
  const signature = `${session.label}|${Math.round(Number(session.minutes ?? 0))}`;
  return LEGACY_FOCUS_SAMPLE_SIGNATURES.has(signature);
}

function cleanupLegacySeedDataOnce() {
  if (!canUseStorage()) return;
  if (window.localStorage.getItem(STORAGE_KEYS.seedCleanupDone) === "1") return;

  const food = readJSON<FoodLog[]>(STORAGE_KEYS.food, []);
  const nextFood = food.filter((item) => !isLegacyFoodSeed(item));
  if (nextFood.length !== food.length) writeJSON(STORAGE_KEYS.food, nextFood);

  const workout = readJSON<WorkoutLog[]>(STORAGE_KEYS.workout, []);
  const nextWorkout = workout.filter((item) => !isLegacyWorkoutSeed(item));
  if (nextWorkout.length !== workout.length) writeJSON(STORAGE_KEYS.workout, nextWorkout);

  const sleep = readJSON<SleepLog[]>(STORAGE_KEYS.sleep, []);
  const nextSleep = sleep.filter((item) => !isLegacySleepSeed(item));
  if (nextSleep.length !== sleep.length) writeJSON(STORAGE_KEYS.sleep, nextSleep);

  const focus = readJSON<FocusSession[]>(STORAGE_KEYS.focus, []);
  const nextFocus = focus.filter((item) => !isLegacyFocusSeed(item));
  if (nextFocus.length !== focus.length) writeJSON(STORAGE_KEYS.focus, nextFocus);

  const waterMap = readJSON<WaterMap>(STORAGE_KEYS.waterMap, {});
  const normalizedWaterMap: WaterMap = {};
  Object.entries(waterMap).forEach(([date, cups]) => {
    const next = Math.max(0, Math.round(Number(cups) || 0));
    if (next > 0) normalizedWaterMap[date] = next;
  });
  const waterKeys = Object.keys(normalizedWaterMap);
  if (waterKeys.length === 1) {
    const onlyDate = waterKeys[0];
    if (onlyDate === todayLocalISO() && normalizedWaterMap[onlyDate] === 5) {
      writeJSON(STORAGE_KEYS.waterMap, {});
    } else {
      writeJSON(STORAGE_KEYS.waterMap, normalizedWaterMap);
    }
  } else if (waterKeys.length !== Object.keys(waterMap).length) {
    writeJSON(STORAGE_KEYS.waterMap, normalizedWaterMap);
  }

  window.localStorage.setItem(STORAGE_KEYS.seedCleanupDone, "1");
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
  cleanupLegacySeedDataOnce();
  const seeded = ensureSeeded<WellnessGoals>(STORAGE_KEYS.goals, {
    calorie_goal: 2100,
    protein_goal: 120,
    fat_goal: 70,
    carb_goal: 250,
    water_goal: 8,
    water_unit: "cups",
    water_goal_ml: 2000,
    movement_goal: 60,
    sleep_goal_minutes: 480
  });
  const normalized: WellnessGoals = {
    calorie_goal: Math.max(1000, Math.round(seeded.calorie_goal ?? 2100)),
    protein_goal: Math.max(10, roundOne(Number(seeded.protein_goal ?? 120))),
    fat_goal: Math.max(10, roundOne(Number(seeded.fat_goal ?? 70))),
    carb_goal: Math.max(10, roundOne(Number(seeded.carb_goal ?? 250))),
    water_goal: Math.max(1, Math.round(seeded.water_goal ?? 8)),
    water_unit: seeded.water_unit === "ml" ? "ml" : "cups",
    water_goal_ml: Math.max(
      WATER_ML_PER_CUP,
      Math.round(seeded.water_goal_ml ?? Math.max(1, Math.round(seeded.water_goal ?? 8)) * WATER_ML_PER_CUP)
    ),
    movement_goal: Math.max(10, Math.round(seeded.movement_goal ?? 60)),
    sleep_goal_minutes: Math.max(120, Math.round(seeded.sleep_goal_minutes ?? 480))
  };
  writeJSON(STORAGE_KEYS.goals, normalized);
  return normalized;
}

export function setWellnessGoals(next: Partial<WellnessGoals>) {
  const current = getWellnessGoals();
  const nextWaterGoal = Math.max(1, Math.round(next.water_goal ?? current.water_goal));
  const nextWaterGoalMl = Math.max(
    WATER_ML_PER_CUP,
    Math.round(
      next.water_goal_ml
      ?? (next.water_goal !== undefined
        ? nextWaterGoal * WATER_ML_PER_CUP
        : current.water_goal_ml ?? current.water_goal * WATER_ML_PER_CUP)
    )
  );
  const nextWaterUnit = next.water_unit === "ml" ? "ml" : next.water_unit === "cups" ? "cups" : (current.water_unit ?? "cups");

  writeJSON(STORAGE_KEYS.goals, {
    ...current,
    ...next,
    calorie_goal: Math.max(1000, Math.round(next.calorie_goal ?? current.calorie_goal)),
    protein_goal: Math.max(10, roundOne(Number(next.protein_goal ?? current.protein_goal))),
    fat_goal: Math.max(10, roundOne(Number(next.fat_goal ?? current.fat_goal))),
    carb_goal: Math.max(10, roundOne(Number(next.carb_goal ?? current.carb_goal))),
    water_goal: nextWaterGoal,
    water_unit: nextWaterUnit,
    water_goal_ml: nextWaterGoalMl,
    movement_goal: Math.max(10, Math.round(next.movement_goal ?? current.movement_goal)),
    sleep_goal_minutes: Math.max(120, Math.round(next.sleep_goal_minutes ?? current.sleep_goal_minutes))
  });
}

export function getFoodLogs(): FoodLog[] {
  cleanupLegacySeedDataOnce();
  const seeded = ensureSeeded<FoodLog[]>(STORAGE_KEYS.food, seedFoodLogs());
  const normalized = seeded.map((item) => {
    const calories = Math.max(0, Math.round(Number(item.calories ?? 0)));
    const protein = Math.max(0, roundOne(Number(item.protein ?? 0)));
    const fat = Math.max(0, roundOne(Number(item.fat ?? 0)));
    const carbs = Math.max(0, roundOne(Number(item.carbs ?? 0)));
    const grams = Math.max(1, Math.round(Number(item.grams ?? 0) || 100));
    const ingredientsRaw = (item as { ingredients?: unknown }).ingredients;
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
  const ingredientsRaw = (input as { ingredients?: unknown }).ingredients;
  const normalizedIngredients = Array.isArray(ingredientsRaw)
    ? ingredientsRaw.map((token) => String(token).trim()).filter(Boolean)
    : typeof ingredientsRaw === "string"
      ? ingredientsRaw
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
  cleanupLegacySeedDataOnce();
  const seeded = ensureSeeded<WorkoutLog[]>(STORAGE_KEYS.workout, seedWorkoutLogs());
  const normalized = seeded.map((item) => ({
    ...item,
    routine_id: typeof item.routine_id === "string" && item.routine_id.trim() ? item.routine_id.trim() : undefined,
    title: String(item.title ?? "Workout").trim() || "Workout",
    start_time: String(item.start_time ?? "07:00").trim() || "07:00",
    duration: Math.max(5, Math.round(item.duration ?? 20)),
    intensity: item.intensity ?? "medium",
    calories_burned: Math.max(0, Math.round(item.calories_burned ?? 0)),
    steps: Math.max(0, Math.round(item.steps ?? 0)),
    location: String(item.location ?? "").trim() || "Custom",
    fatigue: Math.max(0, Math.min(5, Math.round(item.fatigue ?? 2))),
    note: String(item.note ?? "").trim(),
    mission_linked: Boolean(item.mission_linked),
    created_at: String(item.created_at ?? nowISO())
  }));
  return [...normalized].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

export function getWorkoutRoutines(): WorkoutRoutine[] {
  cleanupLegacySeedDataOnce();
  const seeded = ensureSeeded<WorkoutRoutine[]>(STORAGE_KEYS.workoutRoutines, seedWorkoutRoutines());
  const normalized = seeded.map((item) => ({
    id: item.id?.trim() || createId("routine"),
    title: String(item.title ?? "Custom Routine").trim() || "Custom Routine",
    workout_type: item.workout_type ?? "Custom",
    duration: Math.max(5, Math.round(item.duration ?? 20)),
    intensity: item.intensity ?? "medium",
    location: String(item.location ?? "").trim() || "Custom",
    steps: Math.max(0, Math.round(item.steps ?? 0)),
    calories_hint: Math.max(0, Math.round(item.calories_hint ?? 0)),
    is_favorite: Boolean(item.is_favorite),
    use_count: Math.max(0, Math.round(item.use_count ?? 0)),
    last_used_at: String(item.last_used_at ?? item.created_at ?? nowISO()),
    created_at: String(item.created_at ?? nowISO())
  }));
  return [...normalized].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    if (a.use_count !== b.use_count) return b.use_count - a.use_count;
    return a.last_used_at > b.last_used_at ? -1 : 1;
  });
}

export function saveWorkoutRoutines(next: WorkoutRoutine[]) {
  writeJSON(STORAGE_KEYS.workoutRoutines, next);
}

export function upsertWorkoutRoutine(input: Partial<WorkoutRoutine> & { title: string; workout_type: WorkoutType }): WorkoutRoutine {
  const routines = getWorkoutRoutines();
  const next: WorkoutRoutine = {
    id: input.id?.trim() || createId("routine"),
    title: String(input.title ?? "").trim() || "Custom Routine",
    workout_type: input.workout_type,
    duration: Math.max(5, Math.round(input.duration ?? 20)),
    intensity: input.intensity ?? "medium",
    location: String(input.location ?? "").trim() || "Custom",
    steps: Math.max(0, Math.round(input.steps ?? 0)),
    calories_hint: Math.max(0, Math.round(input.calories_hint ?? 0)),
    is_favorite: Boolean(input.is_favorite),
    use_count: Math.max(0, Math.round(input.use_count ?? 0)),
    last_used_at: input.last_used_at ?? nowISO(),
    created_at: input.created_at ?? nowISO()
  };
  const filtered = routines.filter((item) => item.id !== next.id);
  saveWorkoutRoutines([next, ...filtered]);
  return next;
}

export function toggleWorkoutRoutineFavorite(id: string) {
  const routines = getWorkoutRoutines();
  const next = routines.map((item) => (item.id === id ? { ...item, is_favorite: !item.is_favorite } : item));
  saveWorkoutRoutines(next);
}

export function touchWorkoutRoutineUsage(id: string) {
  const routines = getWorkoutRoutines();
  const next = routines.map((item) =>
    item.id === id
      ? {
          ...item,
          use_count: item.use_count + 1,
          last_used_at: nowISO()
        }
      : item
  );
  saveWorkoutRoutines(next);
}

export function removeWorkoutRoutine(id: string) {
  const routines = getWorkoutRoutines();
  saveWorkoutRoutines(routines.filter((item) => item.id !== id));
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
    routine_id: input.routine_id?.trim() || undefined,
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
  cleanupLegacySeedDataOnce();
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
  cleanupLegacySeedDataOnce();
  const seeded = ensureSeeded<FocusSession[]>(STORAGE_KEYS.focus, seedFocusSessions());
  return [...seeded].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

export function saveFocusSessions(next: FocusSession[]) {
  writeJSON(STORAGE_KEYS.focus, next);
}

export function getWaterMap(): WaterMap {
  cleanupLegacySeedDataOnce();
  return ensureSeeded<WaterMap>(STORAGE_KEYS.waterMap, {});
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

function getFoodManualCaloriesMap(): DailyCaloriesMap {
  const raw = ensureSeeded<DailyCaloriesMap>(STORAGE_KEYS.foodManualCalories, {});
  const normalized: DailyCaloriesMap = {};
  Object.entries(raw).forEach(([date, value]) => {
    const next = Math.max(0, Math.round(Number(value) || 0));
    if (next > 0) normalized[date] = next;
  });
  writeJSON(STORAGE_KEYS.foodManualCalories, normalized);
  return normalized;
}

function getFoodManualMacroMap(): DailyMacroMap {
  const raw = ensureSeeded<DailyMacroMap>(STORAGE_KEYS.foodManualMacros, {});
  const normalized: DailyMacroMap = {};
  Object.entries(raw).forEach(([date, value]) => {
    const source = value ?? {};
    const protein = Math.max(0, roundOne(Number(source.protein ?? 0)));
    const fat = Math.max(0, roundOne(Number(source.fat ?? 0)));
    const carbs = Math.max(0, roundOne(Number(source.carbs ?? 0)));
    if (protein > 0 || fat > 0 || carbs > 0) {
      normalized[date] = { protein, fat, carbs };
    }
  });
  writeJSON(STORAGE_KEYS.foodManualMacros, normalized);
  return normalized;
}

function getWorkoutManualCaloriesMap(): DailyCaloriesMap {
  const raw = ensureSeeded<DailyCaloriesMap>(STORAGE_KEYS.workoutManualCalories, {});
  const normalized: DailyCaloriesMap = {};
  Object.entries(raw).forEach(([date, value]) => {
    const next = Math.max(0, Math.round(Number(value) || 0));
    if (next > 0) normalized[date] = next;
  });
  writeJSON(STORAGE_KEYS.workoutManualCalories, normalized);
  return normalized;
}

export function getFoodManualCaloriesByDate(date: string): number {
  const map = getFoodManualCaloriesMap();
  return Math.max(0, Math.round(map[date] ?? 0));
}

export function setFoodManualCaloriesByDate(date: string, calories: number): number {
  const map = getFoodManualCaloriesMap();
  const normalized = Math.max(0, Math.round(calories));
  if (normalized <= 0) {
    delete map[date];
  } else {
    map[date] = normalized;
  }
  writeJSON(STORAGE_KEYS.foodManualCalories, map);
  return normalized;
}

export function getFoodManualMacrosByDate(date: string): { protein: number; fat: number; carbs: number } {
  const map = getFoodManualMacroMap();
  const source = map[date] ?? { protein: 0, fat: 0, carbs: 0 };
  return {
    protein: Math.max(0, roundOne(Number(source.protein ?? 0))),
    fat: Math.max(0, roundOne(Number(source.fat ?? 0))),
    carbs: Math.max(0, roundOne(Number(source.carbs ?? 0)))
  };
}

export function setFoodManualMacrosByDate(
  date: string,
  macros: { protein: number; fat: number; carbs: number }
): { protein: number; fat: number; carbs: number } {
  const map = getFoodManualMacroMap();
  const normalized = {
    protein: Math.max(0, roundOne(Number(macros.protein ?? 0))),
    fat: Math.max(0, roundOne(Number(macros.fat ?? 0))),
    carbs: Math.max(0, roundOne(Number(macros.carbs ?? 0)))
  };

  if (normalized.protein <= 0 && normalized.fat <= 0 && normalized.carbs <= 0) {
    delete map[date];
  } else {
    map[date] = normalized;
  }

  writeJSON(STORAGE_KEYS.foodManualMacros, map);
  return normalized;
}

export function getWorkoutManualCaloriesByDate(date: string): number {
  const map = getWorkoutManualCaloriesMap();
  return Math.max(0, Math.round(map[date] ?? 0));
}

export function setWorkoutManualCaloriesByDate(date: string, calories: number): number {
  const map = getWorkoutManualCaloriesMap();
  const normalized = Math.max(0, Math.round(calories));
  if (normalized <= 0) {
    delete map[date];
  } else {
    map[date] = normalized;
  }
  writeJSON(STORAGE_KEYS.workoutManualCalories, map);
  return normalized;
}

export function getFoodSummary(date: string) {
  const logs = getFoodLogs().filter((item) => item.date === date);
  const goals = getWellnessGoals();
  const waterMap = getWaterMap();
  const manualCalories = getFoodManualCaloriesByDate(date);
  const manualMacros = getFoodManualMacrosByDate(date);
  const calories = logs.reduce((sum, item) => sum + item.calories, 0) + manualCalories;
  const protein = roundOne(logs.reduce((sum, item) => sum + item.protein, 0) + manualMacros.protein);
  const fat = roundOne(logs.reduce((sum, item) => sum + item.fat, 0) + manualMacros.fat);
  const carbs = roundOne(logs.reduce((sum, item) => sum + item.carbs, 0) + manualMacros.carbs);
  const cups = Math.max(0, Math.round(waterMap[date] ?? logs.reduce((sum, item) => sum + item.water, 0)));
  const percent = goals.calorie_goal <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((calories / goals.calorie_goal) * 100)));
  return {
    calories,
    protein,
    fat,
    carbs,
    manualCalories,
    manualMacros,
    goals,
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
  const manualCalories = getWorkoutManualCaloriesByDate(date);
  const calories = logs.reduce((sum, item) => sum + item.calories_burned, 0) + manualCalories;
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
