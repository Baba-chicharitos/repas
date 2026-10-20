import {
  emptyState,
  positiveInteger,
  reconcileSession,
  totalMeals,
  validateRecipe,
} from "./domain";
import {
  CATEGORIES,
  UNITS,
  type AppState,
  type Recipe,
  type SelectedMeal,
  type ShoppingList,
} from "./types";

const DB_NAME = "serranotool-repas-v1";
let connection: Promise<IDBDatabase> | undefined;
export function openDatabase(): Promise<IDBDatabase> {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("state");
        request.result.createObjectStore("images");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
      request.onerror = () => {
        connection = undefined;
        reject(request.error);
      };
      request.onblocked = () =>
        reject(
          new Error(
            "Fermez les autres onglets Repas puis rechargez cette page.",
          ),
        );
    });
  return connection;
}

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== "object") return false;
  const r = value as Recipe;
  if (
    typeof r.id !== "string" ||
    typeof r.name !== "string" ||
    !Array.isArray(r.ingredients) ||
    (r.imageId !== undefined && typeof r.imageId !== "string")
  )
    return false;
  if (
    r.ingredients.some(
      (i) => !i || typeof i.name !== "string" || typeof i.id !== "string",
    )
  )
    return false;
  try {
    validateRecipe(r);
    return true;
  } catch {
    return false;
  }
}

function isList(value: unknown): value is ShoppingList {
  if (!value || typeof value !== "object") return false;
  const list = value as ShoppingList;
  return (
    typeof list.generatedAt === "string" &&
    Number.isFinite(Date.parse(list.generatedAt)) &&
    positiveInteger(list.meals, 365) &&
    positiveInteger(list.portions, 3650000) &&
    Array.isArray(list.dishes) &&
    list.dishes.every(
      (d) =>
        d &&
        typeof d.name === "string" &&
        positiveInteger(d.meals, 365) &&
        positiveInteger(d.portions),
    ) &&
    Array.isArray(list.items) &&
    list.items.every(
      (i) =>
        i &&
        typeof i.id === "string" &&
        typeof i.name === "string" &&
        Number.isFinite(i.quantity) &&
        i.quantity >= 0 &&
        UNITS.includes(i.unit) &&
        CATEGORIES.includes(i.category) &&
        typeof i.checked === "boolean",
    )
  );
}

// Salvage valid records independently, so a damaged record cannot crash the app.
export function sanitizeState(raw: unknown): AppState {
  const fallback = emptyState();
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<AppState>;
  if (data.version !== 1)
    throw new Error(
      "Cette version des données nécessite une version plus récente de l’application.",
    );
  const recipes = Array.isArray(data.recipes)
    ? data.recipes
        // Invalid optional nutrition metadata must never discard a legacy recipe.
        .map((r) => {
          if (!r || !Array.isArray(r.ingredients)) return r;
          return {
            ...r,
            ingredients: r.ingredients.map((i) => {
              if (!i || typeof i !== "object") return i;
              const clean = { ...i };
              if (
                clean.ingredientOptionId !== undefined &&
                (typeof clean.ingredientOptionId !== "string" ||
                  !clean.ingredientOptionId.trim() ||
                  clean.ingredientOptionId.length > 200)
              )
                delete clean.ingredientOptionId;
              if (
                clean.ciqualCode !== undefined &&
                (typeof clean.ciqualCode !== "string" ||
                  !/^\d+$/.test(clean.ciqualCode))
              ) {
                delete clean.ciqualCode;
                delete clean.ingredientOptionId;
                delete clean.gramsPerUnit;
              }
              if (
                clean.gramsPerUnit !== undefined &&
                (!Number.isFinite(clean.gramsPerUnit) ||
                  clean.gramsPerUnit <= 0 ||
                  clean.gramsPerUnit > 1000000)
              )
                delete clean.gramsPerUnit;
              return clean;
            }),
          };
        })
        .filter(isRecipe)
        .filter((r, i, arr) => arr.findIndex((v) => v.id === r.id) === i)
    : [];
  const s = data.session;
  const target = positiveInteger(s?.target ?? 0, 365) ? s!.target : 7;
  const selected: SelectedMeal[] = [];
  if (Array.isArray(s?.selected))
    for (const entry of s.selected) {
      if (
        entry &&
        typeof entry.id === "string" &&
        !selected.some((e) => e.id === entry.id) &&
        recipes.some((r) => r.id === entry.recipeId) &&
        positiveInteger(entry.meals, 365) &&
        positiveInteger(entry.portions) &&
        totalMeals(selected) + entry.meals <= target
      )
        selected.push(entry);
    }
  return {
    version: 1,
    recipes,
    session: reconcileSession(
      {
        started: s?.started === true || selected.length > 0,
        target,
        people: positiveInteger(s?.people ?? 0, 100) ? s!.people : 2,
        selected,
        queue: Array.isArray(s?.queue)
          ? s.queue.filter((id) => typeof id === "string")
          : [],
        seen: Array.isArray(s?.seen)
          ? s.seen.filter((id) => typeof id === "string")
          : [],
      },
      recipes,
    ),
    settings: { showCalories: data.settings?.showCalories === true },
    list: isList(data.list) ? data.list : null,
  };
}

export async function loadState(): Promise<AppState> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readonly");
    const request = tx.objectStore("state").get("current");
    request.onsuccess = () => {
      try {
        resolve(
          request.result === undefined
            ? emptyState()
            : sanitizeState(request.result),
        );
      } catch (e) {
        reject(e);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export interface ImageChange {
  put?: { id: string; blob: Blob };
  remove?: string;
}
// Read-modify-write in one transaction also serializes changes from other tabs.
export async function updateState(
  change: (state: AppState) => AppState,
  image?: ImageChange,
): Promise<AppState> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["state", "images"], "readwrite");
    const store = tx.objectStore("state");
    const request = store.get("current");
    let next: AppState;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        next = change(
          request.result === undefined
            ? emptyState()
            : sanitizeState(request.result),
        );
        store.put(next, "current");
        if (image?.remove) tx.objectStore("images").delete(image.remove);
        if (image?.put)
          tx.objectStore("images").put(image.put.blob, image.put.id);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = () =>
      reject(
        failure ?? tx.error ?? new Error("La sauvegarde locale a échoué."),
      );
    tx.onerror = () => {
      failure ??= tx.error;
    };
  });
}

export async function loadImage(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("images", "readonly")
      .objectStore("images")
      .get(id);
    request.onsuccess = () =>
      resolve(request.result instanceof Blob ? request.result : undefined);
    request.onerror = () => reject(request.error);
  });
}
