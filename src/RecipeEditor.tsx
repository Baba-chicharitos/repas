import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import {
  CATEGORIES,
  UNITS,
  type Category,
  type Ingredient,
  type Recipe,
  type Unit,
} from "./types";
import { uid, validateRecipe } from "./domain";
import { compressImage } from "./images";
import { Modal, RecipeImage } from "./components";

const newIngredient = (): Ingredient => ({
  id: uid(),
  name: "",
  quantity: 1,
  unit: "g",
  category: "Autres",
});
export function RecipeEditor({
  recipe,
  onClose,
  onSave,
  saveError,
}: {
  recipe?: Recipe;
  onClose: () => void;
  onSave: (recipe: Recipe, image: Blob | null | undefined) => Promise<boolean>;
  saveError?: string;
}) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [portions, setPortions] = useState(
    String(recipe?.referencePortions ?? 2),
  );
  const [calories, setCalories] = useState(
    recipe?.calories === undefined ? "" : String(recipe.calories),
  );
  const [ingredients, setIngredients] = useState<
    (Omit<Ingredient, "quantity"> & { quantity: string })[]
  >(
    (recipe?.ingredients ?? [newIngredient()]).map((i) => ({
      ...i,
      quantity: String(i.quantity),
    })),
  );
  const [image, setImage] = useState<Blob | null>();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageRequest = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  function updateIngredient(
    id: string,
    change: Partial<(typeof ingredients)[number]>,
  ) {
    setIngredients((rows) =>
      rows.map((i) => (i.id === id ? { ...i, ...change } : i)),
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || processing) return;
    const next: Recipe = {
      id: recipe?.id ?? uid(),
      name: name.trim(),
      referencePortions: Number(portions),
      ingredients: ingredients.map((i) => ({
        ...i,
        name: i.name.trim(),
        quantity: i.quantity.trim() === "" ? NaN : Number(i.quantity),
      })),
      ...(calories.trim() !== "" ? { calories: Number(calories) } : {}),
      ...(recipe?.imageId ? { imageId: recipe.imageId } : {}),
    };
    try {
      validateRecipe(next);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setSaving(true);
    if (await onSave(next, image)) onClose();
    else setSaving(false);
  }
  async function chooseImage(file?: File) {
    if (!file) return;
    const request = ++imageRequest.current;
    setProcessing(true);
    setError("");
    try {
      const result = await compressImage(file);
      if (request === imageRequest.current) setImage(result);
    } catch (e) {
      if (request === imageRequest.current) setError((e as Error).message);
    } finally {
      if (request === imageRequest.current) setProcessing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  return (
    <Modal
      title={recipe ? "Modifier la recette" : "Une nouvelle recette"}
      wide
      onClose={() => {
        if (!saving) {
          imageRequest.current++;
          onClose();
        }
      }}
    >
      <form onSubmit={(e) => void submit(e)} className="recipe-form">
        <fieldset disabled={saving}>
          <div className="image-editor">
            <RecipeImage
              name={name || "Votre recette"}
              imageId={image === undefined ? recipe?.imageId : undefined}
              blob={image ?? undefined}
            />
            <div className="image-editor-actions">
              <button
                type="button"
                className="button secondary"
                disabled={processing}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={18} />
                {processing ? "Compression…" : "Choisir une photo"}
              </button>
              {(image || (image === undefined && recipe?.imageId)) && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Supprimer la photo"
                  onClick={() => {
                    imageRequest.current++;
                    setProcessing(false);
                    setImage(null);
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              aria-label="Photo de la recette"
              onChange={(e) => void chooseImage(e.target.files?.[0])}
            />
            <small>
              JPEG, PNG ou WebP · 25 Mo maximum · compression automatique
            </small>
          </div>
          <label className="field">
            Nom du plat
            <input
              autoFocus
              required
              maxLength={120}
              value={name}
              placeholder="Par exemple, vos fameuses lasagnes"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="form-columns">
            <label className="field">
              Portions de référence
              <input
                type="number"
                required
                min="1"
                max="10000"
                step="1"
                inputMode="numeric"
                value={portions}
                onChange={(e) => setPortions(e.target.value)}
              />
              <small>
                Les ingrédients ci-dessous correspondent à ce nombre de
                portions.
              </small>
            </label>
            <label className="field">
              Calories par portion <span className="optional">facultatif</span>
              <input
                type="number"
                min="0"
                max="100000"
                step="any"
                inputMode="decimal"
                value={calories}
                placeholder="kcal"
                onChange={(e) => setCalories(e.target.value)}
              />
            </label>
          </div>
          <div className="section-line">
            <h3>Les ingrédients</h3>
            <span>
              {ingredients.length} ligne{ingredients.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="ingredient-editor">
            {ingredients.map((ingredient, index) => (
              <div className="ingredient-row" key={ingredient.id}>
                <div className="ingredient-row-heading">
                  <span>Ingrédient {index + 1}</span>
                  <button
                    type="button"
                    className="icon-button danger-text"
                    disabled={ingredients.length === 1}
                    aria-label={`Supprimer l’ingrédient ${index + 1}`}
                    onClick={() =>
                      setIngredients((rows) =>
                        rows.filter((i) => i.id !== ingredient.id),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <label className="field ingredient-name">
                  Nom
                  <input
                    required
                    maxLength={120}
                    value={ingredient.name}
                    placeholder="Tomates, pâtes, œufs…"
                    onChange={(e) =>
                      updateIngredient(ingredient.id, { name: e.target.value })
                    }
                  />
                </label>
                <div className="ingredient-amount">
                  <label className="field">
                    Quantité
                    <input
                      type="number"
                      required
                      min="0"
                      max="1000000"
                      step="any"
                      inputMode="decimal"
                      value={ingredient.quantity}
                      onChange={(e) =>
                        updateIngredient(ingredient.id, {
                          quantity: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Unité
                    <select
                      value={ingredient.unit}
                      onChange={(e) =>
                        updateIngredient(ingredient.id, {
                          unit: e.target.value as Unit,
                        })
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field ingredient-category">
                  Rayon
                  <select
                    value={ingredient.category}
                    onChange={(e) =>
                      updateIngredient(ingredient.id, {
                        category: e.target.value as Category,
                      })
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button secondary full-width"
            onClick={() => {
              const next = newIngredient();
              setIngredients((rows) => [
                ...rows,
                { ...next, quantity: String(next.quantity) },
              ]);
            }}
          >
            <Plus size={18} />
            Ajouter un ingrédient
          </button>
          {(error || saveError) && (
            <p className="inline-error" role="alert">
              {error || saveError}
            </p>
          )}
          <div className="form-footer">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="button"
              disabled={processing || saving}
            >
              {saving ? "Enregistrement…" : "Enregistrer la recette"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
