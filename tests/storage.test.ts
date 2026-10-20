import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { emptyState, generateList, reconcileSession } from "../src/domain";
import {
  loadImage,
  loadState,
  openDatabase,
  sanitizeState,
  updateState,
} from "../src/storage";
import type { Recipe } from "../src/types";
import { decideRecipe, finishShopping, startShopping } from "../src/workflow";
const recipe: Recipe = {
  id: "r",
  name: "Pâtes",
  referencePortions: 2,
  imageId: "photo",
  ingredients: [
    { id: "i", name: "Pâtes", quantity: 200, unit: "g", category: "Féculents" },
  ],
};
beforeEach(async () => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["state", "images"], "readwrite");
    tx.objectStore("state").clear();
    tx.objectStore("images").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
});
describe("IndexedDB", () => {
  it("conserve une présentation générique et une ancienne association à un plat préparé", async () => {
    const generic = {
      ...recipe,
      id: "generic",
      calories: 540,
      ingredients: [
        {
          ...recipe.ingredients[0]!,
          ciqualCode: "9810",
          ingredientOptionId: "pates-tagliatelles-crues",
          name: "Tagliatelles (sèches, crues)",
        },
      ],
    };
    const prepared = {
      ...recipe,
      id: "prepared",
      ingredients: [{ ...recipe.ingredients[0]!, ciqualCode: "24999" }],
    };
    await updateState((s) => ({ ...s, recipes: [recipe, generic, prepared] }));
    expect((await loadState()).recipes).toEqual([recipe, generic, prepared]);
  });
  it("conserve les recettes anciennes, les calories manuelles, les associations et conversions après relecture", async () => {
    const linked = {
      ...recipe,
      id: "linked",
      calories: 540,
      ingredients: [
        {
          ...recipe.ingredients[0]!,
          ciqualCode: "17270",
          quantity: 20,
          unit: "ml" as const,
          gramsPerUnit: 0.92,
        },
      ],
    };
    await updateState((s) => ({
      ...s,
      recipes: [recipe, linked],
      settings: { showCalories: true },
    }));
    const restored = await loadState();
    expect(restored.recipes).toEqual([recipe, linked]);
    expect(restored.settings.showCalories).toBe(true);
    expect(restored.version).toBe(1);
  });
  it("ne supprime pas une recette si ses métadonnées nutritionnelles facultatives sont corrompues", () => {
    const state = emptyState();
    const damaged = {
      ...recipe,
      calories: 540,
      ingredients: [{ ...recipe.ingredients[0]!, gramsPerUnit: -1 }],
    };
    Reflect.set(damaged.ingredients[0]!, "ciqualCode", 123);
    state.recipes = [damaged];
    const restored = sanitizeState(state);
    expect(restored.recipes).toHaveLength(1);
    expect(restored.recipes[0]?.calories).toBe(540);
    expect(restored.recipes[0]?.ingredients[0]?.ciqualCode).toBeUndefined();
    expect(restored.recipes[0]?.ingredients[0]?.gramsPerUnit).toBeUndefined();
  });
  it("reprend l’étape de swipe ou la liste après relecture et conserve la suppression définitive", async () => {
    await updateState((s) => startShopping({ ...s, recipes: [recipe] }, 2));
    expect((await loadState()).session.started).toBe(true);
    await updateState((s) => decideRecipe(s, "r", true, 1, 3));
    expect((await loadState()).list).toBeNull();
    await updateState((s) => decideRecipe(s, "r", true, 1, 7));
    const saved = await loadState();
    expect(saved.list?.portions).toBe(10);
    await expect(updateState((s) => startShopping(s, 5))).rejects.toThrow(
      "Terminez",
    );
    expect((await loadState()).list).toEqual(saved.list);
    await updateState((s) => finishShopping(s, saved.list!.generatedAt));
    const finished = await loadState();
    expect(finished.list).toBeNull();
    expect(finished.session.started).toBe(false);
    expect(finished.session.selected).toEqual([]);
  });
  it("reprend une ancienne session et conserve une ancienne liste sans l’écraser", () => {
    const legacy = emptyState();
    legacy.recipes = [recipe];
    legacy.session.selected = [
      { id: "s", recipeId: "r", meals: 1, portions: 2 },
    ];
    Reflect.deleteProperty(legacy.session, "started");
    expect(sanitizeState(legacy).session.started).toBe(true);
    legacy.session.target = 1;
    legacy.list = generateList(legacy.recipes, legacy.session);
    legacy.list.items[0]!.checked = true;
    expect(sanitizeState(legacy).list).toEqual(legacy.list);
  });
  it("démarre sans données fictives", async () => {
    expect(await loadState()).toEqual(emptyState());
  });
  it("persiste recettes, Blob, options, session, cycle, liste et coches", async () => {
    const blob = new Blob(["image-content"], { type: "image/webp" });
    await updateState(
      (s) => {
        s.recipes = [recipe];
        s.settings.showCalories = true;
        s.session = reconcileSession(
          {
            ...s.session,
            target: 3,
            selected: [{ id: "s", recipeId: "r", meals: 3, portions: 10 }],
          },
          s.recipes,
        );
        s.list = generateList(s.recipes, s.session);
        s.list.items[0]!.checked = true;
        return s;
      },
      { put: { id: "photo", blob } },
    );
    const restored = await loadState();
    expect(restored.recipes[0]).toEqual(recipe);
    expect(restored.settings.showCalories).toBe(true);
    expect(restored.session.selected[0]?.portions).toBe(10);
    expect(restored.session.queue).toEqual(["r"]);
    expect(restored.list?.items[0]?.checked).toBe(true);
    expect(await (await loadImage("photo"))?.text()).toBe("image-content");
  });
  it("remplace la liste et les coches, sans laisser de produit obsolète", async () => {
    await updateState((s) => {
      s.recipes = [recipe];
      s.session.target = 1;
      s.session.selected = [{ id: "s", recipeId: "r", meals: 1, portions: 2 }];
      s.list = generateList(s.recipes, s.session);
      s.list.items[0]!.checked = true;
      return s;
    });
    await updateState((s) => {
      s.recipes[0]!.ingredients[0]!.name = "Riz";
      s.list = generateList(s.recipes, s.session);
      return s;
    });
    const state = await loadState();
    expect(state.list?.items).toHaveLength(1);
    expect(state.list?.items[0]?.name).toBe("Riz");
    expect(state.list?.items[0]?.checked).toBe(false);
    const db = await openDatabase();
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const r = db.transaction("state").objectStore("state").getAllKeys();
      r.onsuccess = () => resolve(r.result);
    });
    expect(keys).toEqual(["current"]);
  });
  it("conserve l’instantané après modification et suppression d’une recette", async () => {
    await updateState((s) => {
      s.recipes = [recipe];
      s.session.target = 1;
      s.session.selected = [{ id: "s", recipeId: "r", meals: 1, portions: 2 }];
      s.list = generateList(s.recipes, s.session);
      return s;
    });
    const snapshot = (await loadState()).list;
    await updateState((s) => {
      s.recipes[0]!.ingredients[0]!.quantity = 900;
      return s;
    });
    expect((await loadState()).list).toEqual(snapshot);
    await updateState(
      (s) => ({ ...s, recipes: [], session: reconcileSession(s.session, []) }),
      { remove: "photo" },
    );
    expect((await loadState()).list).toEqual(snapshot);
    expect((await loadState()).session.selected).toHaveLength(0);
    expect(await loadImage("photo")).toBeUndefined();
  });
  it("annule toute la transaction si la modification échoue", async () => {
    await expect(
      updateState(
        () => {
          throw new Error("invalid");
        },
        { put: { id: "photo", blob: new Blob(["test"]) } },
      ),
    ).rejects.toThrow("invalid");
    expect(await loadState()).toEqual(emptyState());
    expect(await loadImage("photo")).toBeUndefined();
  });
  it("sérialise deux écritures concurrentes sans perdre de modification", async () => {
    await Promise.all([
      updateState((s) => ({ ...s, settings: { showCalories: true } })),
      updateState((s) => ({ ...s, session: { ...s.session, target: 10 } })),
    ]);
    const state = await loadState();
    expect(state.settings.showCalories).toBe(true);
    expect(state.session.target).toBe(10);
  });
  it("récupère les données valides et ignore les enregistrements abîmés", () => {
    const dirty = {
      ...emptyState(),
      recipes: [null, recipe, { id: "broken", ingredients: [] }],
      session: {
        target: -1,
        people: NaN,
        selected: [null],
        queue: ["r", "r", null],
        seen: ["ghost"],
      },
      list: { items: [null] },
    };
    const safe = sanitizeState(dirty);
    expect(safe.recipes).toEqual([recipe]);
    expect(safe.session.target).toBe(7);
    expect(safe.session.queue).toEqual(["r"]);
    expect(safe.list).toBeNull();
    expect(() => sanitizeState({ version: 2 })).toThrow("version");
  });
});
