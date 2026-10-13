import { describe, expect, it } from "vitest";
import {
  consumeCard,
  emptyState,
  generateList,
  normalizeName,
  reconcileSession,
  setSelection,
  shuffle,
  totalMeals,
  validateRecipe,
} from "../src/domain";
import type { Recipe, SelectionSession, Unit } from "../src/types";
const recipe = (
  id = "carbonara",
  quantity = 200,
  unit: Unit = "g",
  name = "Pâtes",
): Recipe => ({
  id,
  name: "Carbonara",
  referencePortions: 2,
  ingredients: [{ id: "pasta", name, quantity, unit, category: "Féculents" }],
});
const session = (portions = 2, meals = 1): SelectionSession => ({
  ...emptyState().session,
  target: meals,
  selected: [{ id: "s1", recipeId: "carbonara", meals, portions }],
});

describe("Portions et objectif de repas", () => {
  it.each([
    [3, 300],
    [5, 500],
    [10, 1000],
  ])("recalcule pour %i portions", (portions, expected) => {
    const item = generateList([recipe()], session(portions)).items[0]!;
    expect(item.quantity * (item.unit === "kg" ? 1000 : 1)).toBe(expected);
  });
  it("compte 3 repas et calcule 10 portions indépendamment", () => {
    const s = session(10, 3);
    expect(totalMeals(s.selected)).toBe(3);
    const list = generateList([recipe()], s);
    expect(list.meals).toBe(3);
    expect(list.portions).toBe(10);
    expect(list.items[0]?.quantity).toBe(1);
    expect(list.items[0]?.unit).toBe("kg");
  });
  it("reproduit l’exemple carbonara pour 6 portions", () => {
    const r = recipe();
    r.ingredients.push(
      {
        id: "bacon",
        name: "Lardons",
        quantity: 150,
        unit: "g",
        category: "Viandes et poissons",
      },
      {
        id: "eggs",
        name: "Œufs",
        quantity: 2,
        unit: "unité",
        category: "Produits frais",
      },
    );
    const items = generateList([r], session(6)).items;
    expect(items.find((i) => i.name === "Pâtes")?.quantity).toBe(600);
    expect(items.find((i) => i.name === "Lardons")?.quantity).toBe(450);
    expect(items.find((i) => i.name === "Œufs")?.quantity).toBe(6);
  });
  it("refuse le dépassement et laisse les portions indépendantes", () => {
    const s = { ...session(2, 5), target: 7 };
    expect(() =>
      setSelection(s, {
        id: "s2",
        recipeId: "carbonara",
        meals: 3,
        portions: 10,
      }),
    ).toThrow("objectif");
    const valid = setSelection(s, {
      id: "s2",
      recipeId: "carbonara",
      meals: 2,
      portions: 10,
    });
    expect(totalMeals(valid.selected)).toBe(7);
    expect(() =>
      setSelection(valid, { ...valid.selected[0]!, meals: 6 }),
    ).toThrow("objectif");
    expect(
      totalMeals(
        setSelection(valid, { ...valid.selected[0]!, meals: 4 }).selected,
      ),
    ).toBe(6);
    expect(
      setSelection(valid, { ...valid.selected[0]!, portions: 5 }).selected.map(
        (e) => e.id,
      ),
    ).toEqual(["s1", "s2"]);
  });
  it.each([0, -1, 1.5, Infinity, NaN])("refuse %s repas/portions", (n) => {
    expect(() =>
      setSelection(emptyState().session, {
        id: "s",
        recipeId: "r",
        meals: n,
        portions: 1,
      }),
    ).toThrow();
    expect(() =>
      setSelection(emptyState().session, {
        id: "s",
        recipeId: "r",
        meals: 1,
        portions: n,
      }),
    ).toThrow();
  });
  it("conserve les sélections de la même recette dans plusieurs cycles", () => {
    let s = { ...session(3), target: 2 };
    s = setSelection(s, {
      id: "s2",
      recipeId: "carbonara",
      meals: 1,
      portions: 7,
    });
    const list = generateList([recipe()], s);
    expect(list.dishes).toHaveLength(2);
    expect(list.portions).toBe(10);
    expect(list.items[0]?.quantity).toBe(1);
  });
});

