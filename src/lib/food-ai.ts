import type { MealType } from "@/lib/wellness-storage";

export type FoodMacroPer100g = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type FoodReference = {
  id: string;
  name: string;
  aliases: string[];
  emoji: string;
  suggestedMeal: MealType;
  ingredients: string[];
  per100g: FoodMacroPer100g;
};

export type EstimatedFoodNutrition = {
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  ingredients: string[];
};

const FOOD_REFERENCE_DB: FoodReference[] = [
  {
    id: "chicken-breast",
    name: "Chicken Breast",
    aliases: ["chicken", "닭가슴살", "닭", "grilled chicken"],
    emoji: "🍗",
    suggestedMeal: "Lunch",
    ingredients: ["Chicken breast", "Salt", "Pepper"],
    per100g: { calories: 165, protein: 31, fat: 3.6, carbs: 0 }
  },
  {
    id: "salmon",
    name: "Salmon",
    aliases: ["salmon fillet", "연어", "grilled salmon"],
    emoji: "🐟",
    suggestedMeal: "Dinner",
    ingredients: ["Salmon", "Olive oil", "Salt", "Pepper"],
    per100g: { calories: 208, protein: 20, fat: 13, carbs: 0 }
  },
  {
    id: "brown-rice",
    name: "Brown Rice",
    aliases: ["rice", "현미밥", "brown rice bowl", "밥"],
    emoji: "🍚",
    suggestedMeal: "Lunch",
    ingredients: ["Brown rice"],
    per100g: { calories: 111, protein: 2.6, fat: 0.9, carbs: 23 }
  },
  {
    id: "white-rice",
    name: "White Rice",
    aliases: ["쌀밥", "rice"],
    emoji: "🍚",
    suggestedMeal: "Lunch",
    ingredients: ["Rice"],
    per100g: { calories: 130, protein: 2.4, fat: 0.2, carbs: 28.7 }
  },
  {
    id: "kimchi-fried-rice",
    name: "Kimchi Fried Rice",
    aliases: ["볶음밥", "kimchi rice", "김치볶음밥"],
    emoji: "🍳",
    suggestedMeal: "Lunch",
    ingredients: ["Rice", "Kimchi", "Egg", "Oil", "Vegetables"],
    per100g: { calories: 180, protein: 5.4, fat: 6.5, carbs: 25 }
  },
  {
    id: "bibimbap",
    name: "Bibimbap",
    aliases: ["비빔밥", "korean bowl"],
    emoji: "🥗",
    suggestedMeal: "Lunch",
    ingredients: ["Rice", "Vegetables", "Egg", "Gochujang", "Sesame oil"],
    per100g: { calories: 140, protein: 4.3, fat: 3.8, carbs: 22 }
  },
  {
    id: "ramen",
    name: "Ramen",
    aliases: ["ramyun", "라면", "instant noodle", "noodle soup"],
    emoji: "🍜",
    suggestedMeal: "Dinner",
    ingredients: ["Noodles", "Broth", "Seasoning", "Oil"],
    per100g: { calories: 436, protein: 9, fat: 17, carbs: 63 }
  },
  {
    id: "oatmeal",
    name: "Oatmeal",
    aliases: ["oats", "오트밀", "overnight oats"],
    emoji: "🥣",
    suggestedMeal: "Breakfast",
    ingredients: ["Rolled oats", "Milk", "Banana", "Nuts"],
    per100g: { calories: 68, protein: 2.4, fat: 1.4, carbs: 12 }
  },
  {
    id: "greek-yogurt",
    name: "Greek Yogurt",
    aliases: ["요거트", "yogurt", "그릭요거트"],
    emoji: "🥛",
    suggestedMeal: "Breakfast",
    ingredients: ["Milk", "Cultures"],
    per100g: { calories: 97, protein: 10, fat: 5, carbs: 3.6 }
  },
  {
    id: "egg",
    name: "Egg",
    aliases: ["달걀", "계란", "boiled egg", "scrambled egg"],
    emoji: "🥚",
    suggestedMeal: "Breakfast",
    ingredients: ["Egg"],
    per100g: { calories: 155, protein: 13, fat: 11, carbs: 1.1 }
  },
  {
    id: "banana",
    name: "Banana",
    aliases: ["바나나"],
    emoji: "🍌",
    suggestedMeal: "Snack",
    ingredients: ["Banana"],
    per100g: { calories: 89, protein: 1.1, fat: 0.3, carbs: 23 }
  },
  {
    id: "apple",
    name: "Apple",
    aliases: ["사과"],
    emoji: "🍎",
    suggestedMeal: "Snack",
    ingredients: ["Apple"],
    per100g: { calories: 52, protein: 0.3, fat: 0.2, carbs: 14 }
  },
  {
    id: "almond",
    name: "Almond",
    aliases: ["almonds", "아몬드", "nuts"],
    emoji: "🌰",
    suggestedMeal: "Snack",
    ingredients: ["Almond", "Sea salt"],
    per100g: { calories: 579, protein: 21, fat: 50, carbs: 22 }
  },
  {
    id: "tofu",
    name: "Tofu",
    aliases: ["두부", "tofu bowl"],
    emoji: "🧊",
    suggestedMeal: "Dinner",
    ingredients: ["Soybeans", "Water", "Nigari"],
    per100g: { calories: 76, protein: 8, fat: 4.8, carbs: 1.9 }
  },
  {
    id: "sweet-potato",
    name: "Sweet Potato",
    aliases: ["고구마", "sweet potato"],
    emoji: "🍠",
    suggestedMeal: "Snack",
    ingredients: ["Sweet potato"],
    per100g: { calories: 86, protein: 1.6, fat: 0.1, carbs: 20.1 }
  },
  {
    id: "steak",
    name: "Beef Steak",
    aliases: ["steak", "beef", "소고기", "beef steak"],
    emoji: "🥩",
    suggestedMeal: "Dinner",
    ingredients: ["Beef", "Butter", "Salt", "Pepper"],
    per100g: { calories: 271, protein: 25, fat: 19, carbs: 0 }
  },
  {
    id: "avocado-toast",
    name: "Avocado Toast",
    aliases: ["아보카도 토스트", "toast"],
    emoji: "🥑",
    suggestedMeal: "Breakfast",
    ingredients: ["Bread", "Avocado", "Olive oil", "Salt"],
    per100g: { calories: 210, protein: 5.2, fat: 11, carbs: 23 }
  },
  {
    id: "protein-shake",
    name: "Protein Shake",
    aliases: ["protein shake", "단백질 쉐이크", "shake"],
    emoji: "🥤",
    suggestedMeal: "Snack",
    ingredients: ["Whey protein", "Milk", "Banana"],
    per100g: { calories: 95, protein: 13, fat: 2, carbs: 7 }
  },
  {
    id: "salad",
    name: "Chicken Salad",
    aliases: ["salad", "샐러드", "치킨 샐러드"],
    emoji: "🥗",
    suggestedMeal: "Lunch",
    ingredients: ["Lettuce", "Chicken", "Tomato", "Olive oil"],
    per100g: { calories: 120, protein: 8, fat: 6, carbs: 9 }
  }
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u3131-\uD79D\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreFoodQuery(item: FoodReference, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(item.name);
  const aliases = item.aliases.map((token) => normalize(token));
  if (name === q) return 120;
  if (aliases.includes(q)) return 110;
  if (name.startsWith(q)) return 90;
  if (aliases.some((token) => token.startsWith(q))) return 80;
  if (name.includes(q)) return 70;
  if (aliases.some((token) => token.includes(q))) return 60;

  const queryTokens = q.split(" ");
  let tokenScore = 0;
  for (const token of queryTokens) {
    if (!token) continue;
    if (name.includes(token)) tokenScore += 8;
    if (aliases.some((alias) => alias.includes(token))) tokenScore += 6;
  }
  return tokenScore;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function searchFoodReferences(query: string, limit = 10): FoodReference[] {
  const q = query.trim();
  if (!q) return FOOD_REFERENCE_DB.slice(0, limit);

  return [...FOOD_REFERENCE_DB]
    .map((item) => ({ item, score: scoreFoodQuery(item, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}

export function estimateNutritionFromReference(food: FoodReference, grams: number): EstimatedFoodNutrition {
  const safeGrams = Math.max(1, Math.round(grams));
  const ratio = safeGrams / 100;
  return {
    grams: safeGrams,
    calories: Math.round(food.per100g.calories * ratio),
    protein: roundOne(food.per100g.protein * ratio),
    fat: roundOne(food.per100g.fat * ratio),
    carbs: roundOne(food.per100g.carbs * ratio),
    ingredients: food.ingredients
  };
}

function keywordMacroBase(query: string): FoodMacroPer100g {
  const q = normalize(query);
  if (q.includes("salad") || q.includes("샐러드")) return { calories: 90, protein: 5, fat: 4, carbs: 9 };
  if (q.includes("chicken") || q.includes("닭")) return { calories: 165, protein: 30, fat: 4, carbs: 1 };
  if (q.includes("beef") || q.includes("소고기") || q.includes("steak")) return { calories: 250, protein: 24, fat: 17, carbs: 1 };
  if (q.includes("rice") || q.includes("밥")) return { calories: 130, protein: 2.5, fat: 0.5, carbs: 28 };
  if (q.includes("bread") || q.includes("빵") || q.includes("toast")) return { calories: 250, protein: 8, fat: 3, carbs: 50 };
  if (q.includes("noodle") || q.includes("ramen") || q.includes("라면")) return { calories: 220, protein: 6, fat: 7, carbs: 33 };
  if (q.includes("fruit") || q.includes("사과") || q.includes("banana")) return { calories: 75, protein: 1, fat: 0.3, carbs: 18 };
  return { calories: 140, protein: 7, fat: 5, carbs: 18 };
}

export function estimateNutritionFromText(query: string, grams: number): EstimatedFoodNutrition {
  const safeGrams = Math.max(1, Math.round(grams));
  const per100 = keywordMacroBase(query);
  const ratio = safeGrams / 100;
  return {
    grams: safeGrams,
    calories: Math.round(per100.calories * ratio),
    protein: roundOne(per100.protein * ratio),
    fat: roundOne(per100.fat * ratio),
    carbs: roundOne(per100.carbs * ratio),
    ingredients: [query.trim() || "Mixed ingredients", "AI-estimated composition"]
  };
}

