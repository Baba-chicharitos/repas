import type { Ingredient } from "./types";

export function IngredientMassField({
  ingredient,
  onChange,
}: {
  ingredient: Omit<Ingredient, "quantity">;
  onChange: (change: Partial<Ingredient>) => void;
}) {
  if (ingredient.unit === "g" || ingredient.unit === "kg") return null;
  return (
    <label className="field ingredient-mass">
      Grammes pour 1 {ingredient.unit}
      <input
        type="number"
        min="0.000001"
        max="1000000"
        step="any"
        inputMode="decimal"
        value={ingredient.gramsPerUnit ?? ""}
        placeholder="Masse comestible en g"
        onChange={(event) =>
          onChange({
            gramsPerUnit:
              event.target.value === ""
                ? undefined
                : Number(event.target.value),
          })
        }
      />
      <small>
        Masse de cet ingrédient pour une {ingredient.unit}.
        {ingredient.unit === "L" ? " Indiquez la masse d’un litre." : ""}
      </small>
    </label>
  );
}
