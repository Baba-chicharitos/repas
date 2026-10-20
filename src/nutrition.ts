import { getCiqualFood } from "./ciqual";
import {
  NUTRIENTS,
  type CiqualFood,
  type Ingredient,
  type NutrientKey,
  type NutrientTotal,
  type NutritionIssue,
  type Recipe,
  type RecipeNutrition,
} from "./types";

export function ingredientMass(ingredient: Ingredient): number | null {
  if (!Number.isFinite(ingredient.quantity) || ingredient.quantity < 0)
    return null;
  if (ingredient.quantity === 0) return 0;
  const factor =
    ingredient.unit === "g"
      ? 1
      : ingredient.unit === "kg"
        ? 1000
        : ingredient.gramsPerUnit;
  if (factor === undefined || !Number.isFinite(factor) || factor <= 0)
    return null;
  const mass = ingredient.quantity * factor;
  return Number.isFinite(mass) ? mass : null;
}
const emptyTotal = (): NutrientTotal => ({
  lower: 0,
  upper: 0,
  knownCount: 0,
  boundedCount: 0,
  traceCount: 0,
  issues: [],
});
const scale = (totals: Record<NutrientKey, NutrientTotal>, factor: number) =>
  Object.fromEntries(
    NUTRIENTS.map((key) => [
      key,
      {
        ...totals[key],
        lower: totals[key].lower * factor,
        upper: totals[key].upper === null ? null : totals[key].upper * factor,
      },
    ]),
  ) as Record<NutrientKey, NutrientTotal>;

export function calculateRecipeNutrition(
  recipe: Recipe,
  selectedPortions = recipe.referencePortions,
  lookup: (code?: string) => CiqualFood | undefined = getCiqualFood,
): RecipeNutrition {
  if (
    !Number.isInteger(recipe.referencePortions) ||
    recipe.referencePortions <= 0 ||
    !Number.isInteger(selectedPortions) ||
    selectedPortions <= 0
  )
    throw new Error(
      "Les portions nutritionnelles doivent être des entiers positifs.",
    );
  const total = Object.fromEntries(
    NUTRIENTS.map((key) => [key, emptyTotal()]),
  ) as Record<NutrientKey, NutrientTotal>;
  for (const ingredient of recipe.ingredients) {
    // Zero quantity contributes exactly zero even without an association.
    if (ingredient.quantity === 0) continue;
    const food = lookup(ingredient.ciqualCode);
    const mass = ingredientMass(ingredient);
    let reason: NutritionIssue["reason"] | undefined;
    if (!Number.isFinite(ingredient.quantity) || ingredient.quantity < 0)
      reason = "invalid_quantity";
    else if (!ingredient.ciqualCode) reason = "unlinked";
    else if (!food) reason = "unknown_food";
    else if (mass === null) reason = "mass_required";
    for (const key of NUTRIENTS) {
      const result = total[key];
      const nutrient = food?.per100g[key];
      if (reason || nutrient?.qualifier === "missing") {
        result.issues.push({
          ingredientId: ingredient.id,
          name: ingredient.name,
          reason: reason ?? "missing",
        });
        result.upper = null;
      } else if (nutrient?.qualifier === "trace") {
        result.traceCount++;
        result.upper = null; // No quantitative threshold is published for traces.
      } else if (nutrient && mass !== null && nutrient.value !== null) {
        const amount = (mass * nutrient.value) / 100;
        if (nutrient.qualifier === "numeric") {
          result.lower += amount;
          result.knownCount++;
        } else result.boundedCount++;
        if (result.upper !== null) result.upper += amount;
      }
    }
  }
  return {
    total,
    perPortion: scale(total, 1 / recipe.referencePortions),
    selected: scale(total, selectedPortions / recipe.referencePortions),
    selectedPortions,
  };
}

const number = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
// Round bounds outward so a displayed '<' never narrows the source interval.
const upperNumber = (n: number) => number(Math.ceil(n * 100) / 100);
export function formatNutrient(total: NutrientTotal): string {
  const hasValues = total.knownCount > 0 || total.boundedCount > 0;
  if (total.issues.length && !hasValues && !total.traceCount)
    return "Indisponible";
  let label: string;
  if (!hasValues && total.traceCount) label = "Traces";
  else if (total.boundedCount && total.upper !== null)
    label =
      total.lower === 0
        ? `< ${upperNumber(total.upper)}`
        : `${number(Math.floor(total.lower * 100) / 100)} à < ${upperNumber(total.upper)}`;
  else {
    label = number(total.lower);
    if (total.boundedCount) label += " + seuils";
    if (total.traceCount) label += " + traces";
  }
  return total.issues.length ? `${label} (partiel)` : label;
}

// Compact card display only; keep precise values and qualifiers in the model.
export function formatNutritionBadge(
  total: NutrientTotal,
  approximate = false,
): string {
  if (
    total.issues.length ||
    (!total.knownCount && !total.boundedCount && total.traceCount)
  )
    return "—";
  const value =
    total.boundedCount && total.upper !== null ? total.upper : total.lower;
  const uncertain =
    approximate || total.boundedCount > 0 || total.traceCount > 0;
  return `${uncertain ? "~" : ""}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.ceil(value))}`;
}
