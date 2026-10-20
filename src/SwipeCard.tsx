import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Recipe } from "./types";
import { NutritionSummary } from "./NutritionSummary";
import { RecipeImage } from "./components";

export function SwipeCard({
  recipe,
  disabled,
  showNutrition = false,
  onDecision,
}: {
  recipe: Recipe;
  disabled: boolean;
  showNutrition?: boolean;
  onDecision: (accept: boolean) => void;
}) {
  const gesture = useRef<{
    x: number;
    y: number;
    offset: number;
    horizontal: boolean;
    vertical: boolean;
  } | null>(null);
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
  function move(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || disabled || exit || start.vertical) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    if (!start.horizontal && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      if (Math.abs(dy) >= Math.abs(dx)) {
        start.vertical = true;
        return;
      }
      start.horizontal = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (start.horizontal) {
      start.offset = dx;
      setOffset(dx);
    }
  }
  function end(cancelled = false) {
    const start = gesture.current;
    gesture.current = null;
    if (!cancelled && start?.horizontal && Math.abs(start.offset) > 85)
      decide(start.offset > 0);
    else setOffset(0);
  }
  return (
    <div className="swipe-area">
      <div className="card-stack" />
      <div
        className="swipe-card"
        role="group"
        aria-busy={disabled || Boolean(exit)}
        tabIndex={0}
        aria-label={`Recette : ${recipe.name}. Glissez à droite pour choisir, à gauche pour passer.`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            decide(e.key === "ArrowRight");
          }
        }}
        style={{
          transform: `translateX(${exit ? exit * 420 : offset}px) rotate(${exit ? exit * 15 : offset / 25}deg)`,
          opacity: exit ? 0 : 1,
          transition: gesture.current?.horizontal && !exit ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (!disabled && !exit && e.button === 0)
            gesture.current = {
              x: e.clientX,
              y: e.clientY,
              offset: 0,
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
        </div>
        <div className="swipe-description">
          <h2>{recipe.name}</h2>
          {showNutrition && <NutritionSummary recipe={recipe} />}
        </div>
      </div>
    </div>
  );
}
