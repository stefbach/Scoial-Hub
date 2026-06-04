"use client";

import { useEffect, useRef, useState } from "react";

export function Dropdown({
  trigger,
  children,
  align = "left",
}: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        /* z-[9999] pour éviter tout débordement de stacking context.
           max-w-xs + w-max pour contraindre la largeur et éviter que le texte
           déborde hors de l'écran. break-words appliqué sur les enfants via
           le conteneur. right-0/left-0 assure l'ancrage côté écran correct. */
        <div
          className={`absolute z-[9999] mt-1 w-max min-w-[160px] max-w-xs overflow-hidden rounded-md border border-hair bg-card py-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-canvas ${
        active ? "font-medium text-ink" : "text-ink/80"
      }`}
    >
      {children}
    </button>
  );
}
