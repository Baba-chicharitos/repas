import { useEffect, useId, useRef, useState } from "react";
import { searchIngredientGroups } from "./ciqual";
import {
  IngredientSuggestions,
  ingredientSuggestionChange,
} from "./IngredientSuggestions";
import type { Ingredient, IngredientSuggestion } from "./types";

export function IngredientNameInput({
  ingredient,
  onChange,
}: {
  ingredient: Omit<Ingredient, "quantity">;
  onChange: (change: Partial<Ingredient>) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const groups = open ? searchIngredientGroups(ingredient.name) : [];
  const choices = groups.flatMap((group) => group.suggestions);
  const activeChoice = choices[active];
  const hasChoices = choices.length > 0;
  useEffect(() => {
    if (open && hasChoices) input.current?.scrollIntoView({ block: "start" });
  }, [open, hasChoices]);
  function select(suggestion: IngredientSuggestion) {
    onChange(ingredientSuggestionChange(suggestion, ingredient.name));
    setOpen(false);
    setActive(-1);
  }
  return (
    <div className="ingredient-name">
      <label className="field">
        Nom
        <input
          ref={input}
          required
          maxLength={120}
          value={ingredient.name}
          placeholder="Tomates, pâtes, œufs…"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && choices.length > 0}
          aria-controls={open && choices.length ? id : undefined}
          aria-activedescendant={
            activeChoice ? `${id}-${activeChoice.id}` : undefined
          }
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setActive(-1);
          }}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onChange={(event) => {
            onChange({
              name: event.target.value,
              ciqualCode: undefined,
              ingredientOptionId: undefined,
              gramsPerUnit: undefined,
            });
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActive(-1);
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                choices.length
                  ? (current +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      choices.length) %
                    choices.length
                  : -1,
              );
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              if (activeChoice) select(activeChoice);
            }
          }}
        />
      </label>
      {open && choices.length > 0 && (
        <div className="ingredient-autocomplete">
          <small>
            Choisissez une variante pour l’associer. Votre saisie seule ne
            suffit pas.
          </small>
          <IngredientSuggestions
            groups={groups}
            id={id}
            activeId={activeChoice?.id}
            onSelect={select}
            keyboardInput
          />
        </div>
      )}
    </div>
  );
}
