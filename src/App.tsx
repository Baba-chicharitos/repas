import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Check,
  CircleCheck,
  CookingPot,
  Flame,
  Minus,
  Pencil,
  Plus,
  Settings2,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  type AppState,
  type Recipe,
  type SelectedMeal,
} from "./types";
import {
  formatNumber,
  reconcileSession,
  setSelection,
  totalMeals,
  uid,
} from "./domain";
import {
  decideRecipe,
  finalizeSelection,
  finishShopping,
  startShopping,
} from "./workflow";
import { loadState, updateState, type ImageChange } from "./storage";
import { EmptyState, Modal, NumberField, RecipeImage } from "./components";
import { RecipeEditor } from "./RecipeEditor";
import { SwipeCard } from "./SwipeCard";
import { addSampleRecipes, SAMPLE_RECIPES } from "./sampleRecipes";

type Tab = "recettes" | "courses" | "options";
const tabs = [
  { id: "recettes", label: "Recette", icon: BookOpen },
  { id: "courses", label: "Faites vos courses !", icon: ShoppingBasket },
  { id: "options", label: "Options", icon: Settings2 },
] as const;
function currentTab(): Tab {
  return location.hash === "#recettes"
    ? "recettes"
    : location.hash === "#options"
      ? "options"
      : "courses";
}
function errorMessage(error: unknown) {
  return error instanceof DOMException && error.name === "QuotaExceededError"
    ? "Le stockage de ce navigateur est plein. La modification n’a pas été sauvegardée."
    : error instanceof Error
      ? error.message
      : "La sauvegarde locale a échoué. Réessayez.";
}

