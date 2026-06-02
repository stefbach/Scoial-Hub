"use client";

import { useState } from "react";
import { HelpDrawer } from "./HelpDrawer";

export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'aide contextuelle"
        aria-expanded={open}
        className="
          flex h-8 w-8 items-center justify-center rounded-full
          border border-hair bg-card
          text-sm font-bold text-muted
          shadow-xs
          transition-all duration-[150ms]
          hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600 hover:shadow-sm
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-primary-500 focus-visible:ring-offset-1
          active:scale-[0.97]
          select-none
        "
      >
        ?
      </button>

      <HelpDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
