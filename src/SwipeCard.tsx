import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Flame, Users, X } from "lucide-react";
import type { Recipe } from "./types";
import { RecipeImage } from "./components";
import { formatNumber } from "./domain";

export function SwipeCard({
  recipe,
  showCalories,
  disabled,
  onDecision,
  onDetails,
}: {
  recipe: Recipe;
  showCalories: boolean;
  disabled: boolean;
  onDecision: (accept: boolean) => void;
  onDetails: () => void;
}) {
  const start = useRef<
    { x: number; y: number; horizontal: boolean; vertical: boolean } | undefined
  >(undefined);
  const [offset, setOffset] = useState(0);
  const [exit, setExit] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function decide(accept: boolean) {
    if (disabled || exit) return;
    setExit(accept ? 1 : -1);
    timer.current = setTimeout(
      () => {
        setExit(0);
        setOffset(0);
        onDecision(accept);
      },
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 190,
    );
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s || disabled || exit || s.vertical) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y;
    if (!s.horizontal && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      if (Math.abs(dy) >= Math.abs(dx)) {
        s.vertical = true;
        return;
      }
      s.horizontal = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (s.horizontal) setOffset(dx);
  }
  function end(cancel = false) {
    const horizontal = start.current?.horizontal;
    start.current = undefined;
    if (!cancel && horizontal && Math.abs(offset) > 85) decide(offset > 0);
    else setOffset(0);
  }
  // Button and touch gestures enter the very same decision path.
  return (
    <div className="swipe-area">
      <div className="card-stack" />
      <div
        className={`swipe-card ${exit ? "card-exit" : ""}`}
        style={{
          transform: `translateX(${exit ? exit * 420 : offset}px) rotate(${exit ? exit * 18 : offset / 22}deg)`,
          opacity: exit ? 0 : 1,
          transition: start.current?.horizontal && !exit ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (
            !disabled &&
            !exit &&
            e.button === 0 &&
            !(e.target as HTMLElement).closest("button")
          )
            start.current = {
              x: e.clientX,
              y: e.clientY,
              horizontal: false,
              vertical: false,
            };
        }}
        onPointerMove={move}
        onPointerUp={() => end()}
        onPointerCancel={() => end(true)}
      >
        <div className="swipe-photo">
          <RecipeImage name={recipe.name} imageId={recipe.imageId} />
          <span className="recipe-label">AU MENU ?</span>
          {Math.abs(offset) > 24 && (
            <span
              className={`swipe-stamp ${offset > 0 ? "yes" : "no"}`}
              style={{ opacity: Math.min(1, Math.abs(offset) / 100) }}
            >
              {offset > 0 ? "ON GARDE" : "ON PASSE"}
            </span>
          )}
        </div>
        <div className="swipe-description">
          <div className="recipe-meta">
            <span>
              <Users size={14} />
              Pour {recipe.referencePortions} portions
            </span>
            {showCalories && recipe.calories !== undefined && (
              <span>
                <Flame size={14} />
                {formatNumber(recipe.calories)} kcal / portion
              </span>
            )}
          </div>
          <h2>{recipe.name}</h2>
          <div className="swipe-card-footer">
            <p>
              {recipe.ingredients.length} ingrédient
              {recipe.ingredients.length > 1 ? "s" : ""}
            </p>
            <button
              className="text-button"
              onClick={onDetails}
              disabled={Boolean(exit)}
            >
              Voir la recette <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
      <div className="swipe-controls">
        <button
          className="swipe-choice reject"
          disabled={disabled || Boolean(exit)}
          aria-label="Passer cette recette"
          onClick={() => decide(false)}
        >
          <X size={27} />
          <span>Passer</span>
        </button>
        <span className="swipe-tip">
          <ArrowLeft size={13} /> Glissez pour choisir <ArrowRight size={13} />
        </span>
        <button
          className="swipe-choice accept"
          disabled={disabled || Boolean(exit)}
          aria-label="Choisir cette recette"
          onClick={() => decide(true)}
        >
          <Check size={27} />
          <span>Choisir</span>
        </button>
      </div>
    </div>
  );
}