export default function App() {
  const [state, setState] = useState<AppState>();
  const [tab, setTab] = useState<Tab>(currentTab);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Recipe | "new">();
  const [details, setDetails] = useState<string>();
  const [editingMeal, setEditingMeal] = useState<SelectedMeal>();
  const [confirmation, setConfirmation] = useState<Recipe>();
  const [showSamplePanel, setShowSamplePanel] = useState(
    () => new URLSearchParams(location.search).get("essai") === "1",
  );
  const busyRef = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const load = useCallback(async () => {
    try {
      setState(await loadState());
      setError("");
    } catch (error) {
      setError(errorMessage(error));
    }
  }, []);
  useEffect(() => {
    void load();
    const onHash = () => {
      setTab(currentTab());
      window.scrollTo({ top: 0 });
    };
    const refresh = () => {
      if (document.visibilityState === "visible" && !busyRef.current)
        void load();
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("visibilitychange", refresh);
    if ("BroadcastChannel" in window) {
      const bus = new BroadcastChannel("serranotool-repas");
      channel.current = bus;
      bus.onmessage = refresh;
    }
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("visibilitychange", refresh);
      channel.current?.close();
    };
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (
      state?.list ||
      (editingMeal &&
        !state?.session.selected.some((e) => e.id === editingMeal.id))
    )
      setEditingMeal(undefined);
    if (details && state && !state.recipes.some((r) => r.id === details))
      setDetails(undefined);
  }, [state, editingMeal, details]);
  async function mutate(
    change: (s: AppState) => AppState,
    image?: ImageChange,
  ): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await updateState(change, image);
      setState(next);
      setError("");
      channel.current?.postMessage("updated");
      return true;
    } catch (error) {
      setError(errorMessage(error));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function saveRecipe(recipe: Recipe, image: Blob | null | undefined) {
    const next = { ...recipe },
      imageChange: ImageChange = {};
    if (image !== undefined) {
      delete next.imageId;
      if (image) {
        next.imageId = uid();
        imageChange.put = { id: next.imageId, blob: image };
      }
    }
    const ok = await mutate((s) => {
      const previous = s.recipes.find((r) => r.id === next.id);
      if (editor !== "new" && !previous)
        throw new Error("Cette recette a été supprimée dans un autre onglet.");
      if (image !== undefined) imageChange.remove = previous?.imageId;
      else if (previous?.imageId) next.imageId = previous.imageId;
      const recipes = previous
        ? s.recipes.map((r) => (r.id === next.id ? next : r))
        : [...s.recipes, next];
      return { ...s, recipes, session: reconcileSession(s.session, recipes) };
    }, imageChange);
    if (ok) setNotice("Recette enregistrée.");
    return ok;
  }
  async function deleteRecipe(recipe: Recipe) {
    const imageChange: ImageChange = {};
    const ok = await mutate((s) => {
      imageChange.remove = s.recipes.find((r) => r.id === recipe.id)?.imageId;
      const recipes = s.recipes.filter((r) => r.id !== recipe.id);
      return { ...s, recipes, session: reconcileSession(s.session, recipes) };
    }, imageChange);
    if (ok) {
      setConfirmation(undefined);
      setDetails(undefined);
      setNotice("Recette supprimée.");
    }
  }
  const selectedMeals = state ? totalMeals(state.session.selected) : 0;
  const remaining = state ? state.session.target - selectedMeals : 0;
  const card = state?.recipes.find((r) => r.id === state.session.queue[0]);
  const detailRecipe = state?.recipes.find((r) => r.id === details);
  const checkedCount = state?.list?.items.filter((i) => i.checked).length ?? 0;
  const samplesLoaded =
    state &&
    SAMPLE_RECIPES.every((r) =>
      state.recipes.some((existing) => existing.id === r.id),
    );
  if (!state)
    return (
      <div className="loading-screen">
        <h1>repas</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="button" onClick={() => void load()}>
              Réessayer
            </button>
          </>
        ) : (
          <p>Ouverture de votre carnet…</p>
        )}
      </div>
    );
  return (
    <>
      <header className="site-header">
        <a
          className="brand"
          href="#courses"
          aria-label="repas — Faites vos courses !"
        >
          repas
        </a>
      </header>
      <main
        id="main"
        className={`app-page ${tab === "courses" ? "workflow-page" : ""}`}
      >
        {showSamplePanel && (
          <div className="sample-panel">
            <div>
              <strong>Jeu d’essai</strong>
              <p>8 recettes modifiables pour essayer l’application.</p>
            </div>
            <div className="sample-actions">
              <button
                className="button"
                disabled={busy || samplesLoaded}
                onClick={async () => {
                  if (await mutate(addSampleRecipes))
                    setNotice("Recettes d’essai chargées.");
                }}
              >
                {samplesLoaded
                  ? "Recettes d’essai chargées"
                  : "Charger les 8 recettes d’essai"}
              </button>
              <button
                className="icon-button"
                aria-label="Masquer le jeu d’essai"
                onClick={() => setShowSamplePanel(false)}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Fermer le message"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {tab === "courses" &&
          (state.list ? (
            <section className="shopping-screen">
              <div className="page-header">
                <div>
                  <h1>Votre liste de courses</h1>
                  <p className="page-subtitle">
                    {state.list.meals} repas · {state.list.portions} portions
                  </p>
                </div>
              </div>
              <div className="shopping-progress">
                <strong>
                  {checkedCount} / {state.list.items.length} produits cochés
                </strong>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${state.list.items.length ? (checkedCount / state.list.items.length) * 100 : 100}%`,
                    }}
                  />
                </div>
              </div>
              {CATEGORIES.map((category) => {
                const items = state.list!.items.filter(
                  (i) => i.category === category,
                );
                return (
                  items.length > 0 && (
                    <section className="shopping-category" key={category}>
                      <h2>{category}</h2>
                      <div>
                        {items.map((item) => (
                          <label
                            className={`shopping-row ${item.checked ? "checked" : ""}`}
                            key={item.id}
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              disabled={busy}
                              onChange={(e) => {
                                const checked = e.target.checked,
                                  generatedAt = state.list!.generatedAt;
                                void mutate((s) => {
                                  if (s.list?.generatedAt !== generatedAt)
                                    throw new Error(
                                      "La liste a changé dans un autre onglet.",
                                    );
                                  return {
                                    ...s,
                                    list: {
                                      ...s.list,
                                      items: s.list.items.map((i) =>
                                        i.id === item.id
                                          ? { ...i, checked }
                                          : i,
                                      ),
                                    },
                                  };
                                });
                              }}
                            />
                            <span className="custom-check">
                              <Check size={15} />
                            </span>
                            <span className="shopping-name">{item.name}</span>
                            <strong>
                              {formatNumber(item.quantity)}{" "}
                              <span>{item.unit}</span>
                            </strong>
                          </label>
                        ))}
                      </div>
                    </section>
                  )
                );
              })}
              <details className="menu-details">
                <summary>Les plats prévus</summary>
                {state.list.dishes.map((dish, i) => (
                  <p key={i}>
                    <strong>{dish.name}</strong>
                    <span>
                      {dish.meals} repas · {dish.portions} portions
                    </span>
                  </p>
                ))}
              </details>
              <button
                className="button finish-shopping full-width"
                disabled={busy}
                onClick={async () => {
                  if (
                    await mutate((s) =>
                      finishShopping(s, state.list!.generatedAt),
                    )
                  ) {
                    setNotice("Courses terminées. La liste a été supprimée.");
                    window.scrollTo({ top: 0 });
                  }
                }}
              >
                <Check size={19} />
                Courses terminées
              </button>
              <p className="finish-note">
                La liste sera supprimée définitivement.
              </p>
            </section>
          ) : !state.session.started ? (
            <GoalScreen
              initialTarget={state.session.target}
              busy={busy}
              onStart={(target) => mutate((s) => startShopping(s, target))}
            />
          ) : !state.recipes.length ? (
            <EmptyState
              icon={<CookingPot size={42} />}
              title="Ajoutez votre première recette"
              text="Votre nombre de repas est enregistré. Ajoutez une recette pour commencer à swiper."
              action={
                <button className="button" onClick={() => setEditor("new")}>
                  <Plus size={18} />
                  Ajouter une recette
                </button>
              }
            />
          ) : remaining === 0 ? (
            <div className="goal-screen">
              <h1>Votre sélection est prête</h1>
              <button
                className="button"
                disabled={busy}
                onClick={() => void mutate(finalizeSelection)}
              >
                Afficher ma liste de courses
              </button>
            </div>
          ) : card ? (
            <section className="swipe-screen">
              <p className="workflow-progress" aria-live="polite">
                {selectedMeals} / {state.session.target} repas sélectionnés
              </p>
              <MealCard
                showNutrition={state.settings.showCalories}
                key={`${card.id}:${state.session.selected.length}`}
                recipe={card}
                people={state.session.people}
                maxMeals={remaining}
                busy={busy}
                onDecision={async (accept, meals, portions) => {
                  await mutate((s) =>
                    decideRecipe(s, card.id, accept, meals, portions),
                  );
                }}
              />
              {state.session.selected.length > 0 && (
                <details className="selection-details">
                  <summary>Votre sélection ({selectedMeals} repas)</summary>
                  {state.session.selected.map((entry) => {
                    const recipe = state.recipes.find(
                      (r) => r.id === entry.recipeId,
                    )!;
                    return (
                      <div className="selected-item" key={entry.id}>
                        <div className="selected-info">
                          <strong>{recipe.name}</strong>
                          <span>
                            {entry.meals} repas · {entry.portions} portions
                          </span>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Modifier la sélection : ${recipe.name}`}
                          disabled={busy}
                          onClick={() => setEditingMeal(entry)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Retirer ${recipe.name}`}
                          disabled={busy}
                          onClick={() =>
                            void mutate((s) => {
                              if (s.list)
                                throw new Error(
                                  "Terminez d’abord vos courses.",
                                );
                              return {
                                ...s,
                                session: {
                                  ...s.session,
                                  selected: s.session.selected.filter(
                                    (e) => e.id !== entry.id,
                                  ),
                                },
                              };
                            })
                          }
                        >
                          <X size={18} />
                        </button>
                      </div>
                    );
                  })}
                </details>
              )}
            </section>
          ) : null)}
        {tab === "recettes" && (
          <>
            <div className="page-header">
              <div>
                <h1>Vos recettes</h1>
                <p className="page-subtitle">
                  {state.recipes.length} recette
                  {state.recipes.length > 1 ? "s" : ""}
                </p>
              </div>
              <button className="button" onClick={() => setEditor("new")}>
                <Plus size={18} />
                Ajouter une recette
              </button>
            </div>
            {!state.recipes.length ? (
              <EmptyState
                icon={<BookOpen size={42} />}
                title="Votre carnet commence ici"
                text="Ajoutez vos plats et leurs ingrédients pour préparer vos courses."
                action={
                  <button className="button" onClick={() => setEditor("new")}>
                    Ajouter une recette
                  </button>
                }
              />
            ) : (
              <div className="recipe-grid">
                {state.recipes.map((recipe) => (
                  <article className="library-card" key={recipe.id}>
                    <button
                      className="library-open"
                      aria-label={`Consulter ${recipe.name}`}
                      onClick={() => setDetails(recipe.id)}
                    >
                      <RecipeImage
                        name={recipe.name}
                        imageId={recipe.imageId}
                      />
                      <div className="library-content">
                        <h2>{recipe.name}</h2>
                      </div>
                    </button>
                    <div className="library-actions">
                      <button
                        className="text-button"
                        onClick={() => setEditor(recipe)}
                      >
                        <Pencil size={15} />
                        Modifier
                      </button>
                      <button
                        className="icon-button danger-text"
                        aria-label={`Supprimer ${recipe.name}`}
                        onClick={() => setConfirmation(recipe)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "options" && (
          <>
            <div className="page-header">
              <h1>Options</h1>
            </div>
            <div className="options-card">
              <div className="option-row">
                <span className="option-icon">
                  <Flame size={24} />
                </span>
                <div>
                  <h2>Informations nutritionnelles</h2>
                  <p>
                    Calories, protéines, glucides et lipides sur les cartes.
                  </p>
                  <small>
                    Calcul local avec Ciqual 2025. Valeurs pour une portion de
                    référence, uniquement sur les cartes de swipe.
                  </small>
                </div>
                <button
                  className="switch"
                  role="switch"
                  aria-label="Afficher les informations nutritionnelles"
                  aria-checked={state.settings.showCalories}
                  disabled={busy}
                  onClick={() =>
                    void mutate((s) => ({
                      ...s,
                      settings: {
                        ...s.settings,
                        showCalories: !s.settings.showCalories,
                      },
                    }))
                  }
                >
                  <span />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
      {createPortal(
        <nav className="bottom-nav" aria-label="Navigation principale">
          {tabs.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={22} strokeWidth={1.8} />
              <span>{label}</span>
            </a>
          ))}
        </nav>,
        document.body,
      )}
      {notice && (
        <div className="toast" role="status">
          <CircleCheck size={19} />
          {notice}
        </div>
      )}
      {editor && (
        <RecipeEditor
          recipe={editor === "new" ? undefined : editor}
          onClose={() => setEditor(undefined)}
          onSave={saveRecipe}
          saveError={error}
        />
      )}
      {detailRecipe && (
        <Modal title={detailRecipe.name} onClose={() => setDetails(undefined)}>
          <div className="recipe-detail">
            <RecipeImage
              name={detailRecipe.name}
              imageId={detailRecipe.imageId}
            />
            <p className="page-subtitle">
              Pour {detailRecipe.referencePortions} portions
            </p>
            <h3>Les ingrédients</h3>
            <ul>
              {detailRecipe.ingredients.map((i) => (
                <li key={i.id}>
                  <span>{i.name}</span>
                  <strong>
                    {formatNumber(i.quantity)} {i.unit}
                  </strong>
                </li>
              ))}
            </ul>
            <button
              className="button secondary full-width"
              onClick={() => {
                setDetails(undefined);
                setEditor(detailRecipe);
              }}
            >
              <Pencil size={17} />
              Modifier la recette
            </button>
          </div>
        </Modal>
      )}
      {confirmation && (
        <Modal
          title="Supprimer cette recette ?"
          onClose={() => {
            if (!busy) setConfirmation(undefined);
          }}
        >
          <p className="confirm-text">
            « {confirmation.name} » sera supprimée avec sa photo et retirée de
            votre sélection. Votre liste de courses actuelle restera disponible.
          </p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirmation(undefined)}
            >
              Annuler
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void deleteRecipe(confirmation)}
            >
              Supprimer la recette
            </button>
          </div>
        </Modal>
      )}
      {editingMeal && (
        <EditMeal
          entry={editingMeal}
          maxMeals={remaining + editingMeal.meals}
          busy={busy}
          error={error}
          onClose={() => setEditingMeal(undefined)}
          onSave={async (entry) => {
            const ok = await mutate((s) => {
              if (s.list) throw new Error("Terminez d’abord vos courses.");
              if (!s.session.selected.some((e) => e.id === entry.id))
                throw new Error("Ce plat a été retiré de votre sélection.");
              const next = { ...s, session: setSelection(s.session, entry) };
              return totalMeals(next.session.selected) === next.session.target
                ? finalizeSelection(next)
                : next;
            });
            if (ok) setEditingMeal(undefined);
          }}
        />
      )}
    </>
  );
}

function GoalScreen({
  initialTarget,
  busy,
  onStart,
}: {
  initialTarget: number;
  busy: boolean;
  onStart: (target: number) => Promise<boolean>;
}) {
  const [target, setTarget] = useState(initialTarget);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy) void onStart(target);
  }
  return (
    <section className="goal-screen">
      <div className="goal-symbol" aria-hidden="true">
        <CookingPot size={34} strokeWidth={1.4} />
      </div>
      <h1>Faites vos courses !</h1>
      <p>Combien de repas souhaitez-vous prévoir ?</p>
      <form onSubmit={submit}>
        <NumberField
          label="Nombre de repas à prévoir"
          value={target}
          max={365}
          disabled={busy}
          onChange={setTarget}
        />
        <button type="submit" className="button full-width" disabled={busy}>
          Choisir mes repas
        </button>
      </form>
    </section>
  );
}

function MealCard({
  recipe,
  showNutrition,
  people,
  maxMeals,
  busy,
  onDecision,
}: {
  recipe: Recipe;
  showNutrition: boolean;
  people: number;
  maxMeals: number;
  busy: boolean;
  onDecision: (
    accept: boolean,
    meals: number,
    portions: number,
  ) => Promise<void>;
}) {
  const [meals, setMeals] = useState(1),
    [portions, setPortions] = useState(people),
    [custom, setCustom] = useState(false);
  function changeMeals(n: number) {
    setMeals(n);
    if (!custom) setPortions(Math.min(10000, n * people));
  }
  useEffect(() => {
    if (meals > maxMeals) {
      setMeals(maxMeals);
      if (!custom) setPortions(Math.min(10000, maxMeals * people));
    }
  }, [maxMeals, meals, people, custom]);
  return (
    <>
      <div className="discovery">
        <SwipeCard
          showNutrition={showNutrition}
          recipe={recipe}
          disabled={busy}
          onDecision={(accept) => void onDecision(accept, meals, portions)}
        />
      </div>
      <div className="quantity-controls">
        <QuantityControl
          label="Nombre de repas pour ce plat"
          unit="repas"
          value={meals}
          max={maxMeals}
          disabled={busy}
          onChange={changeMeals}
        />
        <QuantityControl
          label="Nombre total de portions"
          unit={portions === 1 ? "portion" : "portions"}
          value={portions}
          max={10000}
          disabled={busy}
          onChange={(n) => {
            setCustom(true);
            setPortions(n);
          }}
        />
      </div>
      <p className="gesture-hint">
        Glissez à gauche pour passer, à droite pour choisir.
      </p>
    </>
  );
}

function QuantityControl({
  label,
  unit,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const n = Number(draft);
    if (Number.isInteger(n) && n >= 1 && n <= max) onChange(n);
    else setDraft(String(value));
  }
  const suffix =
    unit === "repas"
      ? "le nombre de repas pour ce plat"
      : "le nombre total de portions";
  return (
    <div className="meal-quantity">
      <button
        className="quantity-button"
        disabled={disabled || value <= 1}
        aria-label={`Diminuer ${suffix}`}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={20} />
      </button>
      <label className="quantity-value">
        <input
          aria-label={label}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          style={{ width: `${Math.max(1, draft.length)}ch` }}
        />
        <span>{unit}</span>
      </label>
      <button
        className="quantity-button"
        disabled={disabled || value >= max}
        aria-label={`Augmenter ${suffix}`}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

function EditMeal({
  entry,
  maxMeals,
  busy,
  error,
  onClose,
  onSave,
}: {
  entry: SelectedMeal;
  maxMeals: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (entry: SelectedMeal) => Promise<void>;
}) {
  const [meals, setMeals] = useState(entry.meals),
    [portions, setPortions] = useState(entry.portions);
  return (
    <Modal
      title="Ajuster ce plat"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="portion-fields">
        <NumberField
          label="Nombre de repas pour ce plat"
          value={meals}
          max={maxMeals}
          disabled={busy}
          onChange={setMeals}
        />
        <NumberField
          label="Nombre total de portions"
          value={portions}
          disabled={busy}
          onChange={setPortions}
        />
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Annuler
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => void onSave({ ...entry, meals, portions })}
        >
          Mettre à jour
        </button>
      </div>
    </Modal>
  );
}
