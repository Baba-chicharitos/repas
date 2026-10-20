import { calculateRecipeNutrition, formatNutritionBadge } from "./nutrition";
import { NUTRIENTS, type Recipe } from "./types";

const labels = {
  energyKcal: "Calories",
  proteinG: "Protéines",
  carbohydrateG: "Glucides",
  fatG: "Lipides",
};

// Card-only presentation: one reference serving, independent of selected quantities.
export function NutritionSummary({ recipe }: { recipe: Recipe }) {
  const values = calculateRecipeNutrition(recipe).perPortion;
  const generic = recipe.ingredients.some(
    (ingredient) => ingredient.ingredientOptionId,
  );
  const approximate =
    generic ||
    recipe.ingredients.some(
      (ingredient) =>
        ingredient.quantity > 0 &&
        ingredient.unit !== "g" &&
        ingredient.unit !== "kg",
    );
  return (
    <dl
      className="nutrition-summary nutrition-badges"
      aria-label="Nutrition par portion de référence"
    >
      {NUTRIENTS.map((key) => {
        const value = values[key];
        const display = formatNutritionBadge(value, approximate);
        return (
          <div
            key={key}
            className={`nutrition-badge nutrition-${key}`}
            title={
              value.issues.length
                ? "Calcul incomplet : ingrédient ou conversion manquant."
                : value.traceCount
                  ? "Présence de traces non quantifiées."
                  : value.boundedCount
                    ? "Valeur indicative issue d’un seuil Ciqual."
                    : approximate
                      ? "Valeur approximative : conversion de masse ou profil générique."
                      : undefined
            }
          >
            <dt>{labels[key]}</dt>
            <dd>
              {display}
              {display !== "—" && (
                <span> {key === "energyKcal" ? "kcal" : "g"}</span>
              )}
            </dd>
            {generic && key === "energyKcal" && (
              <small className="nutrition-generic">Profil générique</small>
            )}
          </div>
        );
      })}
    </dl>
  );
}
