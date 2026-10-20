// Raw import keeps the 3,484-record catalogue out of TypeScript's literal-type
// inference. Vite still bundles it locally; runtime validation checks its schema.
import rawDatabase from "./data/ciqual-2025.json?raw";
import {
  CATEGORIES,
  NUTRIENTS,
  type CiqualDatabase,
  type CiqualFood,
  type IngredientSuggestion,
  type IngredientSuggestionGroup,
} from "./types";

// Check the actual JSON at runtime: a TypeScript assertion cannot validate data.
export function validateCiqualDatabase(raw: unknown): CiqualDatabase {
  const fail = (): never => {
    throw new Error("La base Ciqual locale est invalide.");
  };
  if (!raw || typeof raw !== "object") return fail();
  const database = raw as CiqualDatabase;
  const source = database.source;
  if (
    database.schemaVersion !== 1 ||
    !source ||
    source.publisher !== "Anses" ||
    source.table !== "Ciqual" ||
    source.edition !== "2025" ||
    typeof source.sourceUrl !== "string" ||
    source.energyMethod !== "EU_1169_2011" ||
    source.proteinMethod !== "N_x_6.25" ||
    !Array.isArray(database.foods) ||
    !database.foods.length
  )
    return fail();
  const codes = new Set<string>();
  for (const food of database.foods) {
    if (
      !food ||
      typeof food.ciqualCode !== "string" ||
      !/^\d+$/.test(food.ciqualCode) ||
      codes.has(food.ciqualCode) ||
      typeof food.nameFr !== "string" ||
      !food.nameFr.trim() ||
      !Array.isArray(food.aliases) ||
      food.aliases.some((a) => typeof a !== "string") ||
      !food.per100g
    )
      return fail();
    codes.add(food.ciqualCode);
    if (
      (food.isIngredientCandidate !== undefined &&
        typeof food.isIngredientCandidate !== "boolean") ||
      (food.ingredientFamily !== undefined &&
        typeof food.ingredientFamily !== "string") ||
      (food.variantLabel !== undefined &&
        typeof food.variantLabel !== "string") ||
      (food.category !== undefined && !CATEGORIES.includes(food.category)) ||
      (food.searchPriority !== undefined &&
        !Number.isFinite(food.searchPriority))
    )
      return fail();
    for (const key of NUTRIENTS) {
      const nutrient = food.per100g[key];
      if (
        !nutrient ||
        (nutrient.raw !== null && typeof nutrient.raw !== "string")
      )
        return fail();
      if (
        nutrient.qualifier === "numeric" ||
        nutrient.qualifier === "less_than"
      ) {
        if (
          typeof nutrient.value !== "number" ||
          !Number.isFinite(nutrient.value) ||
          nutrient.value < 0 ||
          (nutrient.qualifier === "less_than" && nutrient.value === 0)
        )
          return fail();
      } else if (
        nutrient.qualifier === "trace" ||
        nutrient.qualifier === "missing"
      ) {
        if (nutrient.value !== null) return fail();
      } else return fail();
    }
  }
  if (database.families !== undefined) {
    if (!Array.isArray(database.families)) return fail();
    for (const family of database.families) {
      if (
        !family ||
        typeof family.id !== "string" ||
        !family.id ||
        typeof family.label !== "string" ||
        !family.label ||
        !Array.isArray(family.aliases) ||
        family.aliases.some((alias) => typeof alias !== "string") ||
        !Array.isArray(family.ciqualCodes) ||
        family.ciqualCodes.some((code) => !codes.has(code))
      )
        return fail();
    }
  }
  if (database.ingredientOptions !== undefined) {
    if (!Array.isArray(database.ingredientOptions)) return fail();
    const ids = new Set<string>();
    for (const option of database.ingredientOptions) {
      if (
        !option ||
        typeof option.id !== "string" ||
        !option.id ||
        ids.has(option.id) ||
        typeof option.label !== "string" ||
        !option.label ||
        typeof option.ingredientFamily !== "string" ||
        !codes.has(option.ciqualCode) ||
        option.nutritionReference !== "generic_equivalent" ||
        option.isExactCiqualEntry !== false ||
        typeof option.nutritionReferenceLabel !== "string" ||
        !Array.isArray(option.searchAliases) ||
        option.searchAliases.some((alias) => typeof alias !== "string") ||
        !CATEGORIES.includes(option.category) ||
        (option.searchPriority !== undefined &&
          !Number.isFinite(option.searchPriority))
      )
        return fail();
      ids.add(option.id);
    }
  }
  return database;
}

export const ciqualDatabase = validateCiqualDatabase(JSON.parse(rawDatabase));
const byCode = new Map(
  ciqualDatabase.foods.map((food) => [food.ciqualCode, food]),
);
export const getCiqualFood = (code?: string): CiqualFood | undefined =>
  code ? byCode.get(code) : undefined;

