import {
  CATEGORIES,
  UNITS,
  type AppState,
  type Recipe,
  type SelectedMeal,
  type SelectionSession,
  type ShoppingList,
  type Unit,
} from "./types";

// randomUUID is unavailable on HTTP LAN origins; getRandomValues remains usable.
export const uid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export const totalMeals = (selected: SelectedMeal[]) =>
  selected.reduce((n, entry) => n + entry.meals, 0);
export const totalPortions = (selected: SelectedMeal[]) =>
  selected.reduce((n, entry) => n + entry.portions, 0);
export const positiveInteger = (n: number, max = 10000) =>
  Number.isInteger(n) && n > 0 && n <= max;
export const normalizeName = (name: string) =>
  name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
export const formatNumber = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(n);
export function emptyState(): AppState {
  return {
    version: 1,
    recipes: [],
    session: { target: 7, people: 2, selected: [], queue: [], seen: [] },
    settings: { showCalories: false },
    list: null,
  };
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i]!;
    result[i] = result[j]!;
    result[j] = a;
  }
  return result;
}

// The current card remains at queue[0] until an explicit decision is committed.
export function reconcileSession(
  session: SelectionSession,
  recipes: Recipe[],
): SelectionSession {
  const ids = recipes.map((r) => r.id);
  const valid = new Set(ids);
  const seen = [...new Set(session.seen)].filter((id) => valid.has(id));
  const seenSet = new Set(seen);
  const queue = [...new Set(session.queue)].filter(
    (id) => valid.has(id) && !seenSet.has(id),
  );
  const queued = new Set(queue);
  const added = ids.filter((id) => !seenSet.has(id) && !queued.has(id));
  if (added.length) {
    if (queue.length)
      queue.splice(
        1,
        queue.length - 1,
        ...shuffle([...queue.slice(1), ...added]),
      );
    else queue.push(...shuffle(added));
  }
  const selected = session.selected.filter((entry) =>
    valid.has(entry.recipeId),
  );
  if (!queue.length && ids.length)
    return { ...session, queue: shuffle(ids), seen: [], selected };
  return { ...session, queue, seen, selected };
}

export function consumeCard(
  session: SelectionSession,
  recipes: Recipe[],
  recipeId: string,
): SelectionSession {
  if (session.queue[0] !== recipeId)
    throw new Error("La carte a changé. Réessayez avec la recette affichée.");
  return reconcileSession(
    {
      ...session,
      queue: session.queue.slice(1),
      seen: [...session.seen, recipeId],
    },
    recipes,
  );
}

export function setSelection(
  session: SelectionSession,
  entry: SelectedMeal,
): SelectionSession {
  if (!positiveInteger(entry.meals, 365) || !positiveInteger(entry.portions))
    throw new Error(
      "Indiquez des nombres entiers strictement positifs (maximum : 365 repas et 10 000 portions).",
    );
  const selected = session.selected.filter((item) => item.id !== entry.id);
  if (totalMeals(selected) + entry.meals > session.target)
    throw new Error("Ce nombre de repas dépasse votre objectif.");
  return {
    ...session,
    selected: session.selected.some((item) => item.id === entry.id)
      ? session.selected.map((item) => (item.id === entry.id ? entry : item))
      : [...selected, entry],
  };
}

export function validateRecipe(recipe: Recipe): void {
  if (!recipe.name.trim() || recipe.name.length > 120)
    throw new Error("Le nom du plat est obligatoire (120 caractères maximum).");
  if (!positiveInteger(recipe.referencePortions))
    throw new Error(
      "Le nombre de portions de référence doit être un entier positif.",
    );
  if (
    recipe.calories !== undefined &&
    (!Number.isFinite(recipe.calories) ||
      recipe.calories < 0 ||
      recipe.calories > 100000)
  )
    throw new Error("Les calories doivent être comprises entre 0 et 100 000.");
  if (!recipe.ingredients.length)
    throw new Error("Ajoutez au moins un ingrédient.");
  for (const ingredient of recipe.ingredients) {
    if (!ingredient.name.trim() || ingredient.name.length > 120)
      throw new Error(
        "Chaque ingrédient doit avoir un nom (120 caractères maximum).",
      );
    if (
      !Number.isFinite(ingredient.quantity) ||
      ingredient.quantity < 0 ||
      ingredient.quantity > 1000000
    )
      throw new Error(
        "Les quantités doivent être comprises entre 0 et 1 000 000.",
      );
    if (
      !UNITS.includes(ingredient.unit) ||
      !CATEGORIES.includes(ingredient.category)
    )
      throw new Error("Vérifiez les unités et catégories des ingrédients.");
  }
}

