import { describe, expect, it } from "vitest";
import {
  calculateRecipeNutrition,
  formatNutrient,
  formatNutritionBadge,
  ingredientMass,
} from "../src/nutrition";
import type {
  CiqualFood,
  Ingredient,
  NutrientValue,
  Recipe,
  Unit,
} from "../src/types";

const numeric = (value: number): NutrientValue => ({
  value,
  qualifier: "numeric",
  raw: String(value),
});
const food: CiqualFood = {
  ciqualCode: "1",
  nameFr: "Aliment de test",
  aliases: [],
  per100g: {
    energyKcal: numeric(200),
    proteinG: numeric(10),
    carbohydrateG: numeric(25),
    fatG: numeric(6),
  },
};
const ingredient = (change: Partial<Ingredient> = {}): Ingredient => ({
  id: "i",
  name: "Ingrédient",
  quantity: 250,
  unit: "g",
  category: "Autres",
  ciqualCode: "1",
  ...change,
});
const recipe = (...ingredients: Ingredient[]): Recipe => ({
  id: "r",
  name: "Recette",
  referencePortions: 2,
  calories: 123,
  ingredients,
});
const lookup = (code?: string) => (code === "1" ? food : undefined);

describe("calcul nutritionnel", () => {
  it("arrondit les blocs vers le haut et marque les approximations sans inventer de valeurs inconnues", () => {
    const values = calculateRecipeNutrition(
      recipe(ingredient()),
      2,
      lookup,
    ).perPortion;
    expect(formatNutritionBadge(values.fatG)).toBe("8");
    expect(formatNutritionBadge(values.fatG, true)).toBe("~8");
    expect(
      formatNutritionBadge({
        ...values.fatG,
        lower: 0,
        upper: 0.25,
        knownCount: 0,
        boundedCount: 1,
      }),
    ).toBe("~1");
    expect(
      formatNutritionBadge({
        ...values.fatG,
        lower: 0,
        upper: null,
        knownCount: 0,
        traceCount: 1,
      }),
    ).toBe("—");
    expect(
      formatNutritionBadge({
        ...values.fatG,
        issues: [{ ingredientId: "i", name: "Inconnu", reason: "missing" }],
      }),
    ).toBe("—");
    expect(formatNutritionBadge({ ...values.fatG, lower: 0, upper: 0 })).toBe(
      "0",
    );
  });
  it("calcule les exemples fournis sans modifier les profils officiels ni inventer une composition spécifique", () => {
    expect(
      calculateRecipeNutrition(
        recipe(
          ingredient({
            quantity: 100,
            ciqualCode: "9810",
            ingredientOptionId: "pates-tagliatelles-crues",
          }),
        ),
      ).total.energyKcal.lower,
    ).toBe(364);
    expect(
      calculateRecipeNutrition(
        recipe(ingredient({ quantity: 100, ciqualCode: "20516" })),
      ).total.energyKcal.lower,
    ).toBe(350);
  });
  it("calcule les quatre valeurs de la recette, d’une portion et de 3, 5 ou 10 portions sans toucher aux calories manuelles", () => {
    const original = recipe(ingredient());
    for (const portions of [3, 5, 10]) {
      const result = calculateRecipeNutrition(original, portions, lookup);
      expect(result.total.energyKcal.lower).toBe(500);
      expect(result.total.proteinG.lower).toBe(25);
      expect(result.total.carbohydrateG.lower).toBe(62.5);
      expect(result.total.fatG.lower).toBe(15);
      expect(result.perPortion.energyKcal.lower).toBe(250);
      expect(result.selected.energyKcal.lower).toBe(250 * portions);
      expect(result.selected.fatG.lower).toBe(7.5 * portions);
      expect(result.total.energyKcal.upper).toBe(500);
    }
    expect(original.calories).toBe(123);
    expect(original.ingredients[0]).toEqual(ingredient());
  });
  it("additionne plusieurs ingrédients avec des quantités décimales sans arrondi intermédiaire", () => {
    const result = calculateRecipeNutrition(
      recipe(
        ingredient({ quantity: 0.1 }),
        ingredient({ id: "j", quantity: 0.2 }),
      ),
      2,
      lookup,
    );
    expect(result.total.energyKcal.lower).toBeCloseTo(0.6, 12);
    expect(result.perPortion.proteinG.lower).toBeCloseTo(0.015, 12);
  });
  it.each<[Unit, number, number | undefined, number]>([
    ["g", 25, undefined, 25],
    ["kg", 0.25, undefined, 250],
    ["ml", 20, 0.92, 18.4],
    ["L", 0.02, 920, 18.4],
    ["unité", 2, 50, 100],
    ["c. à soupe", 2, 12, 24],
    ["c. à café", 1.5, 4, 6],
    ["pincée", 2, 0.3, 0.6],
  ])(
    "convertit %s avec un facteur explicite",
    (unit, quantity, gramsPerUnit, mass) => {
      const row = ingredient({ unit, quantity, gramsPerUnit });
      expect(ingredientMass(row)).toBeCloseTo(mass, 12);
      expect(
        calculateRecipeNutrition(recipe(row), 2, lookup).total.energyKcal.lower,
      ).toBeCloseTo(mass * 2, 12);
    },
  );
  it.each<Unit>(["ml", "L", "unité", "c. à soupe", "c. à café", "pincée"])(
    "ne suppose jamais une masse pour %s",
    (unit) => {
      const result = calculateRecipeNutrition(
        recipe(ingredient({ unit })),
        2,
        lookup,
      );
      expect(result.total.energyKcal.upper).toBeNull();
      expect(result.total.energyKcal.issues[0]?.reason).toBe("mass_required");
      expect(formatNutrient(result.total.energyKcal)).toBe("Indisponible");
    },
  );
  it("signale les ingrédients non associés et les codes introuvables sans faire de correspondance par nom", () => {
    const result = calculateRecipeNutrition(
      recipe(
        ingredient(),
        ingredient({ id: "j", ciqualCode: undefined }),
        ingredient({ id: "k", ciqualCode: "999999" }),
      ),
      2,
      lookup,
    );
    expect(result.total.energyKcal.lower).toBe(500);
    expect(result.total.energyKcal.upper).toBeNull();
    expect(result.total.energyKcal.issues.map((i) => i.reason)).toEqual([
      "unlinked",
      "unknown_food",
    ]);
    expect(formatNutrient(result.total.energyKcal)).toBe("500 (partiel)");
  });
  it("traite une valeur manquante par nutriment sans perdre les trois autres", () => {
    const modified = structuredClone(food);
    modified.per100g.proteinG = { value: null, qualifier: "missing", raw: "-" };
    const result = calculateRecipeNutrition(
      recipe(ingredient()),
      2,
      () => modified,
    );
    expect(formatNutrient(result.total.proteinG)).toBe("Indisponible");
    expect(result.total.energyKcal.lower).toBe(500);
    expect(result.total.energyKcal.issues).toEqual([]);
  });
  it("conserve les seuils comme intervalles et les traces comme inconnues quantitatives", () => {
    const modified = structuredClone(food);
    modified.per100g.proteinG = {
      value: 0.5,
      qualifier: "less_than",
      raw: "< 0,5",
    };
    modified.per100g.fatG = { value: null, qualifier: "trace", raw: "traces" };
    const result = calculateRecipeNutrition(
      recipe(ingredient()),
      3,
      () => modified,
    );
    expect(result.total.proteinG.lower).toBe(0);
    expect(result.total.proteinG.upper).toBe(1.25);
    expect(formatNutrient(result.total.proteinG)).toBe("< 1,25");
    expect(formatNutrient(result.perPortion.proteinG)).toBe("< 0,63");
    expect(result.selected.proteinG.upper).toBe(1.875);
    expect(formatNutrient(result.total.fatG)).toBe("Traces");
    expect(result.total.fatG.upper).toBeNull();
  });
  it("additionne une valeur numérique et un seuil sans remplacer le seuil par sa borne", () => {
    const modified = structuredClone(food);
    modified.per100g.energyKcal = {
      value: 0.5,
      qualifier: "less_than",
      raw: "< 0,5",
    };
    const result = calculateRecipeNutrition(
      recipe(
        ingredient({ quantity: 100 }),
        ingredient({ id: "j", ciqualCode: "2", quantity: 100 }),
      ),
      2,
      (code) => (code === "2" ? modified : food),
    );
    expect(result.total.energyKcal.lower).toBe(200);
    expect(result.total.energyKcal.upper).toBe(200.5);
    expect(formatNutrient(result.total.energyKcal)).toBe("200 à < 200,5");
  });
  it("calcule une recette avec un aliment réel, y compris les traces de glucides de l’huile", () => {
    const result = calculateRecipeNutrition(
      recipe(
        ingredient({
          ciqualCode: "17270",
          quantity: 20,
          unit: "ml",
          gramsPerUnit: 0.92,
        }),
      ),
      3,
    );
    expect(result.total.energyKcal.lower).toBeCloseTo(165.416, 9);
    expect(result.perPortion.energyKcal.lower).toBeCloseTo(82.708, 9);
    expect(result.selected.energyKcal.lower).toBeCloseTo(248.124, 9);
    expect(result.total.fatG.lower).toBeCloseTo(18.3816, 9);
    expect(formatNutrient(result.total.carbohydrateG)).toBe("Traces");
  });
  it("ignore correctement une ligne de quantité nulle sans lui inventer de données", () => {
    const result = calculateRecipeNutrition(
      recipe(ingredient({ quantity: 0, ciqualCode: undefined, unit: "ml" })),
      2,
      lookup,
    );
    expect(result.total.energyKcal.issues).toEqual([]);
    expect(formatNutrient(result.total.energyKcal)).toBe("0");
  });
  it("refuse les portions invalides et signale les quantités invalides", () => {
    expect(() =>
      calculateRecipeNutrition({ ...recipe(), referencePortions: 0 }),
    ).toThrow();
    expect(() => calculateRecipeNutrition(recipe(), -1)).toThrow();
    expect(
      calculateRecipeNutrition(recipe(ingredient({ quantity: NaN })), 2, lookup)
        .total.energyKcal.issues[0]?.reason,
    ).toBe("invalid_quantity");
    expect(
      ingredientMass(ingredient({ unit: "ml", gramsPerUnit: -1 })),
    ).toBeNull();
  });
});
