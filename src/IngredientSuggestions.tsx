import { useEffect, useRef } from "react";
import type {
  Ingredient,
  IngredientSuggestion,
  IngredientSuggestionGroup,
} from "./types";

export function ingredientSuggestionChange(
  suggestion: IngredientSuggestion,
  currentName: string,
  rename = true,
): Partial<Ingredient> {
  return {
    name: (rename || suggestion.option ? suggestion.label : currentName).slice(
      0,
      120,
    ),
    ciqualCode: suggestion.food.ciqualCode,
    ingredientOptionId: suggestion.option?.id,
    gramsPerUnit: undefined,
    ...(suggestion.category ? { category: suggestion.category } : {}),
  };
}
export function IngredientSuggestions({
  groups,
  id,
  activeId,
  onSelect,
  keyboardInput = false,
}: {
  groups: IngredientSuggestionGroup[];
  id: string;
  activeId?: string;
  keyboardInput?: boolean;
  onSelect: (suggestion: IngredientSuggestion) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeId)
      list.current
        ?.querySelector<HTMLElement>(
          `[data-suggestion-id="${CSS.escape(activeId)}"]`,
        )
        ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);
  return (
    <div
      ref={list}
      id={id}
      role="listbox"
      aria-label="Variantes d’ingrédients"
      className="ciqual-results"
    >
      {groups.map((group) => (
        <div
          role="group"
          aria-label={group.family}
          key={group.family}
          className="ingredient-family"
        >
          <p className="ingredient-family-title">
            {group.family} <small>{group.suggestions.length} variantes</small>
          </p>
          {group.suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              id={`${id}-${suggestion.id}`}
              type="button"
              role="option"
              data-suggestion-id={suggestion.id}
              aria-selected={suggestion.id === activeId}
              tabIndex={keyboardInput ? -1 : 0}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(suggestion)}
            >
              <span>
                {suggestion.variantLabel.replace(
                  /appertis(?:ées|és|ée|é)/gi,
                  "en conserve",
                )}
              </span>
              <small>
                {suggestion.food.nameFr} · Code {suggestion.food.ciqualCode}
              </small>
              {suggestion.option && (
                <small className="generic-reference">
                  Valeurs nutritionnelles génériques ·{" "}
                  {suggestion.option.nutritionReferenceLabel}
                </small>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
