export const CATEGORIES = [
  "Fruits et légumes",
  "Viandes et poissons",
  "Produits frais",
  "Féculents",
  "Épicerie",
  "Surgelés",
  "Boissons",
  "Autres",
] as const;
export const UNITS = [
  "g",
  "kg",
  "ml",
  "L",
  "unité",
  "c. à soupe",
  "c. à café",
  "pincée",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Unit = (typeof UNITS)[number];
export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  ciqualCode?: string;
  ingredientOptionId?: string;
  gramsPerUnit?: number;
}
export interface Recipe {
  id: string;
  name: string;
  referencePortions: number;
  calories?: number;
  imageId?: string;
  ingredients: Ingredient[];
}
export interface SelectedMeal {
  id: string;
  recipeId: string;
  meals: number;
  portions: number;
}
export interface SelectionSession {
  started: boolean;
  target: number;
  people: number;
  selected: SelectedMeal[];
  queue: string[];
  seen: string[];
}
export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  checked: boolean;
}
export interface ShoppingList {
  generatedAt: string;
  meals: number;
  portions: number;
  dishes: { name: string; meals: number; portions: number }[];
  items: ShoppingItem[];
}
export interface Settings {
  showCalories: boolean;
}
export interface AppState {
  version: 1;
  recipes: Recipe[];
  session: SelectionSession;
  settings: Settings;
  list: ShoppingList | null;
}

export type NutrientQualifier = "numeric" | "less_than" | "trace" | "missing";
export interface NutrientValue {
  value: number | null;
  qualifier: NutrientQualifier;
  raw: string | null;
}
export const NUTRIENTS = [
  "energyKcal",
  "proteinG",
  "carbohydrateG",
  "fatG",
] as const;
export type NutrientKey = (typeof NUTRIENTS)[number];
export interface CiqualFood {
  ciqualCode: string;
  nameFr: string;
  aliases: string[];
  per100g: Record<NutrientKey, NutrientValue>;
  isIngredientCandidate?: boolean;
  ingredientFamily?: string;
  variantLabel?: string;
  category?: Category;
  searchPriority?: number;
}
export interface IngredientFamily {
  id: string;
  label: string;
  aliases: string[];
  ciqualCodes: string[];
}
export interface IngredientOption {
  id: string;
  label: string;
  ingredientFamily: string;
  ciqualCode: string;
  nutritionReference: "generic_equivalent";
  nutritionReferenceLabel: string;
  isExactCiqualEntry: false;
  searchAliases: string[];
  category: Category;
  searchPriority?: number;
}
export interface IngredientSuggestion {
  id: string;
  label: string;
  family: string;
  variantLabel: string;
  food: CiqualFood;
  option?: IngredientOption;
  category?: Category;
  priority: number;
}
export interface IngredientSuggestionGroup {
  family: string;
  suggestions: IngredientSuggestion[];
}
export interface CiqualDatabase {
  schemaVersion: 1;
  source: {
    publisher: "Anses";
    table: "Ciqual";
    edition: "2025";
    sourceUrl: string;
    energyMethod: "EU_1169_2011";
    proteinMethod: "N_x_6.25";
  };
  foods: CiqualFood[];
  families?: IngredientFamily[];
  ingredientOptions?: IngredientOption[];
}
export interface NutritionIssue {
  ingredientId: string;
  name: string;
  reason:
    | "unlinked"
    | "unknown_food"
    | "mass_required"
    | "invalid_quantity"
    | "missing";
}
export interface NutrientTotal {
  lower: number;
  upper: number | null;
  knownCount: number;
  boundedCount: number;
  traceCount: number;
  issues: NutritionIssue[];
}
export interface RecipeNutrition {
  total: Record<NutrientKey, NutrientTotal>;
  perPortion: Record<NutrientKey, NutrientTotal>;
  selected: Record<NutrientKey, NutrientTotal>;
  selectedPortions: number;
}
