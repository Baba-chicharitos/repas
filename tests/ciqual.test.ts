import { describe, expect, it } from "vitest";
import {
  ciqualDatabase,
  getCiqualFood,
  searchCiqualFoods,
  validateCiqualDatabase,
  searchIngredientGroups,
  normalizeIngredientSearch,
  getIngredientOption,
} from "../src/ciqual";

describe("base Ciqual locale", () => {
  it("groupe les pâtes crues/cuites et les présentations usuelles avec une référence générique explicite", () => {
    const group = searchIngredientGroups("pâtes").find(
      (g) => g.family === "Pâtes",
    )!;
    expect(group).toBeDefined();
    expect(group.suggestions.map((s) => s.food.ciqualCode)).toEqual(
      expect.arrayContaining(["9810", "9811"]),
    );
    expect(
      group.suggestions.some(
        (s) => s.option?.id === "pates-tagliatelles-crues",
      ),
    ).toBe(true);
    expect(
      group.suggestions.some(
        (s) => s.option?.id === "pates-coquillettes-crues",
      ),
    ).toBe(true);
    expect(
      searchIngredientGroups("tagliatelle")[0]?.suggestions.every(
        (s) => !!s.option,
      ),
    ).toBe(true);
    expect(
      getIngredientOption("pates-tagliatelles-crues", "9810")
        ?.nutritionReference,
    ).toBe("generic_equivalent");
    expect(
      getIngredientOption("pates-tagliatelles-crues", "9811"),
    ).toBeUndefined();
    expect(searchIngredientGroups("pates")).toEqual(
      searchIngredientGroups("PÂTES"),
    );
  });
  it.each(["pois chiche", "pois-chiches", "POIS—CHICHE", "chickpeas"])(
    "propose les trois états des pois chiches pour %s",
    (query) => {
      const group = searchIngredientGroups(query).find(
        (g) => g.family === "Pois chiches",
      )!;
      expect(group.suggestions.map((s) => s.food.ciqualCode)).toEqual([
        "20516",
        "20532",
        "20507",
      ]);
    },
  );
  it("classe les variantes courantes du riz en premier et filtre les plats préparés sans casser leur lookup", () => {
    const group = searchIngredientGroups("riz").find(
      (g) => g.family === "Riz",
    )!;
    expect(group.suggestions.slice(0, 2).map((s) => s.food.ciqualCode)).toEqual(
      ["9100", "9104"],
    );
    expect(
      searchIngredientGroups("carbonara")
        .flatMap((g) => g.suggestions)
        .every(
          (s) =>
            s.food.isIngredientCandidate === true &&
            !/pâtes.*carbonara/i.test(s.food.nameFr),
        ),
    ).toBe(true);
    const prepared = ciqualDatabase.foods.find(
      (f) => f.isIngredientCandidate === false && /carbonara/i.test(f.nameFr),
    )!;
    expect(prepared).toBeDefined();
    expect(getCiqualFood(prepared.ciqualCode)).toBe(prepared);
    expect(searchIngredientGroups(prepared.ciqualCode)).toEqual([]);
  });
  it("normalise les accents, tirets, apostrophes et espaces sans changer le catalogue", () => {
    expect(normalizeIngredientSearch("  POIS—CHICHES  ")).toBe("pois chiches");
    expect(normalizeIngredientSearch("Huile d’olive")).toBe("huile d olive");
    expect(normalizeIngredientSearch("Œufs")).toBe("oeufs");
    expect(searchIngredientGroups("huile d'olive")).toEqual(
      searchIngredientGroups("HUILE D’OLIVE"),
    );
    expect(searchIngredientGroups("x")).toEqual([]);
  });
  it("valide les 3484 codes distincts et les quatre nutriments de l’export réel", () => {
    expect(ciqualDatabase.foods).toHaveLength(3484);
    expect(new Set(ciqualDatabase.foods.map((f) => f.ciqualCode)).size).toBe(
      3484,
    );
    expect(validateCiqualDatabase(ciqualDatabase)).toBe(ciqualDatabase);
    expect(getCiqualFood("17270")?.per100g.energyKcal.value).toBe(899);
    expect(getCiqualFood("inconnu")).toBeUndefined();
  });
  it("cherche sans accents, sur plusieurs termes ou par code sans associer automatiquement", () => {
    expect(
      searchCiqualFoods("huile olive vierge").some(
        (f) => f.ciqualCode === "17270",
      ),
    ).toBe(true);
    expect(searchCiqualFoods("17270")[0]?.ciqualCode).toBe("17270");
    expect(
      searchCiqualFoods("tomate crue").every((f) => /crue/i.test(f.nameFr)),
    ).toBe(true);
    expect(
      searchCiqualFoods("tomate cuite").every((f) => /cuite/i.test(f.nameFr)),
    ).toBe(true);
    expect(searchCiqualFoods("pates").length).toBeGreaterThan(0);
    expect(searchCiqualFoods("x")).toEqual([]);
    expect(searchCiqualFoods("aliment inexistant zzzzzz")).toEqual([]);
    expect(searchCiqualFoods("tomate", 2)).toHaveLength(2);
  });
  it.each([
    "duplicate",
    "negative",
    "missing-number",
    "trace-number",
    "unknown-qualifier",
    "method",
    "zero-bound",
  ])("refuse un fichier invalide : %s", (mutation) => {
    const raw = structuredClone(ciqualDatabase);
    const nutrient = raw.foods[0]!.per100g.energyKcal;
    if (mutation === "duplicate") raw.foods.push(raw.foods[0]!);
    if (mutation === "negative") nutrient.value = -1;
    if (mutation === "missing-number") nutrient.value = null;
    if (mutation === "trace-number") nutrient.qualifier = "trace";
    if (mutation === "unknown-qualifier")
      Reflect.set(nutrient, "qualifier", "other");
    if (mutation === "method")
      Reflect.set(raw.source, "proteinMethod", "other");
    if (mutation === "zero-bound") {
      nutrient.qualifier = "less_than";
      nutrient.value = 0;
    }
    expect(() => validateCiqualDatabase(raw)).toThrow("invalide");
  });
});
