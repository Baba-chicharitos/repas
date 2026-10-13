import { describe, expect, it, vi } from "vitest";
import { addSampleRecipes, SAMPLE_RECIPES } from "../src/sampleRecipes";
import { emptyState, generateList, uid, validateRecipe } from "../src/domain";

describe("Jeu d’essai facultatif", () => {
  it("contient huit recettes valides et ne se charge pas automatiquement", () => {
    expect(emptyState().recipes).toHaveLength(0);
    expect(SAMPLE_RECIPES).toHaveLength(8);
    for (const recipe of SAMPLE_RECIPES)
      expect(() => validateRecipe(recipe)).not.toThrow();
  });
  it("préserve les données personnelles et ne crée pas de doublons", () => {
    const state = emptyState();
    state.recipes = [
      {
        ...structuredClone(SAMPLE_RECIPES[0]!),
        id: "personal",
        name: "Ma recette",
      },
    ];
    const first = addSampleRecipes(state);
    first.recipes.find((r) => r.id === "essai-carbonara")!.name =
      "Ma carbonara modifiée";
    const second = addSampleRecipes(first);
    expect(second.recipes).toHaveLength(9);
    expect(second.recipes[0]!.name).toBe("Ma recette");
    expect(second.recipes.find((r) => r.id === "essai-carbonara")!.name).toBe(
      "Ma carbonara modifiée",
    );
    expect(SAMPLE_RECIPES[0]!.name).toBe("Carbonara");
  });
  it("permet les exemples demandés : 1/3, 3/10 et 2/4", () => {
    const state = addSampleRecipes(emptyState());
    state.session.target = 6;
    state.session.selected = [
      { id: "a", recipeId: "essai-carbonara", meals: 1, portions: 3 },
      { id: "b", recipeId: "essai-poulet-riz", meals: 3, portions: 10 },
      { id: "c", recipeId: "essai-lasagnes", meals: 2, portions: 4 },
    ];
    const list = generateList(state.recipes, state.session);
    expect(list.meals).toBe(6);
    expect(list.portions).toBe(17);
    expect(list.items.find((i) => i.name === "Poulet")?.quantity).toBe(1.5);
  });
  it("crée des identifiants sur une origine HTTP du réseau local", () => {
    const native = crypto.randomUUID;
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      randomUUID: undefined,
    });
    try {
      const ids = Array.from({ length: 100 }, uid);
      expect(new Set(ids).size).toBe(100);
      for (const id of ids)
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
    } finally {
      vi.unstubAllGlobals();
      expect(crypto.randomUUID).toBe(native);
    }
  });
});
