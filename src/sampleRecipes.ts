import { reconcileSession } from "./domain";
import type { AppState, Category, Ingredient, Recipe, Unit } from "./types";

type SampleIngredient = [string, number, Unit, Category];
function sample(
  id: string,
  name: string,
  referencePortions: number,
  calories: number,
  rows: SampleIngredient[],
): Recipe {
  return {
    id: `essai-${id}`,
    name,
    referencePortions,
    calories,
    ingredients: rows.map(
      ([name, quantity, unit, category], index): Ingredient => ({
        id: `essai-${id}-${index}`,
        name,
        quantity,
        unit,
        category,
      }),
    ),
  };
}

// Deliberately opt-in. Calorie values are illustrative test data.
export const SAMPLE_RECIPES: Recipe[] = [
  sample("carbonara", "Carbonara", 2, 650, [
    ["Pâtes", 200, "g", "Féculents"],
    ["Lardons", 150, "g", "Viandes et poissons"],
    ["Œufs", 2, "unité", "Produits frais"],
    ["Parmesan", 40, "g", "Produits frais"],
  ]),
  sample("poulet-riz", "Poulet au riz", 2, 520, [
    ["Poulet", 300, "g", "Viandes et poissons"],
    ["Riz", 160, "g", "Féculents"],
    ["Oignons", 1, "unité", "Fruits et légumes"],
    ["Huile d’olive", 1, "c. à soupe", "Épicerie"],
  ]),
  sample("lasagnes", "Lasagnes", 4, 610, [
    ["Bœuf haché", 500, "g", "Viandes et poissons"],
    ["Feuilles de lasagnes", 250, "g", "Féculents"],
    ["Tomates", 0.5, "kg", "Fruits et légumes"],
    ["Lait", 0.5, "L", "Produits frais"],
    ["Farine", 40, "g", "Épicerie"],
    ["Beurre", 40, "g", "Produits frais"],
    ["Parmesan", 80, "g", "Produits frais"],
  ]),
  sample("salade-pates", "Salade de pâtes", 2, 430, [
    [" pâtes ", 200, "g", "Féculents"],
    ["Tomates", 250, "g", "Fruits et légumes"],
    ["Mozzarella", 125, "g", "Produits frais"],
    ["Huile d’olive", 1, "c. à soupe", "Épicerie"],
  ]),
  sample("curry", "Curry de pois chiches", 2, 490, [
    ["Pois chiches", 400, "g", "Épicerie"],
    ["Lait de coco", 200, "ml", "Épicerie"],
    ["RIZ", 160, "g", "Féculents"],
    ["Oignons", 1, "unité", "Fruits et légumes"],
    ["Curry", 2, "c. à café", "Épicerie"],
    ["Épinards", 200, "g", "Surgelés"],
  ]),
  sample("saumon", "Saumon et pommes de terre", 2, 560, [
    ["Saumon", 300, "g", "Viandes et poissons"],
    ["Pommes de terre", 0.5, "kg", "Fruits et légumes"],
    ["Citron", 1, "unité", "Fruits et légumes"],
    ["Beurre", 20, "g", "Produits frais"],
  ]),
  sample("omelette", "Omelette aux légumes", 2, 340, [
    ["Œufs", 4, "unité", "Produits frais"],
    ["Tomates", 200, "g", "Fruits et légumes"],
    ["Oignons", 1, "unité", "Fruits et légumes"],
    ["Parmesan", 30, "g", "Produits frais"],
    ["Huile d’olive", 1, "c. à soupe", "Épicerie"],
  ]),
  sample("soupe", "Soupe de légumes", 4, 220, [
    ["Carottes", 500, "g", "Fruits et légumes"],
    ["Pommes de terre", 400, "g", "Fruits et légumes"],
    ["Oignons", 2, "unité", "Fruits et légumes"],
    ["Eau", 1, "L", "Boissons"],
    ["Crème fraîche", 100, "ml", "Produits frais"],
  ]),
];

export function addSampleRecipes(state: AppState): AppState {
  const existing = new Set(state.recipes.map((r) => r.id));
  const recipes = [
    ...state.recipes,
    ...structuredClone(SAMPLE_RECIPES.filter((r) => !existing.has(r.id))),
  ];
  return {
    ...state,
    recipes,
    session: reconcileSession(state.session, recipes),
  };
}
