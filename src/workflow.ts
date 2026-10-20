import {
  consumeCard,
  generateList,
  positiveInteger,
  reconcileSession,
  setSelection,
  totalMeals,
  uid,
} from "./domain";
import type { AppState } from "./types";

function requireSelection(state: AppState) {
  if (state.list)
    throw new Error(
      "Terminez vos courses actuelles avant de choisir de nouveaux repas.",
    );
  if (!state.session.started)
    throw new Error("Indiquez d’abord le nombre de repas à prévoir.");
}

export function startShopping(state: AppState, target: number): AppState {
  if (state.list)
    throw new Error("Terminez vos courses actuelles avant de commencer.");
  if (!positiveInteger(target, 365))
    throw new Error("Choisissez entre 1 et 365 repas.");
  if (state.session.started && state.session.selected.length)
    throw new Error("Votre sélection est déjà en cours.");
  return {
    ...state,
    session: reconcileSession(
      { ...state.session, started: true, target, selected: [] },
      state.recipes,
    ),
  };
}

export function decideRecipe(
  state: AppState,
  recipeId: string,
  accept: boolean,
  meals = 1,
  portions = state.session.people,
): AppState {
  requireSelection(state);
  if (!state.recipes.some((r) => r.id === recipeId))
    throw new Error("Cette recette a été supprimée.");
  let session = state.session;
  if (accept)
    session = setSelection(session, { id: uid(), recipeId, meals, portions });
  session = consumeCard(session, state.recipes, recipeId);
  return {
    ...state,
    session,
    list:
      totalMeals(session.selected) === session.target
        ? generateList(state.recipes, session)
        : null,
  };
}

export function finalizeSelection(state: AppState): AppState {
  requireSelection(state);
  return { ...state, list: generateList(state.recipes, state.session) };
}

export function finishShopping(state: AppState, generatedAt: string): AppState {
  if (!state.list || state.list.generatedAt !== generatedAt)
    throw new Error(
      "La liste a changé. Vérifiez les courses affichées avant de les terminer.",
    );
  return {
    ...state,
    list: null,
    session: { ...state.session, started: false, selected: [] },
  };
}