// Normalization is used only for suggestions, never for automatic association.
export const normalizeIngredientSearch = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const indexed = ciqualDatabase.foods
  .filter((food) => food.isIngredientCandidate === true)
  .map((food) => ({
    food,
    name: normalizeIngredientSearch(food.nameFr),
    text: normalizeIngredientSearch(
      [food.nameFr, ...food.aliases, food.ciqualCode].join(" "),
    ),
  }));
export function searchCiqualFoods(query: string, limit = 20): CiqualFood[] {
  const normalized = normalizeIngredientSearch(query);
  if (normalized.length < 2 || !Number.isInteger(limit) || limit <= 0)
    return [];
  const terms = normalized.split(" ");
  return indexed
    .filter((entry) => terms.every((term) => entry.text.includes(term)))
    .sort((a, b) => {
      const rank = (entry: typeof a) =>
        entry.food.ciqualCode === query.trim() || entry.name === normalized
          ? 0
          : entry.name.startsWith(normalized)
            ? 1
            : 2;
      return (
        rank(a) - rank(b) || a.food.nameFr.localeCompare(b.food.nameFr, "fr")
      );
    })
    .slice(0, Math.min(limit, 100))
    .map((entry) => entry.food);
}

const optionsById = new Map(
  (ciqualDatabase.ingredientOptions ?? []).map((option) => [option.id, option]),
);
export const getIngredientOption = (id?: string, code?: string) => {
  const option = id ? optionsById.get(id) : undefined;
  return option && (code === undefined || option.ciqualCode === code)
    ? option
    : undefined;
};
const familyByCode = new Map(
  (ciqualDatabase.families ?? []).flatMap((family) =>
    family.ciqualCodes.map((code) => [code, family] as const),
  ),
);
const familyByLabel = new Map(
  (ciqualDatabase.families ?? []).map((family) => [family.label, family]),
);
const suggestions: IngredientSuggestion[] = [
  ...ciqualDatabase.foods
    .filter((food) => food.isIngredientCandidate === true)
    .map((food) => ({
      id: `ciqual:${food.ciqualCode}`,
      label: food.nameFr,
      family:
        familyByCode.get(food.ciqualCode)?.label ??
        food.ingredientFamily ??
        "Autres ingrédients",
      variantLabel: food.variantLabel ?? food.nameFr,
      food,
      category: food.category,
      priority: food.searchPriority ?? 100,
    })),
  ...(ciqualDatabase.ingredientOptions ?? []).flatMap((option) => {
    const food = getCiqualFood(option.ciqualCode);
    return food?.isIngredientCandidate === true
      ? [
          {
            id: `option:${option.id}`,
            label: option.label,
            family: option.ingredientFamily,
            variantLabel: option.label,
            food,
            option,
            category: option.category,
            priority: option.searchPriority ?? 60,
          },
        ]
      : [];
  }),
];
const suggestionIndex = suggestions.map((suggestion) => {
  const family = familyByLabel.get(suggestion.family);
  return {
    suggestion,
    label: normalizeIngredientSearch(suggestion.label),
    familyTerms: [suggestion.family, ...(family?.aliases ?? [])].map(
      normalizeIngredientSearch,
    ),
    text: normalizeIngredientSearch(
      [
        suggestion.label,
        suggestion.variantLabel,
        suggestion.family,
        ...(family?.aliases ?? []),
        ...(suggestion.option?.searchAliases ?? suggestion.food.aliases),
        suggestion.food.ciqualCode,
      ].join(" "),
    ),
  };
});

export function searchIngredientGroups(
  query: string,
  limit = 80,
): IngredientSuggestionGroup[] {
  const normalized = normalizeIngredientSearch(query);
  if (normalized.length < 2 || !Number.isInteger(limit) || limit <= 0)
    return [];
  const terms = normalized.split(" ");
  const matched = suggestionIndex.filter((entry) =>
    terms.every((term) => entry.text.includes(term)),
  );
  const rank = (entry: (typeof suggestionIndex)[number]) =>
    entry.suggestion.food.ciqualCode === query.trim()
      ? 0
      : entry.label === normalized || entry.familyTerms.includes(normalized)
        ? 1
        : entry.familyTerms.some((label) => label.startsWith(normalized))
          ? 2
          : entry.label.startsWith(normalized)
            ? 3
            : 4;
  matched.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.suggestion.priority - b.suggestion.priority ||
      a.suggestion.label.localeCompare(b.suggestion.label, "fr"),
  );
  const groups = new Map<string, IngredientSuggestionGroup>();
  for (const entry of matched.slice(0, Math.min(limit, 200))) {
    const { suggestion } = entry;
    const group = groups.get(suggestion.family) ?? {
      family: suggestion.family,
      suggestions: [],
    };
    group.suggestions.push(suggestion);
    groups.set(suggestion.family, group);
  }
  return [...groups.values()];
}
