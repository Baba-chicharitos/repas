import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  CookingPot,
  Flame,
  Heart,
  Leaf,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  ShoppingBasket,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  type AppState,
  type Recipe,
  type SelectedMeal,
} from "./types";
import {
  consumeCard,
  formatNumber,
  generateList,
  positiveInteger,
  reconcileSession,
  setSelection,
  totalMeals,
  totalPortions,
  uid,
} from "./domain";
import { loadState, updateState, type ImageChange } from "./storage";
import { EmptyState, Modal, NumberField, RecipeImage } from "./components";
import { RecipeEditor } from "./RecipeEditor";
import { SwipeCard } from "./SwipeCard";
import { addSampleRecipes, SAMPLE_RECIPES } from "./sampleRecipes";

type Tab = "repas" | "recettes" | "courses" | "options";
const tabs: { id: Tab; label: string; icon: typeof CookingPot }[] = [
  { id: "repas", label: "Repas", icon: CookingPot },
  { id: "recettes", label: "Recettes", icon: BookOpen },
  { id: "courses", label: "Courses", icon: ShoppingBasket },
  { id: "options", label: "Options", icon: Settings2 },
];
function currentTab(): Tab {
  const hash = location.hash.slice(1);
  return tabs.some((t) => t.id === hash) ? (hash as Tab) : "repas";
}
function errorMessage(e: unknown) {
  if (e instanceof DOMException && e.name === "QuotaExceededError")
    return "Le stockage de ce navigateur est plein. Libérez de l’espace ou utilisez une image plus petite ; votre modification n’a pas été sauvegardée.";
  return e instanceof Error
    ? e.message
    : "La sauvegarde locale a échoué. Réessayez.";
}

