import { describe, expect, it } from "vitest";
import { emptyState } from "../src/domain";
import { addSampleRecipes } from "../src/sampleRecipes";
import {
  decideRecipe,
  finalizeSelection,
  finishShopping,
  startShopping,
} from "../src/workflow";

const initial = () => addSampleRecipes(emptyState());
function readyList() {
  const state = startShopping(initial(), 1);
  return decideRecipe(state, state.session.queue[0]!, true, 1, 3);
}
describe("Parcours de courses en trois étapes", () => {
  it("demande un objectif avant de permettre le swipe", () => {
    const state = initial();
    expect(state.session.started).toBe(false);
    expect(() => decideRecipe(state, state.session.queue[0]!, true)).toThrow(
      "nombre de repas",
    );
    expect(startShopping(state, 3).session.started).toBe(true);
  });
  it.each([0, -1, 1.5, 366, NaN])(
    "refuse un objectif incorrect : %s",
    (value) => {
      expect(() => startShopping(initial(), value)).toThrow();
    },
  );
  it("génère automatiquement la liste après le dernier choix", () => {
    let state = startShopping(initial(), 3);
    state = decideRecipe(state, state.session.queue[0]!, true, 1, 3);
    expect(state.list).toBeNull();
    state = decideRecipe(state, state.session.queue[0]!, true, 2, 10);
    expect(state.list?.meals).toBe(3);
    expect(state.list?.portions).toBe(13);
  });
  it("un refus avance sans créer de liste ou consommer un repas", () => {
    const state = startShopping(initial(), 3),
      current = state.session.queue[0]!;
    const next = decideRecipe(state, current, false);
    expect(next.session.selected).toHaveLength(0);
    expect(next.list).toBeNull();
    expect(next.session.queue).not.toContain(current);
  });
  it("bloque toute nouvelle sélection ou génération tant que la liste existe", () => {
    const state = readyList(),
      snapshot = structuredClone(state.list);
    expect(() => startShopping(state, 5)).toThrow("Terminez");
    expect(() => decideRecipe(state, state.session.queue[0]!, true)).toThrow(
      "Terminez",
    );
    expect(() => decideRecipe(state, state.session.queue[0]!, false)).toThrow(
      "Terminez",
    );
    expect(() => finalizeSelection(state)).toThrow("Terminez");
    expect(state.list).toEqual(snapshot);
  });
  it("ne termine pas les courses simplement parce que tous les produits sont cochés", () => {
    const state = readyList();
    state.list!.items.forEach((i) => {
      i.checked = true;
    });
    expect(state.list).not.toBeNull();
    expect(() => startShopping(state, 2)).toThrow();
  });
  it("termine uniquement sur action explicite et élimine la sélection précédente", () => {
    const state = readyList(),
      previous = state.list!.generatedAt;
    const next = finishShopping(state, previous);
    expect(next.list).toBeNull();
    expect(next.session.started).toBe(false);
    expect(next.session.selected).toEqual([]);
    expect(next.recipes).toEqual(state.recipes);
    const restarted = startShopping(next, 2);
    const newList = decideRecipe(
      restarted,
      restarted.session.queue[0]!,
      true,
      2,
      4,
    ).list!;
    expect(newList.items.every((i) => !i.checked)).toBe(true);
    expect(newList.meals).toBe(2);
  });
  it("refuse une action obsolète de fin de courses", () => {
    expect(() => finishShopping(readyList(), "old-list")).toThrow("changé");
    expect(() => finishShopping(initial(), "none")).toThrow();
  });
  it("n’efface pas une sélection en cours si le démarrage est répété", () => {
    let state = startShopping(initial(), 3);
    state = decideRecipe(state, state.session.queue[0]!, true);
    expect(() => startShopping(state, 4)).toThrow("déjà en cours");
  });
});