function baseUnit(unit: Unit): [Unit, number] {
  if (unit === "kg") return ["g", 1000];
  if (unit === "L") return ["ml", 1000];
  return [unit, 1];
}

// Decimal arithmetic via rational BigInts: no rounding before the final sum.
function fraction(n: number): [bigint, bigint] {
  const [mantissa, exponent = "0"] = n.toString().toLowerCase().split("e");
  const decimals = (mantissa!.split(".")[1] ?? "").length - Number(exponent);
  const numerator = BigInt(mantissa!.replace(".", ""));
  return decimals >= 0
    ? [numerator, 10n ** BigInt(decimals)]
    : [numerator * 10n ** BigInt(-decimals), 1n];
}
function gcd(a: bigint, b: bigint): bigint {
  return b ? gcd(b, a % b) : a;
}
function add(a: [bigint, bigint], b: [bigint, bigint]): [bigint, bigint] {
  const numerator = a[0] * b[1] + b[0] * a[1];
  const denominator = a[1] * b[1];
  const divisor = gcd(numerator, denominator);
  return [numerator / divisor, denominator / divisor];
}

export function generateList(
  recipes: Recipe[],
  session: SelectionSession,
): ShoppingList {
  if (
    !session.selected.length ||
    totalMeals(session.selected) !== session.target
  )
    throw new Error(
      "Complétez votre objectif de repas avant de générer la liste.",
    );
  const grouped = new Map<
    string,
    {
      name: string;
      unit: Unit;
      category: (typeof CATEGORIES)[number];
      amount: [bigint, bigint];
    }
  >();
  const dishes: ShoppingList["dishes"] = [];
  for (const entry of session.selected) {
    const recipe = recipes.find((r) => r.id === entry.recipeId);
    if (!recipe)
      throw new Error("Une recette a été supprimée. Vérifiez votre sélection.");
    validateRecipe(recipe);
    if (!positiveInteger(entry.portions) || !positiveInteger(entry.meals, 365))
      throw new Error("Vérifiez les portions et les repas sélectionnés.");
    dishes.push({
      name: recipe.name,
      meals: entry.meals,
      portions: entry.portions,
    });
    for (const ingredient of recipe.ingredients) {
      const [unit, factor] = baseUnit(ingredient.unit);
      const key = JSON.stringify([normalizeName(ingredient.name), unit]);
      const [numerator, denominator] = fraction(ingredient.quantity);
      const amount: [bigint, bigint] = [
        numerator * BigInt(factor) * BigInt(entry.portions),
        denominator * BigInt(recipe.referencePortions),
      ];
      const existing = grouped.get(key);
      if (existing) existing.amount = add(existing.amount, amount);
      else
        grouped.set(key, {
          name: ingredient.name.trim().replace(/\s+/g, " "),
          unit,
          category: ingredient.category,
          amount,
        });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    meals: totalMeals(session.selected),
    portions: totalPortions(session.selected),
    dishes,
    items: [...grouped.entries()]
      .map(([id, item]) => {
        let quantity = Number(item.amount[0]) / Number(item.amount[1]);
        let unit = item.unit;
        if (quantity >= 1000 && (unit === "g" || unit === "ml")) {
          quantity /= 1000;
          unit = unit === "g" ? "kg" : "L";
        }
        return {
          id,
          name: item.name,
          category: item.category,
          quantity: Math.round(quantity * 1e6) / 1e6,
          unit,
          checked: false,
        };
      })
      .sort(
        (a, b) =>
          CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
          a.name.localeCompare(b.name, "fr"),
      ),
  };
}