describe("Regroupements et précision", () => {
  it("additionne les mêmes noms malgré la casse et les espaces", () => {
    const recipes = [
      recipe("carbonara", 600),
      recipe("salad", 300, "g", "  PÂTES   "),
    ];
    const s = session(2, 1);
    s.target = 2;
    s.selected.push({ id: "s2", recipeId: "salad", meals: 1, portions: 2 });
    const items = generateList(recipes, s).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(900);
  });
  it.each([
    ["kg", "g", 1.5, "kg"],
    ["L", "ml", 1.25, "L"],
  ] as const)("convertit %s/%s", (a, b, expected, resultUnit) => {
    const recipes = [
      recipe("carbonara", 1, a),
      recipe("second", b === "g" ? 500 : 250, b),
    ];
    const s = session();
    s.target = 2;
    s.selected.push({ id: "s2", recipeId: "second", meals: 1, portions: 2 });
    const items = generateList(recipes, s).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(expected);
    expect(items[0]?.unit).toBe(resultUnit);
  });
  it("sépare les unités incompatibles et les noms distincts", () => {
    const r = recipe();
    r.ingredients.push(
      { ...r.ingredients[0]!, id: "i2", unit: "unité" },
      { ...r.ingredients[0]!, id: "i3", name: "Pâtes complètes" },
    );
    expect(generateList([r], session()).items).toHaveLength(3);
    expect(normalizeName(" crème   fraîche ")).toBe("crème fraîche");
    expect(normalizeName("pates")).not.toBe(normalizeName("pâtes"));
  });
  it("additionne les décimales sans erreur flottante", () => {
    const r = recipe("carbonara", 0.1);
    r.ingredients.push({ ...r.ingredients[0]!, id: "i2", quantity: 0.2 });
    expect(generateList([r], session()).items[0]?.quantity).toBe(0.3);
  });
  it("ne cumule pas les arrondis intermédiaires", () => {
    const r = recipe("carbonara", 1);
    r.referencePortions = 3;
    const s = session(1);
    s.target = 3;
    s.selected.push(
      { id: "s2", recipeId: "carbonara", meals: 1, portions: 1 },
      { id: "s3", recipeId: "carbonara", meals: 1, portions: 1 },
    );
    expect(generateList([r], s).items[0]?.quantity).toBe(1);
  });
  it("ne fusionne qu’une fois un ingrédient avec des catégories différentes", () => {
    const r = recipe();
    r.ingredients.push({ ...r.ingredients[0]!, id: "i2", category: "Autres" });
    const items = generateList([r], session()).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe("Féculents");
  });
  it("refuse une génération incomplète", () => {
    const s = session();
    s.target = 7;
    expect(() => generateList([recipe()], s)).toThrow("objectif");
  });
});

describe("Permutation persistante", () => {
  const recipes = ["a", "b", "c", "d"].map((id) => recipe(id));
  it("présente chaque recette une fois même si tout est refusé", () => {
    let s = reconcileSession(emptyState().session, recipes);
    for (let cycle = 0; cycle < 20; cycle++) {
      const displayed = [];
      for (let i = 0; i < recipes.length; i++) {
        const id = s.queue[0]!;
        displayed.push(id);
        s = consumeCard(s, recipes, id);
      }
      expect(new Set(displayed).size).toBe(4);
      expect(s.queue).toHaveLength(4);
    }
  });
  it("reprend le même cycle après sérialisation", () => {
    let s = reconcileSession(emptyState().session, recipes);
    const consumed = s.queue[0]!;
    s = consumeCard(s, recipes, consumed);
    const restored = reconcileSession(JSON.parse(JSON.stringify(s)), recipes);
    expect(restored).toEqual(s);
    expect(restored.queue).not.toContain(consumed);
  });
  it("ajoute une nouvelle recette, élimine les doublons et supprime les recettes disparues", () => {
    let s = reconcileSession(emptyState().session, recipes);
    const consumed = s.queue[0]!;
    s = consumeCard(s, recipes, consumed);
    const removed = s.queue[0]!;
    const updated = recipes
      .filter((r) => r.id !== removed)
      .concat(recipe("new"));
    s.queue.push(s.queue[0]!);
    const next = reconcileSession(s, updated);
    expect(next.queue).not.toContain(consumed);
    expect(next.queue).not.toContain(removed);
    expect(next.queue.filter((id) => id === "new")).toHaveLength(1);
    expect(new Set(next.queue).size).toBe(next.queue.length);
  });
  it("modifie sans changer le cycle et retire les sélections supprimées", () => {
    let s = reconcileSession({ ...session(), queue: ["carbonara"], seen: [] }, [
      recipe(),
    ]);
    expect(reconcileSession(s, [recipe("carbonara", 400)]).queue).toEqual(
      s.queue,
    );
    s = reconcileSession(s, []);
    expect(s.queue).toEqual([]);
    expect(s.selected).toEqual([]);
  });
  it("fonctionne avec une seule recette et refuse une ancienne carte", () => {
    const s = reconcileSession(emptyState().session, [recipe()]);
    expect(consumeCard(s, [recipe()], "carbonara").queue).toEqual([
      "carbonara",
    ]);
    expect(() => consumeCard(s, [recipe()], "unknown")).toThrow("carte");
  });
  it("Fisher-Yates conserve exactement la collection", () => {
    expect(shuffle([1, 2, 3, 4], () => 0).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("Validation", () => {
  it("accepte zéro ingrédient en quantité mais pas une valeur négative", () => {
    expect(() => validateRecipe(recipe("carbonara", 0))).not.toThrow();
    expect(() => validateRecipe(recipe("carbonara", -1))).toThrow("quantités");
  });
  it("refuse les noms, portions et ingrédients absents", () => {
    expect(() => validateRecipe({ ...recipe(), name: " " })).toThrow();
    expect(() =>
      validateRecipe({ ...recipe(), referencePortions: 0 }),
    ).toThrow();
    expect(() => validateRecipe({ ...recipe(), ingredients: [] })).toThrow();
  });
});
