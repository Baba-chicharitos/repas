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
