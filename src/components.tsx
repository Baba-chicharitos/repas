import { useEffect, useRef, useState, type ReactNode } from "react";
import { CookingPot, Minus, Plus, X } from "lucide-react";
import { loadImage } from "./storage";

export function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

export function RecipeImage({
  imageId,
  blob,
  name,
  className = "",
}: {
  imageId?: string;
  blob?: Blob;
  name: string;
  className?: string;
}) {
  const [stored, setStored] = useState<Blob>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setStored(undefined);
    setFailed(false);
    if (imageId)
      void loadImage(imageId)
        .then((value) => {
          if (active) setStored(value);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    return () => {
      active = false;
    };
  }, [imageId]);
  const url = useBlobUrl(blob ?? stored);
  return url && !failed ? (
    <img
      className={`recipe-image ${className}`}
      src={url}
      alt={name}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={`recipe-placeholder ${className}`}
      role="img"
      aria-label={`Illustration du plat ${name}`}
    >
      <div className="plate">
        <CookingPot size={62} strokeWidth={1.2} />
      </div>
      <span>À votre façon.</span>
      <span className="placeholder-seed seed-one" />
      <span className="placeholder-seed seed-two" />
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Fermer" onClick={onClose}>
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 10000,
  hint,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  hint?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  function commit() {
    const n = Number(draft);
    if (Number.isInteger(n) && n >= min && n <= max) {
      if (n !== value) onChange(n);
    } else setDraft(String(value));
  }
  return (
    <label className="number-field">
      <span>{label}</span>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Diminuer : ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={16} />
        </button>
        <input
          aria-label={label}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step="1"
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              e.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          aria-label={`Augmenter : ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={16} />
        </button>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