export default function App() {
  const [showSamplePanel, setShowSamplePanel] = useState(
    () => new URLSearchParams(location.search).get("essai") === "1",
  );
  const [state, setState] = useState<AppState>();
  const [tab, setTab] = useState<Tab>(currentTab);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Recipe | "new">();
  const [details, setDetails] = useState<string>();
  const [portionDialog, setPortionDialog] = useState<{
    recipeId: string;
    entry?: SelectedMeal;
  }>();
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    label: string;
    action: () => Promise<boolean>;
  }>();
  const busyRef = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const load = useCallback(async () => {
    try {
      setState(await loadState());
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const onHash = () => {
      setTab(currentTab());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    const refresh = () => {
      if (document.visibilityState === "visible" && !busyRef.current)
        void load();
    };
    document.addEventListener("visibilitychange", refresh);
    if ("BroadcastChannel" in window) {
      const bus = new BroadcastChannel("serranotool-repas");
      channel.current = bus;
      bus.onmessage = () => {
        if (!busyRef.current) void load();
      };
    }
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("visibilitychange", refresh);
      channel.current?.close();
    };
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (
      state &&
      portionDialog &&
      !state.recipes.some((r) => r.id === portionDialog.recipeId)
    )
      setPortionDialog(undefined);
    if (state && details && !state.recipes.some((r) => r.id === details))
      setDetails(undefined);
  }, [state, portionDialog, details]);
  function navigate(next: Tab) {
    location.hash = next;
    setTab(next);
    window.scrollTo({ top: 0 });
  }
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
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function saveRecipe(recipe: Recipe, image: Blob | null | undefined) {
    const oldImage = state?.recipes.find((r) => r.id === recipe.id)?.imageId;
    const next = { ...recipe };
    const imageChange: ImageChange = {};
    if (image !== undefined) {
      if (oldImage) imageChange.remove = oldImage;
      delete next.imageId;
      if (image) {
        next.imageId = uid();
        imageChange.put = { id: next.imageId, blob: image };
      }
    }
    const ok = await mutate((s) => {
      if (editor !== "new" && !s.recipes.some((r) => r.id === next.id))
        throw new Error("Cette recette a été supprimée dans un autre onglet.");
      const recipes = s.recipes.some((r) => r.id === next.id)
        ? s.recipes.map((r) => (r.id === next.id ? next : r))
        : [...s.recipes, next];
      return { ...s, recipes, session: reconcileSession(s.session, recipes) };
    }, imageChange);
    if (ok) setNotice("Recette enregistrée.");
    return ok;
  }
  function deleteRecipe(recipe: Recipe) {
    const selectedCount =
      state?.session.selected
        .filter((e) => e.recipeId === recipe.id)
        .reduce((n, e) => n + e.meals, 0) ?? 0;
    setConfirmation({
      title: "Supprimer cette recette ?",
      text: `« ${recipe.name} » et sa photo seront supprimées.${selectedCount ? ` Les ${selectedCount} repas associés seront aussi retirés de la sélection.` : ""} La liste de courses déjà générée reste disponible.`,
      label: "Supprimer la recette",
      action: async () => {
        const ok = await mutate(
          (s) => {
            const recipes = s.recipes.filter((r) => r.id !== recipe.id);
            return {
              ...s,
              recipes,
              session: reconcileSession(s.session, recipes),
            };
          },
          { remove: recipe.imageId },
        );
        if (ok) {
          setDetails(undefined);
          setNotice("Recette supprimée.");
        }
        return ok;
      },
    });
  }
  function makeList() {
    const action = async () => {
      const ok = await mutate((s) => ({
        ...s,
        list: generateList(s.recipes, s.session),
      }));
      if (ok) {
        navigate("courses");
        setNotice("Votre liste de courses est prête.");
      }
      return ok;
    };
    if (state?.list)
      setConfirmation({
        title: "Remplacer votre liste ?",
        text: "La nouvelle liste remplacera entièrement la liste actuelle. Toutes les cases seront décochées.",
        label: "Générer et remplacer",
        action,
      });
    else void action();
  }
  const selectedMeals = state ? totalMeals(state.session.selected) : 0;
  const remaining = state ? state.session.target - selectedMeals : 0;
  const card = state?.recipes.find((r) => r.id === state.session.queue[0]);
  const detailRecipe = state?.recipes.find((r) => r.id === details);
  const dialogRecipe = state?.recipes.find(
    (r) => r.id === portionDialog?.recipeId,
  );
  const checkedCount = state?.list?.items.filter((i) => i.checked).length ?? 0;
  const pageHeader = (
    eyebrow: string,
    title: string,
    subtitle: string,
    action?: ReactNode,
  ) => (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action}
    </div>
  );

  if (!state)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <CookingPot />
        </div>
        <h1>Repas</h1>
        {error ? (
          <>
            <p className="inline-error" role="alert">
              {error}
            </p>
            <button className="button" onClick={() => void load()}>
              Réessayer
            </button>
          </>
        ) : (
          <p>Ouverture de votre carnet de recettes…</p>
        )}
      </div>
    );
  return (
    <>
      <header className="site-header">
        <a href="#repas" className="brand">
          <span className="brand-mark">
            <CookingPot size={23} />
          </span>
          <span>
            repas<span className="brand-byline">par SerranoTool</span>
          </span>
        </a>
        <span className="local-badge">
          <ShieldCheck size={15} />
          Votre carnet personnel
        </span>
      </header>
      <main id="main">
        {showSamplePanel && (
          <div className="sample-panel">
            <div>
              <strong>Votre jeu d’essai</strong>
              <p>
                8 recettes pour tester les portions, le swipe et les courses.
                Les calories sont des valeurs d’exemple. Vos recettes actuelles
                sont conservées.
              </p>
            </div>
            <div className="sample-actions">
              <button
                className="button"
                disabled={
                  busy ||
                  SAMPLE_RECIPES.every((r) =>
                    state.recipes.some((existing) => existing.id === r.id),
                  )
                }
                onClick={async () => {
                  if (await mutate(addSampleRecipes)) {
                    setNotice("Les 8 recettes d’essai sont disponibles.");
                  }
                }}
              >
                {SAMPLE_RECIPES.every((r) =>
                  state.recipes.some((existing) => existing.id === r.id),
                )
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
        {tab === "repas" && (
          <>
            {pageHeader(
              "UN PEU D’INSPIRATION",
              "Qu’est-ce qu’on mange ?",
              "Choisissez vos envies. On s’occupe de la liste.",
            )}
            <div className="planning-controls">
              <NumberField
                label="Repas à prévoir"
                value={state.session.target}
                min={Math.max(1, selectedMeals)}
                max={365}
                disabled={busy}
                onChange={(n) =>
                  void mutate((s) => {
                    if (
                      !positiveInteger(n, 365) ||
                      n < totalMeals(s.session.selected)
                    )
                      throw new Error(
                        "Retirez des repas de la sélection avant de réduire l’objectif.",
                      );
                    return { ...s, session: { ...s.session, target: n } };
                  })
                }
              />
              <div className="control-divider" />
              <NumberField
                label="Personnes par défaut"
                value={state.session.people}
                max={100}
                disabled={busy}
                onChange={(n) =>
                  void mutate((s) => ({
                    ...s,
                    session: { ...s.session, people: n },
                  }))
                }
              />
              <span className="planning-note">
                <Users size={17} />
                <strong>
                  {state.session.target * state.session.people}
                </strong>{" "}
                portions prévues au départ
              </span>
            </div>
            <div className="meal-layout">
              <section className="discovery" aria-label="Choisir vos repas">
                {!state.recipes.length ? (
                  <EmptyState
                    icon={<CookingPot size={42} />}
                    title="Le début d’un bon repas."
                    text="Ajoutez votre première recette, avec ses ingrédients et une photo si vous le souhaitez. Elle vous attendra ici."
                    action={
                      <button
                        className="button"
                        onClick={() => setEditor("new")}
                      >
                        <Plus size={18} />
                        Ajouter ma première recette
                      </button>
                    }
                  />
                ) : remaining === 0 ? (
                  <div className="complete-state">
                    <div className="complete-icon">
                      <CheckCheck size={44} />
                    </div>
                    <p className="eyebrow">TOUT EST AU MENU</p>
                    <h2>Vos repas sont prêts.</h2>
                    <p>
                      {selectedMeals} repas,{" "}
                      {totalPortions(state.session.selected)} portions.
                      <br />
                      Il ne reste plus qu’à remplir le panier.
                    </p>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={makeList}
                    >
                      <ShoppingBasket size={19} />
                      Générer ma liste de courses
                    </button>
                    <small>Vous pouvez encore ajuster votre sélection.</small>
                  </div>
                ) : card ? (
                  <SwipeCard
                    key={card.id}
                    recipe={card}
                    showCalories={state.settings.showCalories}
                    disabled={busy || !!portionDialog}
                    onDetails={() => setDetails(card.id)}
                    onDecision={(accept) => {
                      if (accept) setPortionDialog({ recipeId: card.id });
                      else
                        void mutate((s) => ({
                          ...s,
                          session: consumeCard(s.session, s.recipes, card.id),
                        }));
                    }}
                  />
                ) : null}
                {state.recipes.length > 0 && remaining > 0 && (
                  <p className="cycle-note">
                    Chaque recette passe une fois, puis on mélange à nouveau.
                  </p>
                )}
              </section>
              <aside className="selection-panel">
                <div className="section-line">
                  <h2>Votre sélection</h2>
                  <span className="small-icon">
                    <ListChecks size={19} />
                  </span>
                </div>
                <div className="selection-count" aria-live="polite">
                  <strong>
                    {selectedMeals}
                    <span> / {state.session.target}</span>
                  </strong>
                  <span>repas sélectionnés</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Repas sélectionnés"
                  aria-valuenow={selectedMeals}
                  aria-valuemin={0}
                  aria-valuemax={state.session.target}
                >
                  <span
                    style={{
                      width: `${(selectedMeals / state.session.target) * 100}%`,
                    }}
                  />
                </div>
                {!state.session.selected.length ? (
                  <div className="selection-empty">
                    <Heart size={27} strokeWidth={1.4} />
                    <p>
                      Vos coups de cœur
                      <br />
                      prendront place ici.
                    </p>
                  </div>
                ) : (
                  <div className="selected-list">
                    {state.session.selected.map((entry) => {
                      const recipe = state.recipes.find(
                        (r) => r.id === entry.recipeId,
                      )!;
                      return (
                        <div className="selected-item" key={entry.id}>
                          <RecipeImage
                            name={recipe.name}
                            imageId={recipe.imageId}
                          />
                          <button
                            className="selected-info"
                            disabled={busy}
                            onClick={() =>
                              setPortionDialog({ recipeId: recipe.id, entry })
                            }
                          >
                            <strong>{recipe.name}</strong>
                            <span>
                              {entry.meals} repas · {entry.portions} portions
                            </span>
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Modifier la sélection : ${recipe.name}`}
                            disabled={busy}
                            onClick={() =>
                              setPortionDialog({ recipeId: recipe.id, entry })
                            }
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Retirer ${recipe.name}`}
                            disabled={busy}
                            onClick={() =>
                              void mutate((s) => ({
                                ...s,
                                session: {
                                  ...s.session,
                                  selected: s.session.selected.filter(
                                    (e) => e.id !== entry.id,
                                  ),
                                },
                              }))
                            }
                          >
                            <X size={17} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="selection-footer">
                  <p>
                    {remaining ? (
                      <>
                        <strong>{remaining} repas</strong> à choisir encore
                      </>
                    ) : (
                      <>
                        <CircleCheck size={16} />
                        Votre objectif est atteint
                      </>
                    )}
                  </p>
                  <button
                    className="button full-width"
                    disabled={busy || remaining > 0}
                    onClick={makeList}
                  >
                    <ShoppingBasket size={18} />
                    Générer ma liste
                  </button>
                  {state.session.selected.length > 0 && (
                    <button
                      className="text-button reset-button"
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({
                          title: "Recommencer la sélection ?",
                          text: "Les plats sélectionnés seront retirés. Vos recettes et votre liste de courses actuelle seront conservées.",
                          label: "Recommencer",
                          action: () =>
                            mutate((s) => ({
                              ...s,
                              session: { ...s.session, selected: [] },
                            })),
                        })
                      }
                    >
                      <RotateCcw size={14} />
                      Nouvelle sélection
                    </button>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
        {tab === "recettes" && (
          <>
            {pageHeader(
              "VOTRE CARNET",
              "Les bonnes recettes.",
              `${state.recipes.length} recette${state.recipes.length > 1 ? "s" : ""} à retrouver, cuisiner et faire revenir au menu.`,
              <button className="button" onClick={() => setEditor("new")}>
                <Plus size={18} />
                Ajouter une recette
              </button>,
            )}
            {!state.recipes.length ? (
              <EmptyState
                icon={<BookOpen size={42} />}
                title="Votre carnet commence ici."
                text="Une recette de famille, un plat du quotidien… Ajoutez vos propres recettes pour préparer vos prochaines courses."
                action={
                  <button className="button" onClick={() => setEditor("new")}>
                    <Plus size={18} />
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
                      onClick={() => setDetails(recipe.id)}
                      aria-label={`Consulter ${recipe.name}`}
                    >
                      <RecipeImage
                        name={recipe.name}
                        imageId={recipe.imageId}
                      />
                      <div className="library-content">
                        <div className="recipe-meta">
                          <span>
                            <Users size={14} />
                            {recipe.referencePortions} portions
                          </span>
                          {state.settings.showCalories &&
                            recipe.calories !== undefined && (
                              <span>
                                <Flame size={14} />
                                {formatNumber(recipe.calories)} kcal / portion
                              </span>
                            )}
                        </div>
                        <h2>{recipe.name}</h2>
                        <span>{recipe.ingredients.length} ingrédients</span>
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
                        onClick={() => deleteRecipe(recipe)}
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
        {tab === "courses" && (
          <>
            {pageHeader(
              "LE PANIER, TOUT SIMPLEMENT",
              "Vos courses.",
              state.list
                ? `${state.list.meals} repas · ${state.list.portions} portions · liste du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(state.list.generatedAt))}`
                : "La liste de vos prochains bons repas.",
            )}
            {!state.list ? (
              <EmptyState
                icon={<ShoppingBasket size={42} />}
                title="Votre panier attend le menu."
                text="Choisissez vos repas, ajustez les portions puis générez votre liste. Vous la retrouverez ici, même après avoir fermé la page."
                action={
                  <button className="button" onClick={() => navigate("repas")}>
                    Choisir mes repas
                    <ArrowRight size={18} />
                  </button>
                }
              />
            ) : (
              <div className="shopping-layout">
                <section className="shopping-items">
                  <div className="shopping-progress">
                    <div>
                      <span className="small-icon">
                        <ShoppingBasket size={22} />
                      </span>
                      <div>
                        <strong>
                          {checkedCount} / {state.list.items.length} produits
                        </strong>
                        <span>
                          {checkedCount === state.list.items.length
                            ? "Tout est dans le panier. Bon appétit !"
                            : "Cochez au fil des rayons."}
                        </span>
                      </div>
                    </div>
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
                    if (!items.length) return null;
                    return (
                      <section className="shopping-category" key={category}>
                        <h2>
                          {category}
                          <span>{items.length}</span>
                        </h2>
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
                                        "La liste a changé dans un autre onglet. Vérifiez la nouvelle liste.",
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
                    );
                  })}
                </section>
                <aside className="shopping-summary">
                  <p className="eyebrow">DANS VOTRE MENU</p>
                  <h2>De quoi se régaler.</h2>
                  {state.list.dishes.map((dish, i) => (
                    <div className="dish-summary" key={i}>
                      <CookingPot size={18} />
                      <div>
                        <strong>{dish.name}</strong>
                        <span>
                          {dish.meals} repas · {dish.portions} portions
                        </span>
                      </div>
                    </div>
                  ))}
                  <p className="snapshot-note">
                    Cette liste garde les quantités calculées lors de sa
                    génération.
                  </p>
                  <button
                    className="button secondary full-width"
                    onClick={() => navigate("repas")}
                  >
                    Préparer mes repas
                    <ChevronRight size={17} />
                  </button>
                </aside>
              </div>
            )}
          </>
        )}
        {tab === "options" && (
          <>
            {pageHeader(
              "À VOTRE GOÛT",
              "Un petit réglage.",
              "Juste ce qu’il faut pour vous sentir chez vous.",
            )}
            <div className="options-card">
              <div className="option-row">
                <span className="option-icon">
                  <Flame size={25} />
                </span>
                <div>
                  <h2>Afficher les calories</h2>
                  <p>
                    Afficher les calories par portion quand elles sont
                    renseignées.
                  </p>
                </div>
                <button
                  type="button"
                  className={`switch ${state.settings.showCalories ? "on" : ""}`}
                  role="switch"
                  aria-label="Afficher les calories"
                  aria-checked={state.settings.showCalories}
                  disabled={busy}
                  onClick={() =>
                    void mutate((s) => ({
                      ...s,
                      settings: { showCalories: !s.settings.showCalories },
                    }))
                  }
                >
                  <span />
                </button>
              </div>
            </div>
            <p className="privacy-note">
              <ShieldCheck size={16} />
              Vos recettes et vos photos restent dans ce navigateur.
              <br />
              Chaque appareil possède son propre carnet.
            </p>
          </>
        )}
      </main>
      <footer className="page-footer">
        <Leaf size={14} />
        Moins d’hésitation. Plus de bons repas.
      </footer>
      <nav className="bottom-nav" aria-label="Navigation principale">
        {tabs.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className={tab === id ? "active" : ""}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.7} />
            <span>{label}</span>
            {id === "courses" &&
              state.list &&
              checkedCount < state.list.items.length && (
                <span className="nav-dot" />
              )}
          </a>
        ))}
      </nav>
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
      {details && detailRecipe && (
        <Modal title={detailRecipe.name} onClose={() => setDetails(undefined)}>
          <div className="recipe-detail">
            <RecipeImage
              name={detailRecipe.name}
              imageId={detailRecipe.imageId}
            />
            <div className="recipe-meta">
              <span>
                <Users size={15} />
                Pour {detailRecipe.referencePortions} portions
              </span>
              {state.settings.showCalories &&
                detailRecipe.calories !== undefined && (
                  <span>
                    <Flame size={15} />
                    {formatNumber(detailRecipe.calories)} kcal / portion
                  </span>
                )}
            </div>
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
      {portionDialog && dialogRecipe && (
        <PortionDialog
          key={portionDialog.entry?.id ?? dialogRecipe.id}
          recipe={dialogRecipe}
          people={state.session.people}
          maxMeals={remaining + (portionDialog.entry?.meals ?? 0)}
          entry={portionDialog.entry}
          busy={busy}
          saveError={error}
          onClose={() => setPortionDialog(undefined)}
          onSubmit={async (meals, portions) => {
            const entry = portionDialog.entry;
            const ok = await mutate((s) => {
              if (!s.recipes.some((r) => r.id === dialogRecipe.id))
                throw new Error("Cette recette a été supprimée.");
              if (entry && !s.session.selected.some((e) => e.id === entry.id))
                throw new Error(
                  "Cette sélection a été retirée dans un autre onglet.",
                );
              let session = setSelection(s.session, {
                id: entry?.id ?? uid(),
                recipeId: dialogRecipe.id,
                meals,
                portions,
              });
              if (!entry)
                session = consumeCard(session, s.recipes, dialogRecipe.id);
              return { ...s, session };
            });
            if (ok) {
              setPortionDialog(undefined);
              setNotice(
                entry ? "Quantités mises à jour." : "Recette ajoutée au menu.",
              );
            }
          }}
        />
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          onClose={() => {
            if (!busy) setConfirmation(undefined);
          }}
        >
          <p className="confirm-text">{confirmation.text}</p>
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
              onClick={async () => {
                if (await confirmation.action()) setConfirmation(undefined);
              }}
            >
              {busy ? "Enregistrement…" : confirmation.label}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function PortionDialog({
  recipe,
  entry,
  people,
  maxMeals,
  busy,
  onSubmit,
  onClose,
  saveError,
}: {
  recipe: Recipe;
  entry?: SelectedMeal;
  people: number;
  maxMeals: number;
  busy: boolean;
  onSubmit: (meals: number, portions: number) => Promise<void>;
  onClose: () => void;
  saveError?: string;
}) {
  const [meals, setMeals] = useState(entry?.meals ?? 1);
  const [portions, setPortions] = useState(entry?.portions ?? people);
  const [customPortions, setCustomPortions] = useState(!!entry);
  return (
    <Modal
      title={entry ? "Ajuster ce plat" : "On le met au menu ?"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="portion-recipe">
        <RecipeImage name={recipe.name} imageId={recipe.imageId} />
        <div>
          <h3>{recipe.name}</h3>
          <span>
            {maxMeals} repas disponible{maxMeals > 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="portion-fields">
        <NumberField
          label="Nombre de repas pour ce plat"
          value={meals}
          max={Math.max(1, maxMeals)}
          disabled={busy}
          onChange={(n) => {
            setMeals(n);
            if (!customPortions) setPortions(Math.min(10000, n * people));
          }}
        />
        <NumberField
          label="Nombre total de portions"
          value={portions}
          disabled={busy}
          onChange={(n) => {
            setCustomPortions(true);
            setPortions(n);
          }}
          hint="Les ingrédients seront calculés pour ce nombre de portions."
        />
      </div>
      <p className="portion-hint">
        {meals} repas dans votre objectif · {portions} portions à cuisiner
      </p>
      {saveError && (
        <p className="inline-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="form-footer">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Annuler
        </button>
        <button
          className="button"
          disabled={busy || meals > maxMeals}
          onClick={() => void onSubmit(meals, portions)}
        >
          <Check size={18} />
          {entry ? "Mettre à jour" : "Ajouter au menu"}
        </button>
      </div>
    </Modal>
  );
}
